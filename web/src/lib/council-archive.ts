import 'server-only'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { BackendError } from './backend'
import { findDemoCompany } from './demo-companies'
import { councilBusinessKey, type CouncilJob, type CouncilThread } from './council-types'
import { councilDemoId } from './council-demo'
import { demoCouncilCatalog } from './demo-council-catalog'
import { councilStoreConfigured, listCouncilSnapshots, readCouncilSnapshot, saveCouncilSnapshot, type SavedCouncilSnapshot } from './council-store'

function demoOwner(id: string) {
  const demo = findDemoCompany(id)
  if (!demo) throw new BackendError(404, 'DEMO_NOT_FOUND', 'Choose one of the prepared demo companies.')
  return { owner: `demo:${demo.id}`, businessKey: councilBusinessKey(demo.business) }
}

async function localSnapshots(): Promise<SavedCouncilSnapshot[]> {
  const root = path.resolve(process.env.COUNCIL_DATA_DIR || path.join(process.cwd(), '.backend', 'council'))
  let entries
  try { entries = await readdir(/* turbopackIgnore: true */ root, { withFileTypes: true }) }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error }
  const saved: SavedCouncilSnapshot[] = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^[a-f0-9-]{36}$/i.test(entry.name)) continue
    try { saved.push(JSON.parse(await readFile(/* turbopackIgnore: true */ path.join(root, entry.name, 'job.json'), 'utf8'))) }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  }
  return saved
}

export async function listDemoCouncils(id: string): Promise<CouncilJob[]> {
  const { owner, businessKey } = demoOwner(id)
  const jobs = councilStoreConfigured()
    ? await listCouncilSnapshots(owner, businessKey)
    : process.env.NODE_ENV === 'development' ? (await localSnapshots()).map(saved => saved.job) : []
  const latest = new Map<string, CouncilJob>()
  for (const job of jobs) {
    if (demoCouncilCatalog[job.id]?.demoId !== id || job.status !== 'completed' || job.businessKey !== businessKey || councilDemoId(job.business) !== id) continue
    const rootId = job.rootJobId || job.id
    if (!latest.has(rootId) || latest.get(rootId)!.updatedAt < job.updatedAt) latest.set(rootId, job)
  }
  return [...latest.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** Archive reads never run a model or reinterpret another process's running state. */
export async function readDemoCouncilThread(id: string, leafId: string): Promise<CouncilThread> {
  if (demoCouncilCatalog[leafId]?.demoId !== id) throw new BackendError(404, 'JOB_NOT_FOUND', 'This discussion is not part of the shared demo collection.')
  const { owner, businessKey } = demoOwner(id)
  const rounds: CouncilJob[] = []
  const visited = new Set<string>()
  let current: string | null = leafId
  while (current) {
    if (visited.has(current) || rounds.length >= 4) throw new BackendError(409, 'INVALID_COUNCIL_THREAD', 'The saved conversation has an invalid history.')
    visited.add(current)
    const saved = await readCouncilSnapshot(owner, current)
    if (!saved || saved.job.businessKey !== businessKey || councilDemoId(saved.job.business) !== id) throw new BackendError(404, 'JOB_NOT_FOUND', 'This conversation does not belong to the selected demo company.')
    if (saved.job.status !== 'completed') throw new BackendError(409, 'COUNCIL_NOT_COMPLETE', 'This saved conversation is not complete yet.')
    rounds.unshift(saved.job)
    current = saved.job.previousJobId ?? null
  }
  if (!rounds.length) throw new BackendError(404, 'JOB_NOT_FOUND', 'Choose a saved conversation.')
  const root = rounds[0]
  if (rounds.some((round, index) => round.rootJobId !== root.id || round.round !== index + 1)) throw new BackendError(409, 'INVALID_COUNCIL_THREAD', 'The saved conversation has inconsistent rounds.')
  return { rootJobId: root.id, rounds }
}

export async function archiveLocalDemoCouncils() {
  if (!councilStoreConfigured()) throw new BackendError(503, 'COUNCIL_STORE_NOT_CONFIGURED', 'Configure the SpacetimeDB archive before importing demo conversations.')
  const imported: { id: string; demoId: string; status: string }[] = []
  for (const saved of await localSnapshots()) {
    const demoId = councilDemoId(saved.job.business)
    if (!demoId || saved.job.status !== 'completed') continue
    await saveCouncilSnapshot(`demo:${demoId}`, saved)
    imported.push({ id: saved.job.id, demoId, status: saved.job.status })
  }
  return { imported }
}
