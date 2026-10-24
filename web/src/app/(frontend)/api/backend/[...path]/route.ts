import { BackendError, backendFailure, calculate, readBody, requireBackendAccess } from '@/lib/backend'
import { checkConnection, listAgents, listRuns } from '@/lib/creao'
import { createJob, listJobs, readJob, refreshJob } from '@/lib/jobs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ path: string[] }> }
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(data, {
  status, headers: { 'Cache-Control': 'no-store', ...headers },
})
function integer(value: string | null, fallback: number, min: number, max: number) {
  const parsed = value === null ? fallback : Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new BackendError(400, 'INVALID_INPUT', `Pagination must be an integer between ${min} and ${max}.`)
  }
  return parsed
}
export async function GET(request: Request, context: Context) {
  try {
    const { path } = await context.params
    if (path.length === 1 && path[0] === 'health') return json({ ok: true })
    requireBackendAccess(request)
    const url = new URL(request.url)
    const limit = () => integer(url.searchParams.get('limit'), 20, 1, 100)
    const offset = () => integer(url.searchParams.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER)
    if (path.length === 1 && path[0] === 'connection') return json(await checkConnection(url.searchParams.get('agent')))
    if (path.length === 1 && path[0] === 'agents') return json(listAgents(limit(), offset()))
    if (path.length === 3 && path[0] === 'agents' && path[2] === 'runs') return json(await listRuns(path[1], limit(), offset()))
    if (path.length === 1 && path[0] === 'jobs') return json(await listJobs(limit(), offset()))
    if (path.length === 2 && path[0] === 'jobs') return json(await readJob(path[1]))
    throw new BackendError(404, 'NOT_FOUND', 'Unknown backend endpoint.')
  } catch (error) { return backendFailure(error) }
}
export async function POST(request: Request, context: Context) {
  try {
    requireBackendAccess(request)
    const { path } = await context.params
    if (path.length === 3 && path[0] === 'jobs' && path[2] === 'refresh') return json(await refreshJob(path[1]))
    const body = await readBody(request)
    if (path.length === 1 && path[0] === 'jobs') {
      const job = await createJob(body)
      return json(job, 202, { Location: `/api/backend/jobs/${job.id}` })
    }
    if (path.length === 2 && path[0] === 'calculations') {
      const operation = path[1]
      if (operation === 'forecast' || operation === 'impact' || operation === 'verify-brief' || operation === 'health') {
        return json(await calculate(operation, body))
      }
    }
    throw new BackendError(404, 'NOT_FOUND', 'Unknown backend endpoint.')
  } catch (error) { return backendFailure(error) }
}
