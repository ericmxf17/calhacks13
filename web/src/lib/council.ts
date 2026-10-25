import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { appendFile, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { BackendError, object } from './backend'
import { validateBusiness } from './business-input'
import { agentFor, configuredAgents, creaoID } from './creao'
import { councilBusinessKey, type CouncilHistoryRound, type CouncilJob, type CouncilRequest, type CouncilRole, type CouncilSourceRef, type CouncilThread } from './council-types'
import { councilReadiness, runCouncilRole } from './council-droid'
import type { CouncilToolEffect } from './council-tools'
import { resolveCouncilSources } from './council-sources'
import { councilDemoId } from './council-demo'
import { councilStoreConfigured, saveCouncilSnapshot } from './council-store'
export { councilSourceOptions } from './council-sources'

type SavedJob = { job: CouncilJob; requestHash: string; sessions: Partial<Record<CouncilRole, string>> }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const maxRounds = 4
const maxHistoryBytes = 256 * 1024
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
async function saveSnapshot(saved: SavedJob) {
  saved.job.updatedAt = new Date(Math.max(Date.now(), Date.parse(saved.job.updatedAt) + 1)).toISOString()
  const temporary = path.join(directory(saved.job.id), `${randomUUID()}.tmp`)
  await writeFile(temporary, JSON.stringify(saved, null, 2), { flag: 'wx', mode: 0o600 })
  await rename(temporary, path.join(directory(saved.job.id), 'job.json'))
  const demoId = councilDemoId(saved.job.business)
  if (demoId && councilStoreConfigured()) {
    try { await saveCouncilSnapshot(`demo:${demoId}`, saved) }
    catch { console.warn('[council-archive]', JSON.stringify({ jobId: saved.job.id, status: 'sync_failed', message: 'The local snapshot is saved. Import it into SpacetimeDB before sharing this run.' })) }
  }
}
// All state mutations, including session/status callbacks and tool results,
// share one serialized owner and the existing atomic snapshot replacement.
const commits = new WeakMap<SavedJob, Promise<void>>()
function commit(saved: SavedJob, mutate: () => void = () => {}): Promise<void> {
  const previous = commits.get(saved) || Promise.resolve()
  const next = previous.catch(() => undefined).then(async () => {
    const before = structuredClone(saved)
    try { mutate(); await saveSnapshot(saved) }
    catch (error) {
      // Role/tool closures retain this job object. Restore its fields in place
      // so a failed write cannot leave those closures observing orphan state.
      const current = saved.job as unknown as Record<string, unknown>
      for (const key of Object.keys(current)) delete current[key]
      Object.assign(saved.job, before.job)
      saved.sessions = before.sessions
      saved.requestHash = before.requestHash
      throw error
    }
  })
  commits.set(saved, next)
  return next
}
function recordToolEffect(saved: SavedJob, effect: CouncilToolEffect) {
  return commit(saved, () => {
    const calls = saved.job.toolCalls ||= []
    const index = calls.findIndex(call => call.id === effect.call.id)
    if (index < 0) { if (calls.length >= 24) throw new BackendError(400, 'COUNCIL_TOOL_BUDGET', 'Council tool call budget reached.'); calls.push(effect.call) } else calls[index] = effect.call
    if (effect.artifact) (saved.job.artifacts ||= []).push(effect.artifact)
    // Generated together from one executed result, persisted atomically.
    if (effect.evidence) (saved.job.toolEvidence ||= []).push(effect.evidence)
  })
}
async function readSaved(id: string): Promise<SavedJob> {
  try {
    const saved = JSON.parse(await readFile(path.join(directory(id), 'job.json'), 'utf8')) as SavedJob
    // Jobs saved before chat support are immutable first rounds. Keep their
    // stored request hash unchanged so their original payload still replays.
    if (saved.job.previousJobId === undefined && saved.job.rootJobId === undefined && saved.job.round === undefined) {
      Object.assign(saved.job, { previousJobId: null, rootJobId: saved.job.id, round: 1 })
    }
    return saved
  }
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
    await commit(saved, () => {
      saved.job.status = 'interrupted'
      saved.job.message = 'The local runner stopped before this council completed. Saved turns remain available. Execution is not resumed automatically; inspect this job before starting a new council.'
      for (const call of saved.job.toolCalls || []) if (call.status === 'running') { call.status = 'interrupted'; call.completedAt = new Date().toISOString(); call.error = 'Runner stopped before the tool result was durably saved.' }
    })
  }
  return saved.job
}
/** Read a selected branch without dispatching or resuming any council work. */
export async function readCouncilThread(value: unknown): Promise<CouncilThread> {
  const rounds: CouncilJob[] = []
  const visited = new Set<string>()
  let id: string | null = jobId(value)
  while (id !== null) {
    if (visited.has(id)) throw new BackendError(409, 'INVALID_COUNCIL_THREAD', 'The saved council chain contains a cycle. Inspect the local ledger before continuing.')
    if (rounds.length >= maxRounds) throw new BackendError(409, 'THREAD_LIMIT_REACHED', 'A council thread supports at most four rounds. Start a new thread with the evidence you want to use.')
    visited.add(id)
    const round = await readCouncilJob(id)
    if (rounds.length && round.status !== 'completed') throw new BackendError(409, 'PREVIOUS_COUNCIL_NOT_COMPLETE', 'A prior council round did not complete. Inspect its saved state before starting a new thread.')
    rounds.unshift(round)
    id = round.previousJobId === null ? null : jobId(round.previousJobId)
  }
  const root = rounds[0]
  for (const [index, round] of rounds.entries()) {
    if (round.rootJobId !== root.id || round.round !== index + 1 || canonical(validateBusiness(round.business)) !== canonical(validateBusiness(root.business)) || canonical(round.sources) !== canonical(root.sources)) {
      throw new BackendError(409, 'INVALID_COUNCIL_THREAD', 'The saved council chain has inconsistent company or evidence snapshots. Inspect the local ledger before continuing.')
    }
  }
  return { rootJobId: root.id, rounds }
}
function validateRequest(raw: unknown): CouncilRequest {
  const input = object(raw, 'Council request')
  const requestId = jobId(input.requestId)
  const previousJobId = input.previousJobId === undefined ? undefined : jobId(input.previousJobId)
  let business
  try { business = validateBusiness(input.business) } catch { throw new BackendError(400, 'INVALID_BUSINESS', 'Complete the current business profile before running the council.') }
  if (typeof input.question !== 'string' || !input.question.trim() || input.question.length > 2000) throw new BackendError(400, 'INVALID_QUESTION', 'Enter a question of at most 2,000 characters.')
  if (input.assignToCompany !== true) throw new BackendError(400, 'ASSIGNMENT_REQUIRED', 'Explicitly assign the selected evidence to the active company.')
  if (!Array.isArray(input.sources) || input.sources.length > 8) throw new BackendError(400, 'INVALID_SOURCES', 'Select at most eight evidence sources.')
  if (previousJobId && input.sources.length) throw new BackendError(400, 'CONTINUATION_SOURCES_FROZEN', 'Follow-ups use the thread’s saved evidence. Send an empty sources array, or start a new thread to select different evidence.')
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
  return { requestId, business, question: input.question.trim(), sources, assignToCompany: true, ...(previousJobId ? { previousJobId } : {}) }
}
export async function councilSetup() {
  return { ...await councilReadiness(), members: (['finance', 'operations', 'skeptic', 'chair'] as const).map(role => ({ role, modelId: process.env.COUNCIL_MODEL_ID?.trim() || 'unconfigured', reasoningEffort: process.env.COUNCIL_REASONING_EFFORT || 'unconfigured' })), capabilities: ['Inline charts, tables, flowcharts and maps', 'Sandboxed custom HTML and JavaScript', 'Isolated QuickJS calculations', 'Trusted Python policy calculations', 'Public HTTPS URL reading'], roles: configuredAgents().map(agent => ({ role: agent.role, name: agent.name, configured: agent.readiness === 'configured' })) }
}
async function execute(saved: SavedJob, request: CouncilRequest, history: CouncilHistoryRound[]) {
  try {
    if (!request.previousJobId) {
      const sources = await resolveCouncilSources(request.business, request.sources)
      await commit(saved, () => { saved.job.sources = sources })
    }
    const readiness = await councilReadiness()
    if (!readiness.available) throw new BackendError(503, 'FACTORY_NOT_CONFIGURED', readiness.message!)
    await commit(saved, () => { saved.job.status = 'running' })
    for (const role of ['finance', 'operations', 'skeptic', 'chair'] as const) {
      await commit(saved, () => { saved.job.stage = role })
      const result = await runCouncilRole(saved.job, role, history,
        id => commit(saved, () => { saved.sessions[role] = id }),
        async event => {
          if (event.phase === 'session_ready' && event.modelId && event.reasoningEffort) {
            const model = { modelId: event.modelId, reasoningEffort: event.reasoningEffort }
            await commit(saved, () => { (saved.job.speakers ||= {})[role] = model })
          }
          const entry = { at: new Date().toISOString(), role, ...event }
          console.info('[council]', JSON.stringify({ jobId: saved.job.id, ...entry }))
          try { await appendFile(path.join(directory(saved.job.id), 'diagnostics.jsonl'), `${JSON.stringify(entry)}\n`, { mode: 0o600 }) }
          catch { console.warn('[council] Could not persist the diagnostic event; the job ledger is still authoritative.') }
        }, effect => recordToolEffect(saved, effect))
      await commit(saved, () => {
        saved.job.turns.push(result.turn)
        if (result.decision) saved.job.decision = result.decision
      })
    }
    await commit(saved, () => {
      saved.job.status = 'completed'
      saved.job.stage = null
      saved.job.message = 'Complete. Citations verify evidence membership and literal numeric excerpts, not truth. Calculated scenarios depend on their supplied inputs and assumptions.'
    })
  } catch (error) {
    await commit(saved, () => {
      saved.job.status = 'failed'
      saved.job.decision = null
      saved.job.message = error instanceof BackendError ? error.message : 'The council runner failed. Completed turns remain saved; inspect this job before starting another council. No automatic retry was made.'
      for (const call of saved.job.toolCalls || []) if (call.status === 'running') { call.status = 'interrupted'; call.completedAt = new Date().toISOString(); call.error = 'Council stopped before the tool result was saved.' }
    })
  }
}
export async function submitCouncil(raw: unknown): Promise<CouncilJob> {
  const request = validateRequest(raw)
  const requestHash = createHash('sha256').update(canonical(request)).digest('hex')
  await mkdir(dataDirectory(), { recursive: true, mode: 0o700 })
  // Replay before checking parent eligibility. Recovery must never create a
  // second paid run because a previously accepted parent is now unavailable.
  try {
    await stat(directory(request.requestId))
    const saved = await readSaved(request.requestId)
    if (saved.requestHash !== requestHash) throw new BackendError(409, 'REQUEST_ID_CONFLICT', 'This request ID already belongs to a different council submission. Recover the saved job or use a new ID for an intentionally new council.')
    return readCouncilJob(request.requestId)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  let previous: CouncilJob | null = null
  let history: CouncilHistoryRound[] = []
  if (request.previousJobId) {
    const thread = await readCouncilThread(request.previousJobId)
    previous = thread.rounds.at(-1)!
    if (previous.status !== 'completed') throw new BackendError(409, 'PREVIOUS_COUNCIL_NOT_COMPLETE', 'Wait for the previous round to complete. Failed or interrupted rounds require a new thread.')
    if (canonical(request.business) !== canonical(validateBusiness(previous.business))) throw new BackendError(409, 'COUNCIL_COMPANY_CHANGED', 'Follow-ups require the exact saved company profile. Start a new thread for the edited profile.')
    if (thread.rounds.length >= maxRounds) throw new BackendError(409, 'THREAD_LIMIT_REACHED', 'This thread has reached its four-round limit. Start a new thread with the evidence you want to use.')
    history = thread.rounds.map(({ id, question, turns, decision, createdAt, artifacts, toolEvidence }) => ({ id, question, turns, decision, createdAt, artifacts: artifacts?.map(artifact => artifact.kind === 'html' ? { ...artifact, html: '[Saved custom HTML omitted from context]' } : artifact), toolEvidence }))
    if (Buffer.byteLength(JSON.stringify(history)) > maxHistoryBytes) throw new BackendError(413, 'CONTEXT_TOO_LARGE', 'Saved council history exceeds 256 KiB. Start a new thread; no history was silently removed.')
  }
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
  const saved: SavedJob = { requestHash, sessions: {}, job: { id: request.requestId, previousJobId: previous?.id ?? null, rootJobId: previous?.rootJobId ?? request.requestId, round: previous ? previous.round + 1 : 1, business: request.business, businessKey: councilBusinessKey(request.business), question: request.question, status: 'resolving', stage: null, artifacts: [], toolCalls: [], toolEvidence: [], speakers: {}, sources: previous ? structuredClone(previous.sources) : [], turns: [], decision: null, message: null, createdAt: now, updatedAt: now } }
  // Publish ownership before the first awaited state write, so GET cannot
  // mistake an active reservation for a runner lost in a process restart.
  let start!: () => void
  const ready = new Promise<void>(resolve => { start = resolve })
  const execution = ready.then(() => execute(saved, request, history)).catch(() => {
    // If publishing the failure itself failed, preserve the reservation. The
    // next reader marks the last durable running state interrupted.
  }).finally(() => owners.delete(request.requestId))
  owners.set(request.requestId, execution)
  try { await commit(saved) } catch (error) { owners.delete(request.requestId); throw error }
  start()
  return structuredClone(saved.job)
}
