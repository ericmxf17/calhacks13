#!/usr/bin/env node
// Install the native Linux runner inside Vercel Sandbox, upload reviewed source,
// and snapshot the prepared filesystem. Credentials are injected only at start.
import { Sandbox } from '@vercel/sandbox'
import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = fileURLToPath(new URL('../..', import.meta.url))
const project = JSON.parse(await readFile(path.join(root, 'web/.vercel/project.json'), 'utf8'))
const authFile = process.env.COUNCIL_VERCEL_AUTH_FILE || path.join(process.env.APPDATA || '', 'com.vercel.cli/Data/auth.json')
const auth = JSON.parse(await readFile(authFile, 'utf8'))
const credentials = { token: auth.token, teamId: project.orgId, projectId: project.projectId }
const require = createRequire(import.meta.resolve('@vercel/sandbox'))
const { Agent } = require('undici')
const agent = new Agent({ connect: { timeout: 60_000 }, bodyTimeout: 0 })
const sandbox = await Sandbox.getOrCreate({ ...credentials, name: 'consul-live-worker-20261025', ports: [3003], timeout: 45 * 60 * 1000, persistent: true, resume: true, fetch: (url, options) => fetch(url, { ...options, dispatcher: agent }) })
await writeFile(path.join(root, '.tools/sandbox-runtime/state.json'), JSON.stringify({ name: sandbox.name, url: sandbox.domain(3003) }))

async function run(command) {
  const result = await sandbox.runCommand({ cmd: 'bash', args: ['-lc', command] })
  const stdout = await result.stdout()
  const stderr = await result.stderr()
  if (result.exitCode) throw new Error(`Sandbox setup failed (${result.exitCode}): ${stderr || stdout}`)
  console.info(stdout.trim())
}
if (!process.argv.includes('--refresh')) await run('node --version && python3 --version && uname -m && curl -fsSL https://app.factory.ai/cli -o /tmp/install-droid.sh && sh /tmp/install-droid.sh && /vercel/.local/bin/droid --version')
const archive = path.join(root, '.tools/sandbox-runtime/worker-source.tar')
execFileSync('tar', ['-cf', archive, '--exclude=__pycache__', 'backend', 'forecast', 'impact', 'web/src/lib', 'web/src/demo-data', 'web/src/components/business/departments.ts', 'web/scripts/council-worker.mjs', 'web/scripts/council-compute-worker.mjs'], { cwd: root })
await sandbox.writeFiles([{ path: '/tmp/worker-source.tar', content: await readFile(archive) }])
await run('mkdir -p /vercel/app && tar -xf /tmp/worker-source.tar -C /vercel/app')
await sandbox.writeFiles([{ path: '/vercel/app/web/package.json', content: Buffer.from(JSON.stringify({ type: 'module', dependencies: { '@factory/droid-sdk': '0.10.0', 'ipaddr.js': '2.5.0', 'quickjs-emscripten': '0.32.0', zod: '3.24.0' } })) }])
if (!process.argv.includes('--refresh')) await run(`cd /vercel/app/web && npm install --omit=dev --no-audit --no-fund && printf '{}' | python3 /vercel/app/backend/worker.py health`)
if (process.env.COUNCIL_WORKER_TOKEN) {
  const env = { COUNCIL_WORKER_HOST: '0.0.0.0', COUNCIL_WORKER_PORT: '3003', DROID_EXECUTABLE: '/vercel/.local/bin/droid', PYTHON_BINARY: 'python3', BACKEND_REPO_ROOT: '/vercel/app', COUNCIL_DATA_DIR: '/vercel/app/web/.backend/council' }
  for (const [key, value] of Object.entries(process.env)) if (value && (key === 'FACTORY_API_KEY' || key === 'COUNCIL_WORKER_TOKEN' || key.startsWith('SPACETIMEDB_') || /^COUNCIL_(?:FINANCE|OPERATIONS|SKEPTIC|CHAIR)_(?:MODEL_ID|REASONING_EFFORT)$/.test(key))) env[key] = value
  await sandbox.runCommand({ cmd: 'node', args: ['--experimental-transform-types', 'scripts/council-worker.mjs'], cwd: '/vercel/app/web', env, detached: true })
  const headers = { authorization: `Bearer ${process.env.COUNCIL_WORKER_TOKEN}`, 'x-council-owner': 'a'.repeat(64) }
  for (let attempt = 0; attempt < 20; attempt++) {
    try { if ((await fetch(`${sandbox.domain(3003)}/health`, { headers, signal: AbortSignal.timeout(3000) })).ok) break } catch {}
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  for (const endpoint of ['/health', '/setup', '/sources?role=bill-analyst']) {
    const response = await fetch(`${sandbox.domain(3003)}${endpoint}`, { headers, signal: AbortSignal.timeout(10000) })
    const result = await response.json()
    console.info(JSON.stringify({ endpoint, status: response.status, available: result.available, sourceCount: result.sources?.length, roles: result.roles?.filter(role => role.configured).map(role => role.role) }))
    if (!response.ok || (endpoint === '/setup' && !result.available)) throw new Error('Hosted worker readiness failed.')
  }
  const unauthorized = await fetch(`${sandbox.domain(3003)}/health`, { signal: AbortSignal.timeout(10000) })
  if (unauthorized.status !== 401) throw new Error('Worker must reject unauthenticated calls.')
  if (process.argv.includes('--verify-admission')) {
    const probe = '.audit/live-send-fix-2026-10-25/verify-admission.mjs'
    await sandbox.writeFiles([{ path: `/vercel/app/${probe}`, content: await readFile(path.join(root, probe)) }])
    const result = await sandbox.runCommand({ cmd: 'node', args: ['--experimental-transform-types', probe], cwd: '/vercel/app', env: { ...env, CONSUL_ADMISSION_ROOT: '/vercel/app', COUNCIL_SESSION_SECRET: process.env.COUNCIL_SESSION_SECRET || '' } })
    console.info(await result.stdout())
    if (result.exitCode) console.info(await result.stderr())
    const artifact = await sandbox.readFileToBuffer({ path: '/vercel/app/.audit/live-send-fix-2026-10-25/admission-results.json' })
    if (artifact) await writeFile(path.join(root, '.audit/live-send-fix-2026-10-25/admission-results-sandbox.json'), artifact)
  }
}
const snapshot = await sandbox.snapshot()
await writeFile(path.join(root, '.tools/sandbox-runtime/snapshot.json'), JSON.stringify({ name: sandbox.name, snapshotId: snapshot.snapshotId, url: sandbox.domain(3003) }))
console.info(JSON.stringify({ snapshotId: snapshot.snapshotId, name: sandbox.name }))

