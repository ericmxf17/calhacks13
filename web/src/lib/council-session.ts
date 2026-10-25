import 'server-only'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { BackendError } from './backend'

const cookieName = 'consul_council_session'
export function councilBrowserSession(request: Request): { owner: string; cookie?: string } {
  const secret = process.env.COUNCIL_SESSION_SECRET?.trim()
  if (!secret || secret.length < 32) throw new BackendError(503, 'COUNCIL_SESSION_NOT_CONFIGURED', 'The live council session is not configured.')
  const sign = (payload: string) => createHmac('sha256', secret).update(payload).digest('hex')
  const now = Math.floor(Date.now() / 1000)
  const maxAge = 30 * 24 * 60 * 60
  const value = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1)
  if (value && /^[a-f0-9]{64}\.\d{10,12}\.[a-f0-9]{64}$/.test(value)) {
    const [owner, expires, signature] = value.split('.')
    if (Number(expires) > now && timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(sign(`${owner}.${expires}`), 'hex'))) return { owner }
  }
  const owner = randomBytes(32).toString('hex')
  const payload = `${owner}.${now + maxAge}`
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return { owner, cookie: `${cookieName}=${payload}.${sign(payload)}; HttpOnly${secure}; SameSite=Lax; Path=/api/council; Max-Age=${maxAge}` }
}
