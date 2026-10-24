import { BackendError } from '@/lib/backend'
import { privateHeaders, readAgentRuns } from '@/lib/agent-run-reader'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    return await readAgentRuns(request, (await context.params).path)
  } catch (error) {
    const status = error instanceof BackendError ? error.status : 502
    const code = error instanceof BackendError ? error.code : 'AGENT_UNAVAILABLE'
    const message = status === 403 ? 'Agent preview is unavailable here.'
      : status === 400 || status === 404 || status === 415 || code === 'AGENT_NOT_CONFIGURED'
        ? (error as BackendError).message : 'The agent information could not be loaded. Try again.'
    return Response.json({ error: { code, message } }, { status, headers: privateHeaders })
  }
}
