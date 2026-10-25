import { BackendError, object } from '@/lib/backend'
import { privateHeaders, requireLocalAgentPreview } from '@/lib/agent-run-reader'
import { councilSetup, councilSourceOptions, readCouncilJob, readCouncilThread, submitCouncil } from '@/lib/council'
import { listDemoCouncils, readDemoCouncilThread } from '@/lib/council-archive'
import { councilStoreReadiness } from '@/lib/council-store'
import { findDemoCompany } from '@/lib/demo-companies'
import { demoCouncilCatalog } from '@/lib/demo-council-catalog'
import { councilBrowserSession } from '@/lib/council-session'
import { councilWorkerConfigured, councilWorkerRequest } from '@/lib/council-worker-client'
import { readDemoAgentRuns } from '@/lib/demo-agent-evidence'
import type { AgentConnectionsResponse, AgentRunsResponse } from '@/lib/agent-run-types'
import { agentCatalog, type AgentRole } from '@/lib/agent-catalog'
import type { CouncilSetup, CouncilSourceOption } from '@/lib/council-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
const hosted = () => process.env.NODE_ENV === 'production' || process.env.COUNCIL_EXECUTION_MODE === 'sandbox' || (process.env.CONSUL_JUDGE_DEMO === 'true' && process.env.COUNCIL_EXECUTION_MODE !== 'local')
async function reviewedRoles() {
  const response = readDemoAgentRuns(['agents'], new URL('https://archive.invalid/'))!
  const { agents } = await response.json() as AgentConnectionsResponse
  return agentCatalog.map(agent => ({ role: agent.role, name: agent.name, configured: agents.some(item => item.role === agent.role && item.connection === 'connected') }))
}
async function reviewedSources(query: URLSearchParams) {
  const offset = query.get('offset') || '0'
  if (!/^\d+$/.test(offset) || !Number.isSafeInteger(Number(offset))) throw new BackendError(400, 'INVALID_INPUT', 'Choose a valid source page offset.')
  const role = query.get('role') || ''
  if (!agentCatalog.some(agent => agent.role === role)) throw new BackendError(400, 'INVALID_SOURCE', 'Choose an agent in the reviewed evidence archive.')
  const response = readDemoAgentRuns([role], new URL(`https://archive.invalid/?offset=${offset}&limit=20`))
  if (!response || !response.ok) throw new BackendError(400, 'INVALID_SOURCE', 'Choose an agent in the reviewed evidence archive.')
  const page = await response.json() as AgentRunsResponse
  const sources: CouncilSourceOption[] = []
  for (const run of page.runs) {
    if (run.status !== 'completed') continue
    const text = run.output.conversation || run.output.text
    if (text?.trim()) sources.push({ ref: { kind: 'conversation', role: role as AgentRole, runId: run.id }, title: `${page.agent.name} saved conversation`, description: text.replace(/\s+/g, ' ').slice(0, 280), createdAt: run.completedAt || run.createdAt })
    for (const artifact of run.artifacts) if (artifact.previewUrl) sources.push({ ref: { kind: 'artifact', role: role as AgentRole, runId: run.id, index: artifact.index }, title: artifact.title, description: `Reviewed CREAO archive · ${artifact.mediaType}`, createdAt: run.completedAt || run.createdAt })
  }
  return { sources, offset: page.offset, limit: page.limit, hasMore: page.runs.length === page.limit }
}
function sessionHeaders(cookie?: string) { return cookie ? { ...privateHeaders, 'Set-Cookie': cookie } : privateHeaders }
async function readCouncilBody(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) throw new BackendError(400, 'INVALID_JSON', 'Send a valid JSON request body.')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 1024 * 1024) {
        await reader.cancel()
        throw new BackendError(413, 'INPUT_TOO_LARGE', 'The request must be smaller than 1 MB.')
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  try { return object(JSON.parse(Buffer.concat(chunks).toString('utf8')), 'Council request') }
  catch (error) {
    if (error instanceof BackendError) throw error
    throw new BackendError(400, 'INVALID_JSON', 'Send a valid JSON request body.')
  }
}
function failure(error: unknown, cookie?: string) {
  const known = error instanceof BackendError
  return Response.json({ error: { code: known ? error.code : 'COUNCIL_UNAVAILABLE', message: known ? error.message : 'The council request could not be completed. Keep the saved request ID and inspect its state before retrying.' } }, { status: known ? error.status : 502, headers: sessionHeaders(cookie) })
}
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams
    const demo = query.get('demo')
    if (query.get('view') === 'history' && demo && findDemoCompany(demo)) {
      const jobs = await listDemoCouncils(demo)
      return Response.json({ conversations: jobs.map(job => ({ id: job.id, rootJobId: job.rootJobId, question: demoCouncilCatalog[job.id]?.title || job.question, status: job.status, round: job.round, updatedAt: job.updatedAt })) }, { headers: privateHeaders })
    }
    if (hosted()) {
      if (query.get('view') === 'setup') {
        if (!councilWorkerConfigured()) {
          const archive = await councilStoreReadiness()
          return Response.json({ mode: 'live', available: false, message: archive.available ? 'The live council runner is not connected. Saved conversations remain available.' : archive.message, roles: [] }, { headers: privateHeaders })
        }
        const session = councilBrowserSession(request)
        try {
          const setup = await councilWorkerRequest<CouncilSetup>('/setup', session.owner)
          return Response.json({ ...setup, roles: await reviewedRoles(), mode: 'live' }, { headers: sessionHeaders(session.cookie) })
        } catch (error) {
          return Response.json({ mode: 'live', available: false, message: error instanceof BackendError ? error.message : 'The council runner could not be reached.', roles: [] }, { headers: sessionHeaders(session.cookie) })
        }
      }
      if (query.get('view') === 'sources') return Response.json(await reviewedSources(query), { headers: privateHeaders })
      const id = query.get('jobId') || ''
      if (query.get('view') === 'thread' && demo && demoCouncilCatalog[id]?.demoId === demo) return Response.json(await readDemoCouncilThread(demo, id), { headers: privateHeaders })
      const session = councilBrowserSession(request)
      const path = query.get('view') === 'thread' ? '/thread' : '/job'
      return Response.json(await councilWorkerRequest(`${path}?jobId=${encodeURIComponent(id)}`, session.owner), { headers: sessionHeaders(session.cookie) })
    }
    requireLocalAgentPreview(request)
    if (query.get('view') === 'setup') return Response.json(await councilSetup(), { headers: privateHeaders })
    if (query.get('view') === 'sources') {
      const rawOffset = query.get('offset') || '0'
      if (!/^\d+$/.test(rawOffset) || !Number.isSafeInteger(Number(rawOffset))) throw new BackendError(400, 'INVALID_INPUT', 'Choose a valid source page offset.')
      return Response.json(await councilSourceOptions(query.get('role'), Number(rawOffset)), { headers: privateHeaders })
    }
    if (query.get('view') === 'thread') return Response.json(await readCouncilThread(query.get('jobId')), { headers: privateHeaders })
    return Response.json(await readCouncilJob(query.get('jobId')), { headers: privateHeaders })
  } catch (error) { return failure(error) }
}
export async function POST(request: Request) {
  let cookie: string | undefined
  try {
    if (!hosted()) requireLocalAgentPreview(request)
    const url = new URL(request.url)
    if (request.headers.get('origin') !== `${url.protocol}//${request.headers.get('host')}` || request.headers.get('sec-fetch-site') !== 'same-origin') throw new BackendError(403, 'PREVIEW_UNAVAILABLE', 'Council submission requires the application origin.')
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new BackendError(415, 'INVALID_INPUT', 'Send the council request as JSON.')
    const body = await readCouncilBody(request)
    if (hosted()) {
      const session = councilBrowserSession(request)
      cookie = session.cookie
      return Response.json(await councilWorkerRequest('/submit', session.owner, body), { status: 202, headers: sessionHeaders(session.cookie) })
    }
    return Response.json(await submitCouncil(body), { status: 202, headers: privateHeaders })
  } catch (error) { return failure(error, cookie) }
}
