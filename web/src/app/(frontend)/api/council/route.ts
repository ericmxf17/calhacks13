import { BackendError, readBody } from '@/lib/backend'
import { privateHeaders, requireLocalAgentPreview } from '@/lib/agent-run-reader'
import { councilSetup, councilSourceOptions, readCouncilJob, readCouncilThread, submitCouncil } from '@/lib/council'
import { listDemoCouncils, readDemoCouncilThread } from '@/lib/council-archive'
import { councilStoreReadiness } from '@/lib/council-store'
import { findDemoCompany } from '@/lib/demo-companies'
import { demoCouncilCatalog } from '@/lib/demo-council-catalog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
function failure(error: unknown) {
  const known = error instanceof BackendError
  return Response.json({ error: { code: known ? error.code : 'COUNCIL_UNAVAILABLE', message: known ? error.message : 'The council request could not be completed. Keep the saved request ID and inspect its state before retrying.' } }, { status: known ? error.status : 502, headers: privateHeaders })
}
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams
    const demo = query.get('demo')
    if (query.get('view') === 'history' && demo && findDemoCompany(demo)) {
      const jobs = await listDemoCouncils(demo)
      return Response.json({ conversations: jobs.map(job => ({ id: job.id, rootJobId: job.rootJobId, question: demoCouncilCatalog[job.id]?.title || job.question, status: job.status, round: job.round, updatedAt: job.updatedAt })) }, { headers: privateHeaders })
    }
    if (process.env.NODE_ENV === 'production' || process.env.CONSUL_JUDGE_DEMO === 'true') {
      if (!demo || !findDemoCompany(demo)) throw new BackendError(403, 'DEMO_REQUIRED', 'Open a prepared demo company to read its saved conversations.')
      if (query.get('view') === 'setup') {
        const archive = await councilStoreReadiness()
        return Response.json({ mode: 'archive', available: false, message: archive.available ? 'Browse completed council conversations. New runs are started on the team runner and saved here.' : archive.message, capabilities: ['Saved discussions', 'Cited source snapshots', 'Decision history'], roles: [] }, { headers: privateHeaders })
      }
      if (query.get('view') === 'thread') return Response.json(await readDemoCouncilThread(demo, query.get('jobId') || ''), { headers: privateHeaders })
      throw new BackendError(403, 'ARCHIVE_READ_ONLY', 'The hosted demo serves saved conversations. New runs start on the team runner.')
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
  try {
    if (process.env.NODE_ENV === 'production' || process.env.CONSUL_JUDGE_DEMO === 'true') throw new BackendError(403, 'ARCHIVE_READ_ONLY', 'The judge demo contains saved discussions. New councils start on the team runner.')
    requireLocalAgentPreview(request)
    const url = new URL(request.url)
    if (request.headers.get('origin') !== `${url.protocol}//${request.headers.get('host')}` || request.headers.get('sec-fetch-site') !== 'same-origin') throw new BackendError(403, 'PREVIEW_UNAVAILABLE', 'Council submission requires the local application origin.')
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new BackendError(415, 'INVALID_INPUT', 'Send the council request as JSON.')
    return Response.json(await submitCouncil(await readBody(request)), { status: 202, headers: privateHeaders })
  } catch (error) { return failure(error) }
}
