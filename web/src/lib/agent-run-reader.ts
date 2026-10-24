import 'server-only'

import { BackendError, readBody } from './backend'
import { briefWriterExample, readBriefWriterJob, submitBriefWriter } from './brief-writer'
import { agentFor, configuredAgents, getRun, listRuns, ProviderError, type Agent, type Run } from './creao'
import type { AgentConnectionsResponse, AgentRunDetail, AgentRunsResponse, ArtifactPreview } from './agent-run-types'

const textTypes = new Set(['text/plain', 'text/markdown', 'text/csv', 'application/json', 'text/tab-separated-values'])
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const storageHost = 'storage-bucket-creao-user-upload-production.s3.us-west-2.amazonaws.com'
const previewLimit = 256 * 1024
export const privateHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }

export function requireLocalAgentPreview(request: Request) {
  const url = new URL(request.url)
  const host = request.headers.get('host')
  const local = (hostname: string) => ['localhost', '127.0.0.1', '[::1]'].includes(hostname)
  let hostURL: URL | null = null
  try { hostURL = host ? new URL(`http://${host}`) : null } catch { /* Invalid Host is forbidden. */ }
  const origin = request.headers.get('origin')
  const site = request.headers.get('sec-fetch-site')
  // Next uses the bind address in request.url; the browser origin uses Host.
  const localServer = local(url.hostname)
  const browserOrigin = hostURL ? `${url.protocol}//${hostURL.host}` : null
  if (process.env.NODE_ENV !== 'development' || process.env.ENABLE_LOCAL_AGENT_PREVIEW !== 'true'
    || !localServer || !hostURL || !local(hostURL.hostname) || hostURL.port !== url.port
    || (origin !== null && origin !== browserOrigin) || (site !== null && site !== 'same-origin' && site !== 'none')) {
    throw new BackendError(403, 'PREVIEW_UNAVAILABLE', 'Agent preview is unavailable here.')
  }
}

function artifacts(run: Run) {
  const items = typeof run.result === 'object' && run.result !== null ? run.result.artifacts : null
  if (!Array.isArray(items)) return []
  return items.filter((item): item is { id: string; title?: string; type?: string } =>
    item !== null && typeof item === 'object' && typeof item.id === 'string' && item.id.length > 0
    && item.id.length <= 4096 && (item.title === undefined || typeof item.title === 'string')
    && (item.type === undefined || typeof item.type === 'string'))
}

function runDetail(role: string, run: Run): AgentRunDetail {
  const result = run.result
  return {
    id: run.id, status: run.status, threadId: run.threadId ?? null,
    createdAt: run.createdAt ?? null, startedAt: run.startedAt ?? null,
    completedAt: run.completedAt ?? null, errorCode: run.errorCode ?? null,
    output: {
      text: typeof result === 'string' ? result : typeof result?.text === 'string' ? result.text : null,
      conversation: typeof result === 'object' && typeof result?.chatText === 'string' ? result.chatText : null,
    },
    artifacts: artifacts(run).map((artifact, index) => {
      const mediaType = artifact.type?.split(';')[0].trim().toLowerCase() || 'application/octet-stream'
      const downloadUrl = `/api/agent-runs/${role}/${encodeURIComponent(run.id)}/artifacts/${index}`
      return { index, title: artifact.title || artifact.id.split('/').pop() || 'Artifact', mediaType,
        downloadUrl, previewUrl: textTypes.has(mediaType) ? `${downloadUrl}?preview=1` : null }
    }),
  }
}

function pagination(value: string | null, fallback: number, min: number, max: number) {
  if (value === null) return fallback
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) {
    throw new BackendError(400, 'INVALID_INPUT', 'Choose a valid page of agent runs.')
  }
  return Number(value)
}

async function download(agent: Agent, run: Run, index: number, preview: boolean): Promise<Response> {
  const artifact = artifacts(run)[index]
  if (!artifact) throw new BackendError(404, 'ARTIFACT_NOT_FOUND', 'This artifact is unavailable.')
  const detail = runDetail(agent.role, run).artifacts[index]
  if (preview && !textTypes.has(detail.mediaType)) throw new BackendError(415, 'PREVIEW_UNAVAILABLE', 'Download this file to view it.')
  const stableURL = new URL(`https://agent.creao.ai/api/v1/runs/${encodeURIComponent(run.id)}/artifacts/download`)
  stableURL.searchParams.set('artifactId', artifact.id)
  // The scoped secret goes only to CREAO. Storage redirects are fetched without credentials.
  let response = await fetch(stableURL, { headers: { Authorization: `Bearer ${process.env[agent.keyEnv]!.trim()}` },
    redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(30_000) })
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('location')
    await response.body?.cancel()
    let destination: URL
    try { destination = new URL(location || '') } catch { throw new ProviderError('ARTIFACT_UNAVAILABLE', 'The artifact could not be downloaded.') }
    // This exact public bucket was verified from an existing CREAO artifact.
    if (destination.protocol !== 'https:' || destination.hostname !== storageHost || destination.port || destination.username || destination.password) {
      throw new ProviderError('ARTIFACT_UNAVAILABLE', 'The artifact could not be downloaded.')
    }
    response = await fetch(destination, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(30_000) })
  }
  if (!response.ok || !response.body) {
    await response.body?.cancel()
    throw new ProviderError('ARTIFACT_UNAVAILABLE', 'The artifact could not be downloaded.', response.status)
  }
  if (!preview) {
    const filename = (artifact.id.split('/').pop() || 'artifact').replace(/[\x00-\x1f\x7f"\\/]/g, '_').slice(0, 180)
    const encoded = encodeURIComponent(filename).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16)}`)
    return new Response(response.body, { headers: { ...privateHeaders, 'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encoded}` } })
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  let truncated = false
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      const remaining = previewLimit - size
      chunks.push(value.subarray(0, remaining))
      size += Math.min(value.length, remaining)
      if (value.length > remaining) { truncated = true; break }
    }
  } finally { await reader.cancel() }
  const bytes = new Uint8Array(size)
  let position = 0
  for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.length }
  const body: ArtifactPreview = { title: detail.title, mediaType: detail.mediaType, content: new TextDecoder().decode(bytes), truncated }
  return Response.json(body, { headers: privateHeaders })
}

export async function readAgentRuns(request: Request, path: string[]): Promise<Response> {
  requireLocalAgentPreview(request)
  const [role, runId, section, index] = path
  if (role === 'brief-writer' && path.length === 2 && runId === 'example') {
    return Response.json(await briefWriterExample(), { headers: privateHeaders })
  }
  if (role === 'brief-writer' && path.length === 3 && runId === 'jobs') {
    return Response.json(await readBriefWriterJob(section), { headers: privateHeaders })
  }
  if (path.length === 1 && role === 'agents') {
    // Verify each configured key with a read. One agent's failure must not hide the others.
    const agents = await Promise.all(configuredAgents().map(async agent => {
      if (agent.readiness !== 'configured') return { role: agent.role, connection: 'not_configured' as const }
      try {
        await listRuns(agent.role, 1, 0)
        return { role: agent.role, connection: 'connected' as const }
      } catch {
        return { role: agent.role, connection: 'unavailable' as const }
      }
    }))
    const body: AgentConnectionsResponse = { agents }
    return Response.json(body, { headers: privateHeaders })
  }
  if (!configuredAgents().some(agent => agent.role === role)) throw new BackendError(404, 'AGENT_NOT_FOUND', 'This agent is unavailable.')
  const agent = agentFor(role, false)
  const url = new URL(request.url)
  if (path.length === 1) {
    const limit = pagination(url.searchParams.get('limit'), 20, 1, 100)
    const offset = pagination(url.searchParams.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER)
    const connected = agent.readiness === 'configured'
    const runs = connected ? (await listRuns(role, limit, offset)).runs : []
    const body: AgentRunsResponse = { agent: { role, name: agent.name, connection: connected ? 'connected' : 'not_configured' },
      runs: runs.map(run => runDetail(role, run)), limit, offset }
    return Response.json(body, { headers: privateHeaders })
  }
  if (!uuid.test(runId || '') || !(path.length === 2 || (path.length === 4 && section === 'artifacts' && /^\d+$/.test(index)))) {
    throw new BackendError(400, 'INVALID_INPUT', 'Choose a valid agent run or artifact.')
  }
  if (agent.readiness !== 'configured') throw new BackendError(503, 'AGENT_NOT_CONFIGURED', 'This agent is not connected yet.')
  const run = await getRun(agent, runId)
  if (path.length === 2) return Response.json(runDetail(role, run), { headers: privateHeaders })
  return download(agent, run, Number(index), url.searchParams.get('preview') === '1')
}

export async function createAgentRun(request: Request, path: string[]): Promise<Response> {
  requireLocalAgentPreview(request)
  // Writes require an explicit browser origin, in addition to the local preview gate.
  const url = new URL(request.url)
  const origin = `${url.protocol}//${request.headers.get('host')}`
  if (request.headers.get('origin') !== origin || request.headers.get('sec-fetch-site') !== 'same-origin') {
    throw new BackendError(403, 'PREVIEW_UNAVAILABLE', 'Run submission requires the local application.')
  }
  if (path.length !== 2 || path[0] !== 'brief-writer' || path[1] !== 'jobs') {
    throw new BackendError(404, 'NOT_FOUND', 'Only Brief Writer can be started here.')
  }
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new BackendError(415, 'INVALID_INPUT', 'Send an analysis pack as JSON.')
  }
  const job = await submitBriefWriter(await readBody(request))
  return Response.json(job, { status: 202, headers: privateHeaders })
}
