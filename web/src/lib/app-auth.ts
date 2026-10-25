import 'server-only'
import { cookies } from 'next/headers'
import { getPayload, JWTAuthentication } from 'payload'

export function createAppAuth(collection: 'users') {
  return {
    async currentUser() {
      if (process.env.CONSUL_JUDGE_DEMO === 'true') return null
      const token = (await cookies()).get('app-session')?.value
      if (!token) return null
      const { default: config } = await import('@payload-config')
      const payload = await getPayload({ config })
      const headers = new Headers({ Authorization: `JWT ${token}` })
      let { user } = await payload.auth({ headers })
      // Development HMR can retain the pre-signup auth strategy registry.
      // Use Payload's own verifier until a fresh runtime registers local JWT auth.
      if (!user && !payload.authStrategies.some(s => s.name === 'local-jwt')) {
        const result = await JWTAuthentication({ headers, payload })
        user = result.user
      }
      return user?.collection === collection ? user : null
    },
    async login(email: string, password: string) {
      const { default: config } = await import('@payload-config')
      const payload = await getPayload({ config })
      const result = await payload.login({ collection, data: { email, password } })
      if (!result.token) throw new Error('Sign-in failed')
      ;(await cookies()).set('app-session', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      })
    },
    async logout() {
      ;(await cookies()).delete('app-session')
    },
  }
}

export const appAuth = createAppAuth('users')
