import 'server-only'

import { BackendError } from './backend'
import { councilSandboxConfigured, councilWorkerOrigin } from './council-sandbox'

export function councilWorkerConfigured() {
  return (!!process.env.COUNCIL_WORKER_URL?.trim() || councilSandboxConfigured()) && !!process.env.COUNCIL_WORKER_TOKEN?.trim()
}

/** The hosted app sends its own worker credentials, never browser credentials. */
export async function councilWorkerRequest<T>(path: string, owner: string, body?: unknown): Promise<T> {
  const token = process.env.COUNCIL_WORKER_TOKEN?.trim()
  if (!councilWorkerConfigured() || !token) throw new BackendError(503, 'COUNCIL_WORKER_NOT_CONFIGURED', 'The live council runner is not connected. Saved conversations remain available.')
  const base = await councilWorkerOrigin()
  let url: URL
  try { url = new URL(path, base) }
  catch { throw new BackendError(503, 'COUNCIL_WORKER_NOT_CONFIGURED', 'The live council runner connection is not configured correctly.') }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw new BackendError(503, 'COUNCIL_WORKER_NOT_CONFIGURED', 'The live council runner requires a secure connection.')
  }
  let response: Response
  try {
    response = await fetch(url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${token}`, 'x-council-owner': owner, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(25_000),
    })
  } catch {
    throw new BackendError(502, 'COUNCIL_WORKER_UNAVAILABLE', 'The council runner could not be reached. Keep the saved request ID and check its status before retrying.')
  }
  let result: { error?: { code?: unknown; message?: unknown } }
  try { result = await response.json() }
  catch { throw new BackendError(502, 'COUNCIL_WORKER_UNAVAILABLE', 'The council runner returned an unreadable response. Keep the saved request ID and check its status before retrying.') }
  if (!response.ok) {
    const error = result?.error
    throw new BackendError(response.status, typeof error?.code === 'string' ? error.code : 'COUNCIL_WORKER_UNAVAILABLE', typeof error?.message === 'string' ? error.message : 'The council runner could not complete this request.')
  }
  return result as T
}
