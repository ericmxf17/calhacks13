#!/usr/bin/env node
// Revalidate an already-finished local Chair response without dispatching work.
// Default is read-only. --recover explicitly publishes the validated response,
// preserving the exact failed snapshot beside job.json before atomic replacement.
// Run from web with --conditions=react-server --experimental-transform-types.
import { registerHooks } from 'node:module'
import { glob, readFile, rename, writeFile } from 'node:fs/promises'
import { isDeepStrictEqual } from 'node:util'
import os from 'node:os'
import path from 'node:path'

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'server-only') return next('next/dist/compiled/server-only/empty.js', context)
  if (context.parentURL?.endsWith('.ts') && specifier.startsWith('.') && !path.extname(specifier)) return next(`${specifier}.ts`, context)
  return next(specifier, context)
} })
const { validateCouncilRoleOutput } = await import('../src/lib/council-droid.ts')
const [id, mode, ...extra] = process.argv.slice(2)
const uuid = /^[0-9a-f-]{36}$/i
if (!uuid.test(id ?? '') || (mode && mode !== '--recover') || extra.length) throw new Error('Usage: council-revalidate.mjs <job-uuid> [--recover]')
const filename = path.join(process.env.COUNCIL_DATA_DIR || '.backend/council', id, 'job.json')
const original = await readFile(filename)
const saved = JSON.parse(original.toString('utf8'))
const { job, sessions } = saved
const roles = ['finance', 'operations', 'skeptic', 'chair']
if (job.id !== id || job.status !== 'failed' || job.stage !== 'chair' || job.previousJobId || job.decision !== null || job.turns.length !== 3
    || !job.message?.startsWith('Numerical token ') || !Number.isFinite(Date.parse(job.updatedAt))
    || job.toolCalls?.some(call => call.status !== 'completed')) {
  throw new Error('Recovery requires a failed first-round Chair numerical validation, three committed turns, and completed tools.')
}

// Only the recorded sessions for this job are opened. Select the last public
// assistant text exactly as council-validate.mjs does; never print session data.
async function publicOutput(role) {
  const sessionId = sessions[role]
  if (!uuid.test(sessionId ?? '')) throw new Error(`Missing recorded ${role} session.`)
  const root = path.join(os.tmpdir(), 'consul-council', id, role, 'home', '.factory', 'sessions')
  const files = []
  for await (const file of glob(`**/${sessionId}.jsonl`, { cwd: root })) files.push(path.join(root, file))
  if (files.length !== 1) throw new Error(`Recorded ${role} public session is unavailable or ambiguous.`)
  let finalText
  for (const line of (await readFile(files[0], 'utf8')).trim().split('\n')) {
    const row = JSON.parse(line)
    if (row.message?.role !== 'assistant') continue
    for (const part of row.message.content) if (part.type === 'text') finalText = part.text
  }
  return JSON.parse(finalText)
}

let chair
const validation = []
for (const [index, role] of roles.entries()) {
  const output = await publicOutput(role)
  const result = validateCouncilRoleOutput(output, job, role, sessions[role])
  if (role === 'chair') {
    chair = result
  } else {
    const { modelId, reasoningEffort, ...committed } = job.turns[index]
    if (!isDeepStrictEqual(committed, result.turn)) throw new Error(`Saved ${role} turn differs from its recorded public output.`)
  }
  validation.push({ role, valid: true, claims: result.turn.claims.length, hasDecision: !!result.decision })
}
if (!chair?.decision || !job.speakers?.chair?.modelId || !job.speakers.chair.reasoningEffort) throw new Error('Validated Chair or recorded model metadata is missing.')

if (mode === '--recover') {
  // No turn is regenerated or rewritten. Existing metadata is copied from the
  // persisted speaker record, just as the live runner records it after validation.
  job.turns.push({ ...chair.turn, ...job.speakers.chair })
  job.decision = chair.decision
  job.status = 'completed'
  job.stage = null
  job.message = 'Complete. Existing public outputs revalidated after checker fix; no provider call was repeated. Citations verify evidence membership and literal numeric excerpts, not truth. Calculated scenarios depend on supplied inputs and assumptions.'
  job.updatedAt = new Date(Math.max(Date.now(), Date.parse(job.updatedAt) + 1)).toISOString()
  const backup = path.join(path.dirname(filename), 'job.before-revalidation.json')
  await writeFile(backup, original, { flag: 'wx', mode: 0o600 })
  const temporary = path.join(path.dirname(filename), 'job.revalidated.tmp')
  await writeFile(temporary, `${JSON.stringify(saved, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
  if (!(await readFile(filename)).equals(original)) throw new Error('Job changed during revalidation; original and candidate are preserved, publication stopped.')
  await rename(temporary, filename)
  const persisted = JSON.parse(await readFile(filename, 'utf8'))
  if (!isDeepStrictEqual(persisted, saved)) throw new Error('Published snapshot did not match the validated recovery.')
}
console.log(JSON.stringify({ id, mode: mode === '--recover' ? 'recovered-local-only' : 'read-only', validation, validatedTurns: validation.length, storedTurns: job.turns.length, providerCalls: 0 }))
