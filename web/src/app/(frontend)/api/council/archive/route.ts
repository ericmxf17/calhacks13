import { archiveLocalDemoCouncils } from '@/lib/council-archive'
import { backendFailure, requireBackendAccess } from '@/lib/backend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    requireBackendAccess(request)
    if (process.env.NODE_ENV !== 'development') return Response.json({ error: 'Import saved examples from the local runner.' }, { status: 403 })
    return Response.json(await archiveLocalDemoCouncils(), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return backendFailure(error) }
}
