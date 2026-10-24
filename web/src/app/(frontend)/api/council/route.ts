import { BackendError, readBody } from '@/lib/backend'
import { privateHeaders, requireLocalAgentPreview } from '@/lib/agent-run-reader'
import { councilSetup, councilSourceOptions, readCouncilJob, submitCouncil } from '@/lib/council'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
function failure(error: unknown) {
  const known = error instanceof BackendError
  return Response.json({ error: { code: known ? error.code : 'COUNCIL_UNAVAILABLE', message: known ? error.message : 'The council request could not be completed. Keep the saved request ID and inspect its state before retrying.' } }, { status: known ? error.status : 502, headers: privateHeaders })
}
export async function GET(request: Request) {
  try {
    requireLocalAgentPreview(request)
    const query = new URL(request.url).searchParams
    if (query.get('view') === 'setup') return Response.json(await councilSetup(), { headers: privateHeaders })
    if (query.get('view') === 'sources') {
      const rawOffset = query.get('offset') || '0'
      if (!/^\d+$/.test(rawOffset) || !Number.isSafeInteger(Number(rawOffset))) throw new BackendError(400, 'INVALID_INPUT', 'Choose a valid source page offset.')
      return Response.json(await councilSourceOptions(query.get('role'), Number(rawOffset)), { headers: privateHeaders })
    }
    return Response.json(await readCouncilJob(query.get('jobId')), { headers: privateHeaders })
  } catch (error) { return failure(error) }
}
export async function POST(request: Request) {
  try {
    requireLocalAgentPreview(request)
    const url = new URL(request.url)
    if (request.headers.get('origin') !== `${url.protocol}//${request.headers.get('host')}` || request.headers.get('sec-fetch-site') !== 'same-origin') throw new BackendError(403, 'PREVIEW_UNAVAILABLE', 'Council submission requires the local application origin.')
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new BackendError(415, 'INVALID_INPUT', 'Send the council request as JSON.')
    return Response.json(await submitCouncil(await readBody(request)), { status: 202, headers: privateHeaders })
  } catch (error) { return failure(error) }
}
