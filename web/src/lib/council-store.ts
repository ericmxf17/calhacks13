import 'server-only'
import { BackendError } from './backend'
import type { CouncilJob, CouncilRole } from './council-types'

export type SavedCouncilSnapshot = { job: CouncilJob; requestHash: string; sessions: Partial<Record<CouncilRole, string>> }
const ownerPattern = /^(user|demo):[A-Za-z0-9._:@-]{1,200}$/
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function councilStoreConfigured(): boolean {
  return ['SPACETIMEDB_URL', 'SPACETIMEDB_DATABASE', 'SPACETIMEDB_TOKEN'].every(key => Boolean(process.env[key]?.trim()))
}
function configuration() {
  if (!councilStoreConfigured()) throw new BackendError(503, 'COUNCIL_STORE_NOT_CONFIGURED', 'Configure SPACETIMEDB_URL, SPACETIMEDB_DATABASE and SPACETIMEDB_TOKEN for saved councils.')
  const url = new URL(process.env.SPACETIMEDB_URL!.trim())
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new BackendError(503, 'COUNCIL_STORE_CONFIGURATION', 'SpacetimeDB requires HTTPS except for local development.')
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new BackendError(503, 'COUNCIL_STORE_CONFIGURATION', 'SPACETIMEDB_URL must be an origin without credentials or a path.')
  return { base: `${url.origin}/v1/database/${encodeURIComponent(process.env.SPACETIMEDB_DATABASE!.trim())}`, token: process.env.SPACETIMEDB_TOKEN!.trim() }
}
function ownerScope(value: string) {
  if (!ownerPattern.test(value)) throw new BackendError(400, 'INVALID_COUNCIL_OWNER', 'A server-verified user or demo owner scope is required.')
  return value
}
function runId(value: string) {
  if (!uuidPattern.test(value)) throw new BackendError(400, 'INVALID_REQUEST_ID', 'A UUID council id is required.')
  return value.toLowerCase()
}
// SQL has no bind parameters here. Every value is escaped as a SQL string literal;
// table and column names are fixed, never supplied by a caller.
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`
async function request(endpoint: string, body: string, contentType: string) {
  const config = configuration()
  let response: Response
  try {
    response = await fetch(`${config.base}/${endpoint}`, { method: 'POST', headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': contentType }, body, cache: 'no-store', signal: AbortSignal.timeout(15000) })
  } catch {
    throw new BackendError(503, 'COUNCIL_STORE_UNAVAILABLE', 'The saved council archive is unreachable. Retry when SpacetimeDB is available.')
  }
  if (!response.ok) {
    if (endpoint === 'call/reserve_council_snapshot') {
      const detail = await response.text()
      if (detail.includes('COUNCIL_RATE_LIMIT')) throw new BackendError(429, 'COUNCIL_RATE_LIMIT', 'The live council has reached its current execution limit. Try again after an active discussion finishes or the daily allowance resets at UTC midnight.')
      if (detail.includes('COUNCIL_REQUEST_EXISTS')) throw new BackendError(409, 'REQUEST_ID_CONFLICT', 'This request ID is already reserved. Read its saved state before retrying.')
    }
    throw new BackendError(503, 'COUNCIL_STORE_FAILED', `The saved council archive rejected the operation (HTTP ${response.status}). Check its server configuration and module logs.`)
  }
  return response
}
async function snapshots(query: string): Promise<SavedCouncilSnapshot[]> {
  const result: unknown = await (await request('sql', query, 'text/plain')).json()
  if (!Array.isArray(result) || result.length !== 1 || !Array.isArray(result[0]?.rows)) throw new BackendError(502, 'COUNCIL_STORE_INVALID_RESPONSE', 'The saved council archive returned invalid rows.')
  return result[0].rows.map((row: unknown) => {
    if (!Array.isArray(row) || typeof row[0] !== 'string') throw new BackendError(502, 'COUNCIL_STORE_INVALID_RESPONSE', 'The saved council archive returned an invalid snapshot.')
    const saved = JSON.parse(row[0]) as SavedCouncilSnapshot
    if (!saved?.job || !uuidPattern.test(saved.job.id) || typeof saved.requestHash !== 'string' || !saved.sessions) throw new BackendError(502, 'COUNCIL_STORE_INVALID_RESPONSE', 'The saved council archive contains an invalid snapshot.')
    return saved
  })
}
export async function saveCouncilSnapshot(owner: string, saved: SavedCouncilSnapshot): Promise<void> {
  ownerScope(owner)
  if (saved.job.id !== runId(saved.job.id)) throw new BackendError(400, 'INVALID_REQUEST_ID', 'Council ids must use lowercase UUIDs.')
  const snapshot = JSON.stringify(saved)
  if (Buffer.byteLength(snapshot) > 2 * 1024 * 1024) throw new BackendError(413, 'COUNCIL_SNAPSHOT_TOO_LARGE', 'Saved council snapshots must be smaller than 2 MiB.')
  await request('call/save_council_snapshot', JSON.stringify([owner, snapshot]), 'application/json')
}
export async function reserveCouncilSnapshot(owner: string, saved: SavedCouncilSnapshot): Promise<void> {
  ownerScope(owner)
  const bounded = (key: string, fallback: number, maximum: number) => {
    const value = Number(process.env[key] || fallback)
    return Number.isSafeInteger(value) && value > 0 && value <= maximum ? value : fallback
  }
  await request('call/reserve_council_snapshot', JSON.stringify([owner, JSON.stringify(saved), bounded('COUNCIL_DAILY_ROUND_LIMIT', 40, 1000), bounded('COUNCIL_CONCURRENT_LIMIT', 2, 8)]), 'application/json')
}
export async function readCouncilSnapshot(owner: string, id: string): Promise<SavedCouncilSnapshot | null> {
  const rows = await snapshots(`SELECT snapshot_json FROM council_snapshot WHERE owner_scope = ${literal(ownerScope(owner))} AND run_id = ${literal(runId(id))}`)
  return rows[0] || null
}
export async function listCouncilSnapshots(owner: string, businessKey?: string): Promise<CouncilJob[]> {
  if (businessKey !== undefined && !/^[a-f0-9]{16}$/.test(businessKey)) throw new BackendError(400, 'INVALID_BUSINESS_KEY', 'A valid company profile key is required.')
  const company = businessKey === undefined ? '' : ` AND company_key = ${literal(businessKey)}`
  const rows = await snapshots(`SELECT snapshot_json FROM council_snapshot WHERE owner_scope = ${literal(ownerScope(owner))}${company}`)
  return rows.map(saved => saved.job).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
export async function councilStoreReadiness(): Promise<{ configured: boolean; available: boolean; message: string | null }> {
  if (!councilStoreConfigured()) return { configured: false, available: false, message: 'Configure SPACETIMEDB_URL, SPACETIMEDB_DATABASE and SPACETIMEDB_TOKEN for saved councils.' }
  try {
    // Reading the private admin table verifies publisher access without fetching transcripts.
    const result = await (await request('sql', 'SELECT identity FROM archive_admin', 'text/plain')).json()
    if (!Array.isArray(result) || !Array.isArray(result[0]?.rows) || result[0].rows.length !== 1) throw new Error('Archive admin missing')
    return { configured: true, available: true, message: null }
  } catch {
    return { configured: true, available: false, message: 'The saved council archive is unavailable. Check the database, publisher token and module schema.' }
  }
}
