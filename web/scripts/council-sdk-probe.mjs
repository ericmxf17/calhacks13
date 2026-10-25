import { loadEnvFile } from 'node:process'
import { mkdtemp, mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import { createSdkMcpServer, createSession, tool, DroidMessageType, ToolConfirmationOutcome, AutonomyLevel } from '@factory/droid-sdk/node'
import { councilEnvironment } from '../src/lib/council-environment.mjs'

try { loadEnvFile('.env') } catch (error) { if (error.code !== 'ENOENT') throw error }
const cwd = await mkdtemp(path.join(os.tmpdir(), 'consul-sdk-probe-'))
const home = path.join(cwd, 'home')
await mkdir(home)
const serverName = process.env.COUNCIL_PROBE_SERVER || 'consul-probe'
const server = createSdkMcpServer({ name: serverName, tools: [tool('sum', 'Add two scenario inputs.', { a: z.number(), b: z.number() }, ({ a, b }) => {
  const result = { sum: a + b }
  console.log(JSON.stringify({ phase: 'executed', result }))
  return JSON.stringify(result)
})] })
const session = await createSession({
  apiKey: process.env.FACTORY_API_KEY, execPath: process.env.DROID_EXECUTABLE,
  cwd, env: councilEnvironment(process.env.FACTORY_API_KEY, home),
  modelId: process.env.COUNCIL_MODEL_ID, reasoningEffort: process.env.COUNCIL_REASONING_EFFORT,
  systemPrompt: 'Use the supplied sum tool when asked. Return a brief public answer. Do not use other tools.',
  autonomyLevel: AutonomyLevel.Off, mcpServers: [server], disableBuiltinSkills: true,
  autoRejectPermissionRequests: false,
  permissionHandler: request => {
    const requests = request?.toolUses ?? []
    console.log(JSON.stringify({ phase: 'permission', tools: requests.map(item => ({ name: item.toolUse?.name, details: item.details })) }))
    return requests.length && requests.every(item => item.details?.serverName === server.name && item.details?.actualToolName === 'sum')
      ? ToolConfirmationOutcome.ProceedOnce : ToolConfirmationOutcome.Cancel
  },
  askUserHandler: () => ({ cancelled: true, answers: [] }),
  abortSignal: AbortSignal.timeout(90_000),
})
try {
  const tools = await session.listTools()
  const mcp = await session.listMcpTools()
  console.log(JSON.stringify({ phase: 'discovered', model: session.settings.modelId, tools: tools.map(({id, displayName, source}) => ({id, displayName, source})), mcp: mcp.map(({serverName,name,isEnabled}) => ({serverName,name,isEnabled})) }))
  const owned = tools.filter(item => item.displayName === `[MCP] ${serverName}:sum`)
  if (owned.length !== 1) throw new Error('No unique owned tool discovered. No prompt sent.')
  await session.updateSettings({ disabledToolIds: tools.filter(item => !owned.includes(item)).map(item => item.id), autonomyLevel: AutonomyLevel.Off })
  console.log(JSON.stringify({ phase: 'allowed_after_update', tools: (await session.listTools()).filter(item => item.allowed).map(item => item.id) }))
  if (process.argv.includes('--call')) {
    for await (const message of session.stream('Call sum with a=12 and b=30. Report the result.')) {
      if (message.type === DroidMessageType.ToolCall) console.log(JSON.stringify({ phase: 'tool_call', name: message.name }))
      if (message.type === DroidMessageType.Result) console.log(JSON.stringify({ phase: 'result', success: message.success, subtype: message.subtype }))
    }
  }
} finally { await session.close(); await server.close() }
