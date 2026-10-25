import 'server-only'
import { Sandbox } from '@vercel/sandbox'
import { BackendError } from './backend'

export function councilSandboxConfigured(): boolean {
  return !!process.env.COUNCIL_SANDBOX_SNAPSHOT_ID?.trim()
}

const workerPort = 3003
let origin: Promise<string> | undefined
let checkedAt = 0

function workerEnvironment(): Record<string, string> {
  const env: Record<string, string> = {
    COUNCIL_WORKER_HOST: '0.0.0.0', COUNCIL_WORKER_PORT: String(workerPort),
    DROID_EXECUTABLE: '/vercel/.local/bin/droid',
    PYTHON_BINARY: 'python3', BACKEND_REPO_ROOT: '/vercel/app',
    COUNCIL_DATA_DIR: '/vercel/app/web/.backend/council',
  }
  for (const [key, value] of Object.entries(process.env)) {
    if (value && (key === 'FACTORY_API_KEY' || key === 'COUNCIL_WORKER_TOKEN' || key.startsWith('SPACETIMEDB_') || /^COUNCIL_(?:FINANCE|OPERATIONS|SKEPTIC|CHAIR)_(?:MODEL_ID|REASONING_EFFORT)$/.test(key) || ['COUNCIL_MODEL_ID', 'COUNCIL_REASONING_EFFORT', 'COUNCIL_DAILY_ROUND_LIMIT', 'COUNCIL_CONCURRENT_LIMIT'].includes(key))) env[key] = value
  }
  return env
}

async function connectWorker(): Promise<string> {
  const snapshotId = process.env.COUNCIL_SANDBOX_SNAPSHOT_ID!.trim()
  // Four reusable slots start twenty minutes apart. Every submission gets at
  // least twenty-five minutes before expiry; earlier generations finish while
  // the current one accepts work. DB reservations make cross-worker reads safe.
  const slot = Math.floor(Date.now() / (20 * 60 * 1000)) % 4
  const token = process.env.COUNCIL_SANDBOX_VERCEL_TOKEN?.trim()
  const credentials = token ? { token, teamId: process.env.VERCEL_TEAM_ID!, projectId: process.env.VERCEL_PROJECT_ID! } : {}
  const sandbox = await Sandbox.getOrCreate({
    ...credentials, name: `consul-council-${snapshotId.slice(-20).toLowerCase()}-${slot}`,
    source: { type: 'snapshot', snapshotId }, ports: [workerPort],
    timeout: 45 * 60 * 1000, persistent: true, resume: true,
  })
  const url = sandbox.domain(workerPort)
  const headers = { authorization: `Bearer ${process.env.COUNCIL_WORKER_TOKEN}` }
  try {
    if ((await fetch(`${url}/health`, { headers, signal: AbortSignal.timeout(3000), cache: 'no-store' })).ok) return url
  } catch { /* A resumed filesystem needs its server process started again. */ }
  await sandbox.runCommand({
    cmd: 'node', args: ['--experimental-transform-types', 'scripts/council-worker.mjs'],
    cwd: '/vercel/app/web', env: workerEnvironment(), detached: true,
  })
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      if ((await fetch(`${url}/health`, { headers, signal: AbortSignal.timeout(2000), cache: 'no-store' })).ok) return url
    } catch { /* Poll until the detached server is listening. */ }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new BackendError(503, 'COUNCIL_WORKER_UNAVAILABLE', 'The hosted council runner is starting. Keep the same request ID and retry shortly.')
}

/** Named persistent sandboxes resume their saved filesystem after expiry. */
export async function councilWorkerOrigin(): Promise<string> {
  if (!councilSandboxConfigured()) return process.env.COUNCIL_WORKER_URL!.trim()
  if (!origin || Date.now() - checkedAt > 30_000) {
    checkedAt = Date.now()
    origin = connectWorker().catch(error => { origin = undefined; throw error })
  }
  return origin
}

