import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { BackendError, object } from './backend'
import { validateBusiness } from './business-input'
import { agentFor, configuredAgents, creaoID } from './creao'
import { councilBusinessKey, type CouncilJob, type CouncilRequest, type CouncilRole, type CouncilSourceRef } from './council-types'
import { councilReadiness, runCouncilRole } from './council-droid'
import { resolveCouncilSources } from './council-sources'
export { councilSourceOptions } from './council-sources'

type SavedJob = { job: CouncilJob; requestHash: string; sessions: Partial<Record<CouncilRole, string>> }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
// HMR may replace this module while a turn is running. Keep the live owner in
// the process, while disk remains the authoritative recovery ledger.
const state = globalThis as typeof globalThis & { consulCouncilOwners?: Map<string, Promise<void>> }
const owners = state.consulCouncilOwners ||= new Map()
const dataDirectory = () => path.resolve(process.env.COUNCIL_DATA_DIR || path.join(process.cwd(), '.backend', 'council'))
const directory = (id: string) => path.join(dataDirectory(), id)
function jobId(value: unknown) {
  if (typeof value !== 'string' || !uuid.test(value)) throw new BackendError(400, 'INVALID_REQUEST_ID', 'Use a UUID requestId and keep it for retries of this submission.')
  return value.toLowerCase()
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`
  return JSON.stringify(value)
}
async function save(saved: SavedJob) {
  saved.job.updatedAt = new Date().toISOString()
  const temporary = path.join(directory(saved.job.id), `${randomUUID()}.tmp`)
  await writeFile(temporary, JSON.stringify(saved, null, 2), { flag: 'wx', mode: 0o600 })
  await rename(temporary, path.join(directory(saved.job.id), 'job.json'))
}
async function readSaved(id: string): Promise<SavedJob> {
  try { return JSON.parse(await readFile(path.join(directory(id), 'job.json'), 'utf8')) as SavedJob }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      try { await readFile(path.join(directory(id), 'reservation.json')); }
      catch (reservationError) {
        if ((reservationError as NodeJS.ErrnoException).code === 'ENOENT') {
          // A directory can exist before reservation.json is published. Never
          // interpret that window as permission to dispatch the UUID again.
          try { await stat(directory(id)) }
          catch { throw new BackendError(404, 'JOB_NOT_FOUND', 'This council job was not found.') }
        }
      }
      throw new BackendError(409, 'JOB_RESERVATION_UNRESOLVED', 'This council ID is reserved but has no readable state yet. Keep the same ID and read it again; do not create a replacement submission.')
    }
    throw new BackendError(500, 'JOB_READ_FAILED', 'The saved council could not be read. Inspect the local ledger before submitting again.')
  }
}
export async function readCouncilJob(value: unknown): Promise<CouncilJob> {
  const id = jobId(value)
  const saved = await readSaved(id)
  if (['resolving', 'running'].includes(saved.job.status) && !owners.has(id)) {
    saved.job.status = 'interrupted'
    saved.job.message = 'The local runner stopped before this council completed. Saved turns remain available. Execution is not resumed automatically; inspect this job before starting a new council.'
    await save(saved)
  }
  return saved.job
}
function validateRequest(raw: unknown): CouncilRequest {
  const input = object(raw, 'Council request')
  const requestId = jobId(input.requestId)
  let business
  try { business = validateBusiness(input.business) } catch { throw new BackendError(400, 'INVALID_BUSINESS', 'Complete the current business profile before running the council.') }
  if (typeof input.question !== 'string' || !input.question.trim() || input.question.length > 2000) throw new BackendError(400, 'INVALID_QUESTION', 'Enter a question of at most 2,000 characters.')
  if (input.assignToCompany !== true) throw new BackendError(400, 'ASSIGNMENT_REQUIRED', 'Explicitly assign the selected evidence to the active company.')
  if (!Array.isArray(input.sources) || input.sources.length > 8) throw new BackendError(400, 'INVALID_SOURCES', 'Select at most eight evidence sources.')
  const sources: CouncilSourceRef[] = input.sources.map(rawRef => {
    const ref = object(rawRef, 'Source reference')
    if (ref.kind === 'sample' && ref.id === 'voltride-hr973') return { kind: 'sample', id: 'voltride-hr973' }
    if (ref.kind !== 'conversation' && ref.kind !== 'artifact') throw new BackendError(400, 'INVALID_SOURCE', 'Choose an available run conversation or text artifact.')
    const role = agentFor(ref.role, false).role
    const runId = creaoID(ref.runId, 'runId')
    if (ref.kind === 'conversation') return { kind: ref.kind, role, runId }
    if (typeof ref.index !== 'number' || !Number.isSafeInteger(ref.index) || ref.index < 0 || ref.index > 1000) throw new BackendError(400, 'INVALID_SOURCE', 'Choose a valid artifact index.')
    return { kind: ref.kind, role, runId, index: ref.index }
  })
  if (new Set(sources.map(canonical)).size !== sources.length) throw new BackendError(400, 'DUPLICATE_SOURCE', 'Select each source only once.')
  return { requestId, business, question: input.question.trim(), sources, assignToCompany: true }
}
export async function councilSetup() {
  return { ...await councilReadiness(), roles: configuredAgents().map(agent => ({ role: agent.role, name: agent.name, configured: agent.readiness === 'configured' })) }
}
async function execute(saved: SavedJob, request: CouncilRequest) {
  try {
    // Resolve snapshots even when Factory is not configured, so a saved failed
    // submission can still be inspected and company mismatches are visible.
    saved.job.sources = await resolveCouncilSources(request.business, request.sources)
    await save(saved)
    const readiness = await councilReadiness()
    if (!readiness.available) throw new BackendError(503, 'FACTORY_NOT_CONFIGURED', readiness.message!)
    saved.job.status = 'running'
    await save(saved)
    for (const role of ['finance', 'operations', 'skeptic', 'chair'] as const) {
      saved.job.stage = role
      await save(saved)
      const result = await runCouncilRole(saved.job, role, async id => { saved.sessions[role] = id; await save(saved) })
      saved.job.turns.push(result.turn)
      if (result.decision) saved.job.decision = result.decision
      await save(saved)
    }
    saved.job.status = 'completed'
    saved.job.stage = null
    saved.job.message = 'Complete. Citation checks verify source membership and literal numeric excerpts, not semantic truth. Inspect the source text and stated uncertainties.'
    await save(saved)
  } catch (error) {
    saved.job.status = 'failed'
    saved.job.decision = null
    saved.job.message = error instanceof BackendError ? error.message : 'The council runner failed. Completed turns remain saved; inspect this job before starting another council. No automatic retry was made.'
    await save(saved)
  }
}
export async function submitCouncil(raw: unknown): Promise<CouncilJob> {
  const request = validateRequest(raw)
  const requestHash = createHash('sha256').update(canonical(request)).digest('hex')
  await mkdir(dataDirectory(), { recursive: true, mode: 0o700 })
  try { await mkdir(directory(request.requestId), { mode: 0o700 }) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    const saved = await readSaved(request.requestId)
    if (saved.requestHash !== requestHash) throw new BackendError(409, 'REQUEST_ID_CONFLICT', 'This request ID already belongs to a different council submission. Recover the saved job or use a new ID for an intentionally new council.')
    return readCouncilJob(request.requestId)
  }
  // Reserve before any provider operation. An uncertain write/dispatch outcome
  // leaves this directory in place, so another POST cannot dispatch it again.
  await writeFile(path.join(directory(request.requestId), 'reservation.json'), JSON.stringify({ requestHash }), { flag: 'wx', mode: 0o600 })
  const now = new Date().toISOString()
  const saved: SavedJob = { requestHash, sessions: {}, job: { id: request.requestId, business: request.business, businessKey: councilBusinessKey(request.business), question: request.question, status: 'resolving', stage: null, sources: [], turns: [], decision: null, message: null, createdAt: now, updatedAt: now } }
  // Publish ownership before the first awaited state write, so GET cannot
  // mistake an active reservation for a runner lost in a process restart.
  let start!: () => void
  const ready = new Promise<void>(resolve => { start = resolve })
  const execution = ready.then(() => execute(saved, request)).catch(() => {
    // If publishing the failure itself failed, preserve the reservation. The
    // next reader marks the last durable running state interrupted.
  }).finally(() => owners.delete(request.requestId))
  owners.set(request.requestId, execution)
  try { await save(saved) } catch (error) { owners.delete(request.requestId); throw error }
  start()
  return structuredClone(saved.job)
}
