import { BackendError } from '@/lib/backend'
import { createAgentRun, privateHeaders, readAgentRuns } from '@/lib/agent-run-reader'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function failure(error: unknown) {
  const status = error instanceof BackendError ? error.status : 502
  const code = error instanceof BackendError ? error.code : 'AGENT_UNAVAILABLE'
  const message = status === 403 ? 'Agent preview is unavailable here.'
    : [400, 404, 409, 413, 415].includes(status) || code === 'AGENT_NOT_CONFIGURED'
      ? (error as BackendError).message : 'The agent request could not be completed. Check the saved request before trying again.'
  return Response.json({ error: { code, message } }, { status, headers: privateHeaders })
}

type Context = { params: Promise<{ path: string[] }> }
export async function GET(request: Request, context: Context) {
  try {
    return await readAgentRuns(request, (await context.params).path)
  } catch (error) { return failure(error) }
}

export async function POST(request: Request, context: Context) {
  try { return await createAgentRun(request, (await context.params).path) }
  catch (error) { return failure(error) }
}
