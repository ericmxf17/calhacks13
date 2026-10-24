import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { BackendError } from './backend'
import { agentFor, getRun, listRuns, openArtifact, type Run } from './creao'
import type { BusinessInput } from './business-input'
import type { CouncilEvidence, CouncilSourceOption, CouncilSourceRef } from './council-types'

const sourceLimit = 128 * 1024
const totalLimit = 512 * 1024
const textTypes = new Set(['text/plain', 'text/markdown', 'text/csv', 'application/json', 'text/tab-separated-values'])
export const councilRepoRoot = () => path.resolve(process.env.BACKEND_REPO_ROOT || path.join(process.cwd(), '..'))

// Match the existing agent reader's filtered artifact indexing exactly.
function artifacts(run: Run) {
  const items = typeof run.result === 'object' && run.result !== null ? run.result.artifacts : null
  if (!Array.isArray(items)) return []
  return items.filter((item): item is { id: string; title?: string; type?: string } =>
    item !== null && typeof item === 'object' && typeof item.id === 'string' && item.id.length > 0
    && item.id.length <= 4096 && (item.title === undefined || typeof item.title === 'string')
    && (item.type === undefined || typeof item.type === 'string'))
}
function conversation(run: Run) {
  if (typeof run.result === 'string') return run.result
  return typeof run.result?.chatText === 'string' ? run.result.chatText : typeof run.result?.text === 'string' ? run.result.text : ''
}
const media = (type?: string) => type?.split(';')[0].trim().toLowerCase() || ''

export async function councilSourceOptions(role: unknown, offset: number) {
  const agent = agentFor(role, false)
  const limit = 20
  if (agent.readiness !== 'configured') return { sources: [], offset, limit, hasMore: false }
  const page = await listRuns(agent.role, limit, offset)
  const runs = await Promise.all(page.runs.map(run => run.status === 'completed' && run.result === undefined ? getRun(agent, run.id) : run))
  const sources: CouncilSourceOption[] = []
  for (const run of runs) {
    if (run.status !== 'completed') continue
    const excerpt = conversation(run).replace(/\s+/g, ' ').trim().slice(0, 280)
    if (excerpt) sources.push({ ref: { kind: 'conversation', role: agent.role, runId: run.id }, title: `${agent.name} run conversation`, description: `CREAO API run conversation · ${excerpt}`, createdAt: run.completedAt || run.createdAt || null })
    artifacts(run).forEach((artifact, index) => {
      if (!textTypes.has(media(artifact.type))) return
      sources.push({ ref: { kind: 'artifact', role: agent.role, runId: run.id, index }, title: artifact.title || `Artifact ${index + 1}`, description: `${agent.name} · saved ${media(artifact.type)} artifact`, createdAt: run.completedAt || run.createdAt || null })
    })
  }
  return { sources, offset, limit, hasMore: typeof page.total === 'number' ? offset + limit < page.total : page.runs.length === limit }
}

function boundedText(text: string) {
  if (!text.trim()) throw new BackendError(400, 'EMPTY_SOURCE', 'The selected source has no text.')
  if (Buffer.byteLength(text) > sourceLimit) throw new BackendError(413, 'SOURCE_TOO_LARGE', 'Each source must be at most 128 KiB; choose a smaller saved artifact.')
  return text
}
function normalizeName(text: string) { return text.normalize('NFKC').trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') }
export function councilCompanyMatch(text: string, business: Pick<BusinessInput, 'company'>): CouncilEvidence['companyMatch'] {
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { return 'unidentified' }
  const identities: string[] = []
  function identity(value: unknown) {
    if (typeof value === 'string' && value.trim()) identities.push(value)
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, unknown>
      for (const key of ['name', 'company', 'company_name']) if (record[key] !== undefined) identity(record[key])
    }
  }
  function companyProfile(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return
    const record = value as Record<string, unknown>
    if ('products' in record || 'offering' in record || 'website' in record) identity(record.name)
    for (const key of ['company', 'company_name', 'company_identity']) identity(record[key])
  }
  // Inspect only the document subject and known profile envelopes. Suppliers,
  // customers and citations can name companies without asserting ownership of
  // the document. Do not recursively search arbitrary nested company fields.
  companyProfile(parsed)
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const root = parsed as Record<string, unknown>
    companyProfile(root.business)
    companyProfile(root.profile)
    companyProfile(root.company_profile)
  }
  if (identities.some(name => normalizeName(name) !== normalizeName(business.company))) {
    throw new BackendError(400, 'COMPANY_MISMATCH', 'A selected source explicitly identifies a different company. Choose evidence for the active company.')
  }
  return identities.length ? 'explicit' : 'unidentified'
}
async function downloadText(response: Response) {
  const reader = response.body!.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.length
      if (size > sourceLimit) throw new BackendError(413, 'SOURCE_TOO_LARGE', 'The artifact exceeds the 128 KiB source limit.')
      chunks.push(value)
    }
  } finally { await reader.cancel() }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)) }
  catch { throw new BackendError(415, 'UNSUPPORTED_SOURCE', 'Choose a UTF-8 text artifact.') }
}

export async function resolveCouncilSources(business: BusinessInput, refs: CouncilSourceRef[]): Promise<CouncilEvidence[]> {
  const sources: CouncilEvidence[] = [{ id: 'S0', title: `${business.company} current profile`, text: boundedText(JSON.stringify(business, null, 2)), provenance: 'User-selected current business profile; not independently verified.', kind: 'profile', url: null, companyMatch: 'explicit', warnings: ['Profile inputs are user supplied.'] }]
  function add(source: Omit<CouncilEvidence, 'id'>) {
    source.text = boundedText(source.text)
    if (sources.reduce((size, item) => size + Buffer.byteLength(item.text), 0) + Buffer.byteLength(source.text) > totalLimit) throw new BackendError(413, 'EVIDENCE_TOO_LARGE', 'Selected evidence must total at most 512 KiB.')
    sources.push({ ...source, id: `S${sources.length}` })
  }
  for (const ref of refs) {
    if (ref.kind === 'sample') {
      if (normalizeName(business.company) !== 'voltride' || new URL(business.website).hostname !== 'voltride.example') throw new BackendError(400, 'COMPANY_MISMATCH', 'The saved VoltRide sample is available only for the VoltRide profile at voltride.example.')
      for (const filename of ['agent1-hr973.json', 'agent2-hr973.json', 'agent3-hr973.json', 'agent3-hr973-results.json', 'agent4-hr973-brief.json']) {
        add({ title: `Saved VoltRide sample · ${filename}`, text: await readFile(path.join(councilRepoRoot(), 'tests', filename), 'utf8'), provenance: `Repository tests/${filename}; fictional saved October 2026 analysis, not a live legislative update.`, kind: 'sample', url: null, companyMatch: 'explicit', warnings: ['Fictional company and saved analysis. Dates, assumptions and estimates may be stale; no latest-status claim is established.'] })
      }
      continue
    }
    const agent = agentFor(ref.role)
    const run = await getRun(agent, ref.runId)
    if (run.status !== 'completed') throw new BackendError(400, 'SOURCE_NOT_COMPLETE', 'Only completed run evidence can be assigned to a council.')
    if (ref.kind === 'conversation') {
      const text = boundedText(conversation(run))
      const match = councilCompanyMatch(text, business)
      add({ title: `${agent.name} run conversation`, text, provenance: `CREAO app-scoped API run ${run.id}; explicitly assigned to ${business.company} by the user.`, kind: 'conversation', url: null, companyMatch: match, warnings: match === 'unidentified' ? ['No structured company identity was found; user assignment does not establish ownership or relevance.'] : [] })
    } else {
      const artifact = artifacts(run)[ref.index]
      if (!artifact) throw new BackendError(404, 'ARTIFACT_NOT_FOUND', 'The selected artifact is not a member of this run.')
      if (!textTypes.has(media(artifact.type))) throw new BackendError(415, 'UNSUPPORTED_SOURCE', 'Choose a text, Markdown, JSON, CSV or TSV artifact.')
      const text = boundedText(await downloadText(await openArtifact(agent, run.id, artifact.id)))
      const match = councilCompanyMatch(text, business)
      add({ title: artifact.title || `Artifact ${ref.index + 1}`, text, provenance: `CREAO ${agent.name} API run ${run.id}, artifact ${ref.index}; explicitly assigned to ${business.company} by the user.`, kind: 'artifact', url: `/api/agent-runs/${agent.role}/${encodeURIComponent(run.id)}/artifacts/${ref.index}`, companyMatch: match, warnings: match === 'unidentified' ? ['No structured company identity was found; user assignment does not establish ownership or relevance.'] : [] })
    }
  }
  return sources
}
