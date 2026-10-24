import { loadEnvFile } from 'node:process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
try { loadEnvFile(path.join(webRoot, '.env')) } catch (error) { if (error.code !== 'ENOENT') throw error }
const [command, argument] = process.argv.slice(2)
const base = process.env.BACKEND_URL || 'http://localhost:3000'
const usage = 'Usage: pnpm backend health|agents|connection ROLE|history ROLE|submit FILE|jobs|job ID|refresh ID|forecast FILE|impact FILE|verify-brief FILE|calculation-health'
try {
  let endpoint
  let body
  const required = () => { if (!argument) throw new Error(usage); return argument }
  switch (command) {
    case 'health': endpoint = 'health'; break
    case 'agents': endpoint = 'agents?limit=100'; break
    case 'connection': endpoint = `connection?agent=${encodeURIComponent(required())}`; break
    case 'history': endpoint = `agents/${encodeURIComponent(required())}/runs?limit=100`; break
    case 'jobs': endpoint = 'jobs?limit=100'; break
    case 'job': endpoint = `jobs/${encodeURIComponent(required())}`; break
    case 'refresh': endpoint = `jobs/${encodeURIComponent(required())}/refresh`; body = '{}'; break
    case 'submit': {
      const request = JSON.parse(await readFile(path.resolve(required()), 'utf8'))
      if (typeof request.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.requestId)) {
        throw new Error('The request file must include a stable requestId UUID, agent role, and inputs object. Save that UUID and reuse the same file to inspect/replay this submission.')
      }
      console.error(JSON.stringify({ requestId: request.requestId, message: 'Keep this request ID. No automatic retries; reuse the same file if the response is lost.' }))
      endpoint = 'jobs'; body = JSON.stringify(request); break
    }
    case 'forecast': case 'impact': case 'verify-brief':
      endpoint = `calculations/${command}`; body = await readFile(path.resolve(required()), 'utf8'); break
    case 'calculation-health': endpoint = 'calculations/health'; body = '{}'; break
    default: throw new Error(usage)
  }
  const token = process.env.BACKEND_API_TOKEN?.trim()
  if (command !== 'health' && !token) throw new Error('Set BACKEND_API_TOKEN in web/.env first.')
  let response
  try {
    response = await fetch(`${base}/api/backend/${endpoint}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body, signal: AbortSignal.timeout(45_000),
    })
  } catch {
    throw new Error('Could not reach the backend. Start pnpm dev or set BACKEND_URL. No automatic retry was made. For submit, inspect your saved requestId with the job command before taking further action.')
  }
  let result
  try { result = await response.json() } catch { throw new Error(`Backend returned HTTP ${response.status} without valid JSON. For submit, inspect your saved requestId before taking further action.`) }
  console.log(JSON.stringify(result, null, 2))
  if (!response.ok) process.exitCode = 1
} catch (error) {
  console.error(JSON.stringify({ error: { message: error.message } }, null, 2))
  process.exitCode = 1
}
