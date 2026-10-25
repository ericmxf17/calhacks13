import { NextResponse, type NextRequest } from 'next/server'

/** Judge mode exposes the prepared demo, not an unconfigured CMS or execution API. */
export function proxy(request: NextRequest) {
  if (process.env.CONSUL_JUDGE_DEMO !== 'true') return NextResponse.next()
  const pathname = request.nextUrl.pathname
  const demoApi = pathname === '/api/workspace' || pathname === '/api/council' || pathname.startsWith('/api/agent-runs/')
  if (pathname.startsWith('/admin') || !demoApi) {
    return NextResponse.json({ error: 'This endpoint is not part of the prepared judge demo.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }
  return NextResponse.next()
}

export const config = { matcher: ['/admin/:path*', '/api/:path*'] }
