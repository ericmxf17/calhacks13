#!/usr/bin/env node
// Inspect a saved role's public JSON using the actual runner validator, without
// generating, retrying or changing the saved job. Run from web:
// node --conditions=react-server --experimental-transform-types scripts/council-validate.mjs <job-id>
import { registerHooks } from 'node:module'
import { glob, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

// The app uses bundler-style extensionless TS imports; adapt their resolution
// for this Node inspection command. Package imports keep normal resolution.
registerHooks({ resolve(specifier, context, next) {
  // Next aliases this marker internally; this command already runs on Node.
  if (specifier === 'server-only') return next('next/dist/compiled/server-only/empty.js', context)
  if (context.parentURL?.endsWith('.ts') && specifier.startsWith('.') && !path.extname(specifier)) return next(`${specifier}.ts`, context)
  return next(specifier, context)
} })
const { validateCouncilRoleOutput } = await import('../src/lib/council-droid.ts')
const id = process.argv[2]
if (!/^[0-9a-f-]{36}$/i.test(id ?? '')) throw new Error('Supply a saved council job UUID.')
const saved = JSON.parse(await readFile(path.join(process.env.COUNCIL_DATA_DIR || '.backend/council', id, 'job.json'), 'utf8'))
// Follow-up roles may cite committed tool evidence from earlier rounds. Read
// those ledgers without dispatching work or modifying the original snapshots.
const inheritedEvidence = []
const inheritedArtifacts = []
const visited = new Set([id])
let previousId = saved.job.previousJobId
while (previousId) {
  if (!/^[0-9a-f-]{36}$/i.test(previousId) || visited.has(previousId) || visited.size >= 4) throw new Error('Invalid saved council history.')
  visited.add(previousId)
  const previous = JSON.parse(await readFile(path.join(process.env.COUNCIL_DATA_DIR || '.backend/council', previousId, 'job.json'), 'utf8'))
  inheritedEvidence.push(...(previous.job.toolEvidence || []))
  inheritedArtifacts.push(...(previous.job.artifacts || []))
  previousId = previous.job.previousJobId
}
saved.job.toolEvidence = [...inheritedEvidence, ...(saved.job.toolEvidence || [])]
saved.job.artifacts = [...inheritedArtifacts, ...(saved.job.artifacts || [])]
const role = saved.job.stage
const sessionId = saved.sessions[role]
if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) throw new Error('The saved active role has no recorded session.')
const root = path.join(os.tmpdir(), 'consul-council', id, role, 'home', '.factory', 'sessions')
const files = []
for await (const file of glob(`**/${sessionId}.jsonl`, { cwd: root })) files.push(path.join(root, file))
if (files.length !== 1) throw new Error('The recorded public session file is unavailable or ambiguous.')
const rows = (await readFile(files[0], 'utf8')).trim().split('\n').map(line => JSON.parse(line))
const publicText = rows.filter(row => row.message?.role === 'assistant')
  .flatMap(row => row.message.content.filter(part => part.type === 'text').map(part => part.text)).at(-1)
if (process.argv.includes('--show-public')) console.log(JSON.stringify({ role, output: JSON.parse(publicText) }, null, 2))
try {
  const result = validateCouncilRoleOutput(JSON.parse(publicText), saved.job, role, sessionId)
  console.log(JSON.stringify({ role, validNow: true, claims: result.turn.claims.length, hasDecision: !!result.decision }))
} catch (error) {
  console.log(JSON.stringify({ role, validNow: false, reason: error.message }))
}
