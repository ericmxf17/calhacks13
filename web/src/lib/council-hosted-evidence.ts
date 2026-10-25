import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { BackendError } from './backend'
import type { BusinessInput } from './business-input'
import type { CouncilEvidence, CouncilSourceRef } from './council-types'
import { councilCompanyMatch } from './council-sources'

type ReviewedRun = { role: string; detail: { id: string; output: { conversation: string | null; text: string | null }; artifacts: { index: number; title: string }[] }; contents: { index: number; content: string }[] }
let archive: Promise<{ runs: ReviewedRun[] }> | undefined
function reviewedArchive(): Promise<{ runs: ReviewedRun[] }> {
  return archive ||= readFile(path.join(process.cwd(), 'src/demo-data/agent-evidence.json'), 'utf8').then(text => JSON.parse(text))
}

export async function validateHostedCouncilSources(refs: CouncilSourceRef[]) {
  const { runs } = await reviewedArchive()
  for (const ref of refs) {
    if (ref.kind === 'sample') throw new BackendError(400, 'INVALID_SOURCE', 'Choose a reviewed saved agent file for the hosted council.')
    const run = runs.find(item => item.role === ref.role && item.detail.id === ref.runId)
    if (!run || (ref.kind === 'artifact' && !run.contents.some(item => item.index === ref.index))) throw new BackendError(400, 'INVALID_SOURCE', 'This source is not part of the reviewed demo archive.')
  }
}

export async function resolveHostedCouncilSources(business: BusinessInput, refs: CouncilSourceRef[]): Promise<CouncilEvidence[]> {
  await validateHostedCouncilSources(refs)
  const { runs } = await reviewedArchive()
  const sources: CouncilEvidence[] = [{ id: 'S0', title: `${business.company} current profile`, text: JSON.stringify(business, null, 2), provenance: 'User-selected company setup; not independently verified.', kind: 'profile', url: null, companyMatch: 'explicit', warnings: ['Company inputs are user supplied.'] }]
  for (const ref of refs) {
    if (ref.kind === 'sample') continue
    const run = runs.find(item => item.role === ref.role && item.detail.id === ref.runId)!
    const text = ref.kind === 'conversation' ? run.detail.output.conversation || run.detail.output.text || '' : run.contents.find(item => item.index === ref.index)!.content
    if (!text.trim() || Buffer.byteLength(text) > 128 * 1024) throw new BackendError(413, 'SOURCE_TOO_LARGE', 'Choose a nonempty source smaller than 128 KiB.')
    const companyMatch = councilCompanyMatch(text, business)
    sources.push({ id: `S${sources.length}`, title: ref.kind === 'conversation' ? `${ref.role} saved conversation` : run.detail.artifacts.find(item => item.index === ref.index)!.title,
      text, kind: ref.kind, url: ref.kind === 'artifact' ? `/api/agent-runs/${ref.role}/${ref.runId}/artifacts/${ref.index}` : null,
      provenance: `Reviewed CREAO ${ref.role} run ${ref.runId}; explicitly assigned by the visitor. Dated model-generated evidence.`, companyMatch,
      warnings: companyMatch === 'unidentified' ? ['Source company identity is unverified; assignment alone does not establish relevance.'] : [] })
  }
  if (sources.reduce((bytes, item) => bytes + Buffer.byteLength(item.text), 0) > 512 * 1024) throw new BackendError(413, 'EVIDENCE_TOO_LARGE', 'Selected evidence exceeds 512 KiB.')
  return sources
}
