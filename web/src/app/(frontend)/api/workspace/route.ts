import { getPayload } from 'payload'
import { appAuth } from '@/lib/app-auth'
import { validateBusiness } from '@/lib/business-input'

export async function GET() {
  if (process.env.CONSUL_JUDGE_DEMO === 'true')
    return Response.json({ user: null, demoOnly: true }, { headers: { 'Cache-Control': 'no-store' } })
  const user = await appAuth.currentUser()
  if (!user) return Response.json({ user: null })
  const { default: config } = await import('@payload-config')
  const payload = await getPayload({ config })
  const account = await payload.findByID({
    collection: 'users',
    id: user.id,
    user,
    overrideAccess: false,
  })
  return Response.json(
    { user: { email: account.email }, business: account.business },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}

export async function POST(request: Request) {
  if (process.env.CONSUL_JUDGE_DEMO === 'true')
    return Response.json({ error: 'This deployment offers saved demos. Account sign-in and private workspaces are not enabled.' }, { status: 503 })
  if (request.headers.get('sec-fetch-site') === 'cross-site')
    return Response.json({ error: 'Request not allowed.' }, { status: 403 })
  try {
    const body = await request.json()
    if (body.action === 'logout') {
      await appAuth.logout()
      return Response.json({ ok: true })
    }
    const { default: config } = await import('@payload-config')
    const payload = await getPayload({ config })
    if (body.action === 'signup' || body.action === 'login') {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      const password = typeof body.password === 'string' ? body.password : ''
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254 ||
        password.length < 8 ||
        password.length > 128
      ) {
        return Response.json(
          { error: 'Enter a valid email and a password of 8–128 characters.' },
          { status: 400 },
        )
      }
      if (body.action === 'signup')
        await payload.create({
          collection: 'users',
          data: { email, password },
          overrideAccess: false,
        })
      await appAuth.login(email, password)
      return Response.json({ ok: true })
    }
    const user = await appAuth.currentUser()
    if (!user) return Response.json({ error: 'Please sign in again.' }, { status: 401 })
    if (body.action !== 'setup') return Response.json({ error: 'Unknown action.' }, { status: 400 })
    const business = validateBusiness(body.business)
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { business },
      overrideAccess: false,
      user,
    })
    return Response.json({ ok: true })
  } catch (error) {
    const safe =
      error instanceof Error &&
      /^(Please |Prices |Add |Upload |Invalid business)/.test(error.message)
    return Response.json(
      {
        error: safe
          ? (error as Error).message
          : 'Unable to continue. Check your details, or try signing in if you already have an account.',
      },
      { status: 400 },
    )
  }
}
