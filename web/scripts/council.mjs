#!/usr/bin/env node
// Inspect local traces and use the same HTTP interface as the council UI.
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const base = new URL(process.env.COUNCIL_URL || 'http://localhost:3000')
if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) throw new Error('COUNCIL_URL must use a loopback host.')
const [operation, argument, offset = '0'] = process.argv.slice(2)
async function request(query, body) {
  const response = await fetch(new URL(`/api/council${query}`, base), { method: body ? 'POST' : 'GET', headers: { Origin: base.origin, 'Sec-Fetch-Site': 'same-origin', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const result = await response.json()
  if (!response.ok) throw new Error(`${response.status} ${result.error?.code || 'COUNCIL_ERROR'}: ${result.error?.message || 'Request failed.'}`)
  return result
}
try {
  let result
  if (operation === 'trace' && argument) {
    if (!/^[0-9a-f-]{36}$/i.test(argument)) throw new Error('Supply a saved council job UUID.')
    const trace = await readFile(path.join(process.env.COUNCIL_DATA_DIR || '.backend/council', argument, 'diagnostics.jsonl'), 'utf8')
    result = trace.trim().split('\n').map(line => JSON.parse(line))
  } else if (operation === 'setup') result = await request('?view=setup')
  else if (operation === 'sources' && argument) result = await request(`?view=sources&role=${encodeURIComponent(argument)}&offset=${encodeURIComponent(offset)}`)
  else if (operation === 'submit' && argument) result = await request('', JSON.parse(await readFile(argument, 'utf8')))
  else if (operation === 'thread' && argument) result = await request(`?view=thread&jobId=${encodeURIComponent(argument)}`)
  else if ((operation === 'read' || operation === 'inspect') && argument) {
    result = await request(`?jobId=${encodeURIComponent(argument)}`)
    if (operation === 'inspect') result = { id: result.id, business: result.business.company, businessKey: result.businessKey, question: result.question, status: result.status, stage: result.stage, message: result.message, sources: result.sources.map(source => ({ ...source, text: `${source.text.length} characters; use read for full saved source excerpts` })), turns: result.turns, decision: result.decision }
  } else throw new Error('Usage: node scripts/council.mjs setup | sources <agent-role> [offset] | submit <saved-request.json> | read <job-uuid> | inspect <job-uuid> | thread <leaf-job-uuid> | trace <job-uuid>')
  console.log(JSON.stringify(result, null, 2))
} catch (error) { console.error(error.message); process.exitCode = 1 }
