import 'server-only'

import { execFile } from 'node:child_process'
import { timingSafeEqual } from 'node:crypto'
import path from 'node:path'

export class BackendError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message)
  }
}

// The local caller token is separate from every provider credential.
export function requireBackendAccess(request: Request) {
  const token = process.env.BACKEND_API_TOKEN?.trim()
  if (!token) throw new BackendError(503, 'BACKEND_NOT_CONFIGURED', 'Set BACKEND_API_TOKEN in web/.env.')
  const expected = Buffer.from(`Bearer ${token}`)
  const supplied = Buffer.from(request.headers.get('authorization') || '')
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new BackendError(401, 'UNAUTHORIZED', 'A valid backend bearer token is required.')
  }
}
export function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BackendError(400, 'INVALID_INPUT', `${label} must be a JSON object.`)
  }
  return value as Record<string, unknown>
}

export async function readBody(request: Request) {
  const text = await request.text()
  if (Buffer.byteLength(text) > 1024 * 1024) {
    throw new BackendError(413, 'INPUT_TOO_LARGE', 'The request must be smaller than 1 MB.')
  }
  try {
    return object(JSON.parse(text), 'Request body')
  } catch (error) {
    if (error instanceof BackendError) throw error
    throw new BackendError(400, 'INVALID_JSON', 'Send a valid JSON request body.')
  }
}

export function backendFailure(error: unknown) {
  const failure = error instanceof BackendError
    ? error
    : new BackendError(500, 'BACKEND_ERROR', 'The backend could not complete this request.')
  return Response.json(
    { error: { code: failure.code, message: failure.message } },
    { status: failure.status, headers: { 'Cache-Control': 'no-store' } },
  )
}

export type Calculation = 'health' | 'forecast' | 'impact' | 'verify-brief'

export function calculate(operation: Calculation, input: Record<string, unknown> = {}): Promise<unknown> {
  const root = path.resolve(process.env.BACKEND_REPO_ROOT || path.join(process.cwd(), '..'))
  const python = process.env.PYTHON_BINARY || 'python'
  return new Promise((resolve, reject) => {
    const child = execFile(
      python,
      ['-X', 'utf8', path.join(root, 'backend', 'worker.py'), operation],
      { cwd: root, windowsHide: true, timeout: 30_000, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout) => {
        if (error && 'code' in error && error.code === 'ENOENT') {
          reject(new BackendError(503, 'PYTHON_UNAVAILABLE', 'Python is unavailable. Set PYTHON_BINARY to your installed Python executable.'))
          return
        }
        let envelope: Record<string, unknown>
        try {
          const parsed: unknown = JSON.parse(stdout)
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid worker response')
          envelope = parsed as Record<string, unknown>
        } catch {
          reject(new BackendError(502, 'CALCULATION_FAILED', 'The Python calculation worker failed or timed out. Check PYTHON_BINARY and BACKEND_REPO_ROOT.'))
          return
        }
        if (envelope.ok === true && !error) {
          resolve(envelope.result)
        } else {
          const detail = envelope.error as { code?: string; message?: string } | undefined
          reject(new BackendError(400, detail?.code || 'INVALID_INPUT', detail?.message || 'The calculation input is invalid.'))
        }
      },
    )
    child.stdin?.on('error', () => reject(new BackendError(502, 'CALCULATION_FAILED', 'Could not send input to the Python calculation worker.')))
    child.stdin?.end(JSON.stringify(input))
  })
}
