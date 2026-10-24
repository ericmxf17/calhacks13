import 'server-only'

import { openArtifact, ProviderError, type Agent } from './creao'

// CREAO puts only a short summary in result.text. The full reply is in result.chatText,
// and files the agent saved are listed in result.artifacts. This mirrors backend/creao.py.

const fenced = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/g
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

/** JSON objects in a reply: fenced json blocks (last first, since the answer usually comes last), then the whole text. */
export function jsonCandidates(text: string): unknown[] {
  const found: unknown[] = []
  for (const match of [...text.matchAll(fenced)].reverse()) {
    try { found.push(JSON.parse(match[1])) } catch { /* Not JSON; try the next block. */ }
  }
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) { try { found.push(JSON.parse(trimmed)) } catch { /* Not a bare JSON reply. */ } }
  return found
}

async function readText(response: Response, maxBytes: number) {
  const reader = response.body!.getReader(), chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.length
      if (size > maxBytes) throw new ProviderError('AGENT_OUTPUT_TOO_LARGE', 'The saved file was larger than expected.')
      chunks.push(value)
    }
  } finally { await reader.cancel() }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

/**
 * Finds the agent's JSON answer in a finished run: the file it saved first, then its reply.
 * The first object with every required key wins.
 */
export async function extractAgentJSON(agent: Agent, runId: string, result: unknown, options: { expectedFile: string; required: string[]; maxBytes?: number }) {
  const has = (value: unknown): value is Record<string, unknown> => isRecord(value) && options.required.every(key => key in value)
  const record = isRecord(result) ? result : null
  const checked: string[] = []
  const files = Array.isArray(record?.artifacts) ? record.artifacts.filter(isRecord) : []
  const file = files.find(f => typeof f.id === 'string' && (f.title === options.expectedFile || f.id === options.expectedFile || f.id.endsWith(`/${options.expectedFile}`)))
  if (file) {
    checked.push(`the saved file ${options.expectedFile}`)
    try {
      const found = jsonCandidates(await readText(await openArtifact(agent, runId, String(file.id)), options.maxBytes ?? 64 * 1024)).find(has)
      if (found) return found
    } catch { checked.push('(the file could not be downloaded)') }
  }
  for (const [label, text] of [['the reply', record?.chatText], ['the summary', typeof result === 'string' ? result : record?.text]] as const) {
    if (typeof text !== 'string') continue
    checked.push(label)
    const found = jsonCandidates(text).find(has)
    if (found) return found
  }
  throw new ProviderError('AGENT_OUTPUT_UNREADABLE', `No JSON with ${options.required.join(', ')} was found in ${checked.join(', ') || 'the run'}.`)
}
