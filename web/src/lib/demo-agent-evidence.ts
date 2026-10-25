import evidence from '../demo-data/agent-evidence.json'
import { agentCatalog } from './agent-catalog'
import type { AgentRunDetail, AgentRunsResponse, ArtifactPreview } from './agent-run-types'

const headers = { 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' }
const previewLimit = 256 * 1024
const archivedRuns = evidence.runs.map(run => ({ ...run, detail: run.detail as AgentRunDetail }))
const provenance = { label: evidence.evidenceLabel, recordedAt: evidence.recordedAt, mode: 'archive' }

function failure(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status, headers })
}

function page(value: string | null, fallback: number, minimum: number, maximum: number) {
  if (value === null) return fallback
  const number = Number(value)
  return /^\d+$/.test(value) && Number.isSafeInteger(number) && number >= minimum && number <= maximum ? number : null
}

/** Read only the reviewed Oct 25 archive; unknown routes never reach provider history. */
export function readDemoAgentRuns(path: string[], url: URL): Response | null {
  const [role, runId, section, index] = path
  if (path.length === 1 && role === 'agents') {
    return Response.json({ agents: agentCatalog.map(agent => ({ role: agent.role,
      connection: archivedRuns.some(run => run.role === agent.role) ? 'connected' : 'not_configured' })), evidence: provenance }, { headers })
  }
  const agent = agentCatalog.find(agent => agent.role === role)
  if (!agent) return null
  const runs = archivedRuns.filter(run => run.role === role).sort((a, b) => (b.detail.createdAt || '').localeCompare(a.detail.createdAt || ''))
  if (path.length === 1) {
    const limit = page(url.searchParams.get('limit'), 20, 1, 100)
    const offset = page(url.searchParams.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER)
    if (limit === null || offset === null) return failure(400, 'INVALID_INPUT', 'Choose a valid page of archived runs.')
    const body: AgentRunsResponse = { agent: { role, name: agent.name, connection: runs.length ? 'connected' : 'not_configured' },
      runs: runs.slice(offset, offset + limit).map(run => run.detail), limit, offset }
    return Response.json({ ...body, evidence: provenance }, { headers })
  }
  if (path.length !== 2 && !(path.length === 4 && section === 'artifacts' && /^\d+$/.test(index))) {
    return failure(404, 'NOT_FOUND', 'This archived evidence route is unavailable.')
  }
  const run = runs.find(run => run.detail.id === runId)
  if (!run) return failure(404, 'RUN_NOT_FOUND', 'This run is not in the reviewed demo archive.')
  if (path.length === 2) return Response.json({ ...run.detail, evidence: provenance }, { headers })
  const artifact = run.detail.artifacts.find(artifact => artifact.index === Number(index))
  const saved = run.contents.find(content => content.index === Number(index))
  if (!artifact || !saved) return failure(404, 'ARTIFACT_NOT_FOUND', 'This artifact is not in the reviewed demo archive.')
  if (url.searchParams.get('preview') === '1') {
    const bytes = new TextEncoder().encode(saved.content)
    const body: ArtifactPreview = { title: artifact.title, mediaType: artifact.mediaType,
      content: new TextDecoder().decode(bytes.subarray(0, previewLimit)), truncated: bytes.length > previewLimit }
    return Response.json(body, { headers })
  }
  const filename = artifact.title.replace(/[\x00-\x1f\x7f"\\/]/g, '_').slice(0, 180)
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16)}`)
  return new Response(saved.content, { headers: { ...headers, 'Content-Type': artifact.mediaType,
    'Content-Disposition': `attachment; filename="${filename.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encoded}` } })
}
