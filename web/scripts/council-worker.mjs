#!/usr/bin/env node
// Persistent council execution host. Publish only this authenticated loopback
// listener through an HTTPS tunnel; provider credentials never leave this host.
// Run from web: node --env-file=.env --env-file=.env.worker --experimental-transform-types scripts/council-worker.mjs
import { createServer } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFile } from 'node:fs/promises'

const webRoot = fileURLToPath(new URL('..', import.meta.url))
process.chdir(webRoot)
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'server-only') return { url: 'data:text/javascript,export {}', shortCircuit: true }
  if (specifier.startsWith('@/')) return next(pathToFileURL(path.join(webRoot, 'src', `${specifier.slice(2)}.ts`)).href, context)
  if (context.parentURL?.endsWith('.ts') && specifier.startsWith('.') && !path.extname(specifier)) return next(`${specifier}.ts`, context)
  return next(specifier, context)
} })

const council = await import('../src/lib/council.ts')
const { BackendError } = await import('../src/lib/backend.ts')
const reviewed = JSON.parse(await readFile(path.join(webRoot, 'src/demo-data/agent-evidence.json'), 'utf8'))
const token = process.env.COUNCIL_WORKER_TOKEN?.trim()
if (!token || token.length < 32) throw new Error('Set COUNCIL_WORKER_TOKEN to a random secret of at least 32 characters.')
const port = Number(process.env.COUNCIL_WORKER_PORT || 3003)
const host = process.env.COUNCIL_WORKER_HOST || '127.0.0.1'
if (!['127.0.0.1', '0.0.0.0'].includes(host)) throw new Error('Choose a loopback or sandbox listener host.')
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('COUNCIL_WORKER_PORT must be a valid unprivileged port.')
const expected = Buffer.from(`Bearer ${token}`)

function respond(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
  response.end(JSON.stringify(value))
}
async function body(request) {
  if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new BackendError(415, 'INVALID_INPUT', 'Send a JSON council request.')
  const chunks = []
  let bytes = 0
  for await (const chunk of request) {
    bytes += chunk.length
    if (bytes > 1024 * 1024) throw new BackendError(413, 'INPUT_TOO_LARGE', 'The request must be smaller than one megabyte.')
    chunks.push(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new BackendError(400, 'INVALID_JSON', 'Send a valid JSON council request.') }
}

const server = createServer(async (request, response) => {
  try {
    const supplied = Buffer.from(request.headers.authorization || '')
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new BackendError(401, 'UNAUTHORIZED', 'A valid worker bearer token is required.')
    const url = new URL(request.url, 'http://127.0.0.1')
    if (request.method === 'GET' && url.pathname === '/health') return respond(response, 200, { ok: true, service: 'council-worker' })
    const owner = request.headers['x-council-owner']
    if (typeof owner !== 'string' || !/^[a-f0-9]{64}$/i.test(owner)) throw new BackendError(400, 'INVALID_OWNER', 'A valid council browser owner is required.')
    if (request.method === 'GET') {
      if (url.pathname === '/setup') {
        const setup = await council.councilSetup()
        setup.roles = setup.roles.map(role => ({ ...role, configured: reviewed.runs.some(run => run.role === role.role) }))
        return respond(response, 200, setup)
      }
      if (url.pathname === '/sources') {
        const offset = url.searchParams.get('offset') || '0'
        if (!/^\d+$/.test(offset) || !Number.isSafeInteger(Number(offset))) throw new BackendError(400, 'INVALID_INPUT', 'Choose a valid source page offset.')
        const run = reviewed.runs.find(item => item.role === url.searchParams.get('role'))
        if (!run) throw new BackendError(400, 'UNKNOWN_AGENT', 'Choose an agent with reviewed saved evidence.')
        const sources = run.contents.map(content => ({ ref: { kind: 'artifact', role: run.role, runId: run.detail.id, index: content.index }, title: run.detail.artifacts.find(artifact => artifact.index === content.index)?.title || 'Saved agent artifact', description: 'Reviewed saved agent output; dated model-generated evidence.', createdAt: run.detail.completedAt || reviewed.recordedAt }))
        return respond(response, 200, { sources: sources.slice(Number(offset), Number(offset) + 20), offset: Number(offset), limit: 20, hasMore: Number(offset) + 20 < sources.length })
      }
      if (url.pathname === '/thread') return respond(response, 200, await council.readOwnedCouncilThread(url.searchParams.get('jobId'), owner))
      if (url.pathname === '/job') return respond(response, 200, await council.readOwnedCouncilJob(url.searchParams.get('jobId'), owner))
    }
    if (request.method === 'POST' && url.pathname === '/submit') return respond(response, 202, await council.submitOwnedCouncil(await body(request), owner))
    throw new BackendError(404, 'NOT_FOUND', 'Choose a council worker endpoint.')
  } catch (error) {
    const known = error instanceof BackendError
    if (!known) console.error('[council-worker] Request failed:', error instanceof Error ? error.message : 'Unknown error')
    respond(response, known ? error.status : 502, { error: { code: known ? error.code : 'COUNCIL_UNAVAILABLE', message: known ? error.message : 'The council worker could not complete this request. Keep the same request ID to recover its state.' } })
  }
})
server.requestTimeout = 30_000
server.headersTimeout = 15_000
server.listen(port, host, () => console.info(`[council-worker] Listening on http://${host}:${port}`))
