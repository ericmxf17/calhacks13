import { spawn } from 'node:child_process'
import { loadEnvFile } from 'node:process'
import path from 'node:path'

try { loadEnvFile('.env') } catch (error) {
  if (error.code !== 'ENOENT') throw error
}

const env = {
  ...process.env,
  COUNCIL_EXECUTION_MODE: 'local',
  ENABLE_LOCAL_AGENT_PREVIEW: 'true',
  CONSUL_JUDGE_DEMO: 'false',
  COUNCIL_DATA_DIR: path.resolve('.backend/council'),
  BACKEND_REPO_ROOT: path.resolve('..'),
  SPACETIMEDB_URL: '',
  SPACETIMEDB_DATABASE: '',
  SPACETIMEDB_TOKEN: '',
}
const port = process.env.LOCAL_CHAT_PORT || '3002'
console.log(`Local council chat: http://127.0.0.1:${port}/demo/harbor-goods`)
console.log('Execution mode is local. Council history is saved on disk in this checkout.')
const child = spawn(process.execPath, [
  '--no-deprecation', 'node_modules/next/dist/bin/next',
  'dev', '--hostname', '127.0.0.1', '--port', port,
], { env, stdio: 'inherit', windowsHide: true })
child.on('error', error => { console.error(error.message); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
