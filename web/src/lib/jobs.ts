import 'server-only'

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { BackendError, object } from './backend'
import { agentFor, creaoID, getRun, ProviderError, startRun, type AgentRole, type RunStatus } from './creao'

type JobError = { code: string; message: string; providerStatus?: number }
type JobBase = {
  id: string; agent: AgentRole; appId: string; inputs: Record<string, unknown>; threadId?: string
  createdAt: string; updatedAt: string; lastRefreshAt: string | null; refreshError?: JobError
}
type RemoteJob = JobBase & { status: RunStatus; runId: string; creaoThreadId?: string; result?: Record<string, unknown> | string | null; error?: JobError }
type UnresolvedJob = JobBase & { status: 'dispatching' | 'dispatch_unknown' | 'rejected'; runId?: never; error?: JobError }
export type Job = RemoteJob | UnresolvedJob
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const terminal = new Set(['completed', 'failed', 'cancelled', 'rejected'])
// A local ledger for one process on one host, not a distributed queue/database.
const refreshes = new Map<string, Promise<Job>>()
const dataDirectory = () => path.resolve(process.env.BACKEND_DATA_DIR || path.join(process.cwd(), '.backend', 'jobs'))
function jobID(value: unknown): string {
  if (typeof value !== 'string' || !uuid.test(value)) throw new BackendError(400, 'INVALID_REQUEST_ID', 'requestId/job ID must be a UUID. Save one UUID in the request file and reuse it for that submission.')
  return value.toLowerCase()
}
const jobDirectory = (id: string) => path.join(dataDirectory(), id)
async function saveJob(job: Job) {
  const temporary = path.join(jobDirectory(job.id), `${randomUUID()}.tmp`)
  await writeFile(temporary, JSON.stringify(job, null, 2), { flag: 'wx', mode: 0o600 })
  await rename(temporary, path.join(jobDirectory(job.id), 'job.json'))
}
export async function readJob(value: unknown): Promise<Job> {
  const id = jobID(value)
  try {
    return JSON.parse(await readFile(path.join(jobDirectory(id), 'job.json'), 'utf8')) as Job
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      let exists = false
      try { await readdir(jobDirectory(id)); exists = true } catch { /* No reservation. */ }
      if (exists) throw new BackendError(409, 'JOB_RESERVATION_UNRESOLVED', `Job ${id} is reserved but has no readable state yet. Read this same job ID again; do not submit a new request ID.`)
      throw new BackendError(404, 'JOB_NOT_FOUND', `Job ${id} was not found.`)
    }
    throw new BackendError(500, 'JOB_READ_FAILED', `Could not read job ${id}. Inspect the local ledger; do not resubmit with a new request ID.`)
  }
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}
function safeError(error: unknown): JobError {
  if (error instanceof ProviderError) return { code: error.code, message: error.message, ...(error.providerStatus ? { providerStatus: error.providerStatus } : {}) }
  if (error instanceof BackendError) return { code: error.code, message: error.message }
  return { code: 'JOB_OPERATION_FAILED', message: 'The operation could not complete. Inspect this same job ID before taking further action.' }
}
export async function createJob(input: Record<string, unknown>): Promise<Job> {
  const id = jobID(input.requestId)
  const selected = agentFor(input.agent, false)
  const inputs = object(input.inputs, 'inputs')
  const threadId = input.threadId === undefined ? undefined : creaoID(input.threadId, 'threadId')
  await mkdir(dataDirectory(), { recursive: true })
  try {
    await mkdir(jobDirectory(id))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw new BackendError(500, 'JOB_RESERVATION_FAILED', `Could not reserve job ${id}. Check BACKEND_DATA_DIR permissions.`)
    const existing = await readJob(id)
    if (existing.agent !== selected.role || existing.threadId !== threadId || canonical(existing.inputs) !== canonical(inputs)) {
      throw new BackendError(409, 'REQUEST_ID_CONFLICT', `Job ${id} already belongs to a different agent, inputs, or thread. Use its original request file.`)
    }
    return existing
  }
  // Reserve and persist before contacting CREAO. An interrupted dispatch is never resent.
  const now = new Date().toISOString()
  const dispatching: UnresolvedJob = { id, agent: selected.role, appId: selected.appId || '', inputs, ...(threadId ? { threadId } : {}), status: 'dispatching', createdAt: now, updatedAt: now, lastRefreshAt: null }
  let job: Job = dispatching
  try { await saveJob(job) } catch {
    throw new BackendError(500, 'JOB_SAVE_FAILED', `Job ${id} was reserved but could not be saved. No provider request was sent. Inspect that reservation before trying again.`)
  }
  try {
    const agent = agentFor(selected.role)
    const run = await startRun(agent, inputs, threadId)
    job = { ...job, appId: agent.appId!, status: run.status, runId: run.id, ...(typeof run.threadId === 'string' ? { creaoThreadId: run.threadId } : {}), ...(run.result !== undefined ? { result: run.result } : {}), ...(run.status === 'failed' ? { error: { code: run.errorCode || 'CREAO_RUN_FAILED', message: 'CREAO reported that this run failed.' } } : {}) }
  } catch (error) {
    const definitive = error instanceof ProviderError && error.providerStatus !== undefined && error.providerStatus >= 400 && error.providerStatus < 500
    const locallyRejected = error instanceof BackendError && !(error instanceof ProviderError)
    job = { ...dispatching, status: definitive || locallyRejected ? 'rejected' : 'dispatch_unknown', error: safeError(error) }
  }
  job.updatedAt = new Date().toISOString()
  try { await saveJob(job) } catch {
    // Return the known identity/outcome even if publication failed; retrying the POST cannot resend it.
    return { ...job, error: { code: 'JOB_SAVE_FAILED', message: `Outcome for job ${id} could not be saved. ${'runId' in job ? `CREAO run ID: ${job.runId}.` : ''} Do not resubmit. Inspect the local ledger.` } }
  }
  return job
}
export async function listJobs(limit: number, offset: number) {
  let entries: string[]
  try { entries = await readdir(dataDirectory()) } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { jobs: [], total: 0, limit, offset, source: 'local_ledger' }
    throw error
  }
  const ids = entries.filter(id => uuid.test(id)).sort()
  const jobs = await Promise.all(ids.slice(offset, offset + limit).map(readJob))
  return { jobs, total: ids.length, limit, offset, source: 'local_ledger' }
}
export async function refreshJob(value: unknown): Promise<Job> {
  const id = jobID(value)
  const active = refreshes.get(id)
  if (active) return active
  const operation = (async () => {
    const job = await readJob(id)
    if (terminal.has(job.status)) return job
    if (!job.runId) {
      throw new BackendError(409, 'DISPATCH_UNRESOLVED', `Job ${id} has no confirmed CREAO run ID. Dispatch may have happened. Do not resubmit; inspect the selected agent's API run history and reconcile manually.`)
    }
    let updated: Job
    const checkedAt = new Date().toISOString()
    try {
      const agent = agentFor(job.agent)
      if (agent.appId !== job.appId) throw new BackendError(409, 'AGENT_CONFIGURATION_CHANGED', 'The configured agent ID differs from this job. Restore its original agent configuration before refreshing.')
      const run = await getRun(agent, job.runId)
      if (run.id !== job.runId) throw new ProviderError('INVALID_CREAO_RESPONSE', 'CREAO returned a different run ID.')
      const { refreshError: _oldError, ...previous } = job
      updated = { ...previous, status: run.status, ...(typeof run.threadId === 'string' ? { creaoThreadId: run.threadId } : {}), ...(run.result !== undefined ? { result: run.result } : {}), ...(run.status === 'failed' ? { error: { code: run.errorCode || 'CREAO_RUN_FAILED', message: 'CREAO reported that this run failed.' } } : {}), lastRefreshAt: checkedAt, updatedAt: checkedAt }
    } catch (error) {
      updated = { ...job, lastRefreshAt: checkedAt, updatedAt: checkedAt, refreshError: safeError(error) }
    }
    try { await saveJob(updated) } catch {
      throw new BackendError(500, 'JOB_SAVE_FAILED', `Could not save refreshed job ${id}. Read this same ID before further action.`)
    }
    return updated
  })()
  refreshes.set(id, operation)
  try { return await operation } finally { refreshes.delete(id) }
}
