import { BackendError } from '@/lib/backend'
import { createAgentRun, privateHeaders, readAgentRuns } from '@/lib/agent-run-reader'
import { readDemoAgentRuns } from '@/lib/demo-agent-evidence'

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
    const path = (await context.params).path
    if (process.env.NODE_ENV === 'production' || process.env.CONSUL_JUDGE_DEMO === 'true') {
      return readDemoAgentRuns(path, new URL(request.url)) || Response.json({ error: { code: 'NOT_FOUND', message: 'This agent is not in the prepared demo archive.' } }, { status: 404, headers: privateHeaders })
    }
    return await readAgentRuns(request, path)
  } catch (error) { return failure(error) }
}

export async function POST(request: Request, context: Context) {
  try {
    if (process.env.NODE_ENV === 'production' || process.env.CONSUL_JUDGE_DEMO === 'true') throw new BackendError(403, 'ARCHIVE_READ_ONLY', 'The judge demo contains completed runs. New executions start on the team runner.')
    return await createAgentRun(request, (await context.params).path)
  }
  catch (error) { return failure(error) }
}
