import 'server-only'

import { BackendError } from './backend'

const baseURL = 'https://agent.creao.ai/api/v1'
const roles = [
  ['test-agent', 'Test Agent', 'CREAO_TEST_AGENT_ID', 'CREAO_TEST_AGENT_API_KEY'],
  ['bill-analyst', 'Bill Analyst', 'CREAO_BILL_ANALYST_ID', 'CREAO_BILL_ANALYST_API_KEY'],
  ['researcher', 'Bill Researcher', 'CREAO_RESEARCHER_ID', 'CREAO_RESEARCHER_API_KEY'],
  ['impact-planner', 'Bill Impact Planner', 'CREAO_IMPACT_PLANNER_ID', 'CREAO_IMPACT_PLANNER_API_KEY'],
  ['brief-writer', 'Brief Writer', 'CREAO_BRIEF_WRITER_ID', 'CREAO_BRIEF_WRITER_API_KEY'],
] as const
export type AgentRole = typeof roles[number][0]
export type Agent = {
  role: AgentRole; name: string; appId: string | null; idEnv: string; keyEnv: string
  readiness: 'missing_id' | 'missing_key' | 'invalid_key' | 'configured'
}
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
export type Run = {
  id: string; status: RunStatus; result?: Record<string, unknown> | string | null
  threadId?: string | null; errorCode?: string | null
  createdAt?: string | null; startedAt?: string | null; completedAt?: string | null
}
function safeCode(value: unknown): string | undefined {
  return typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,80}$/.test(value) ? value : undefined
}
const statuses = new Set<string>(['pending', 'running', 'completed', 'failed', 'cancelled'])

export function configuredAgents(): Agent[] {
  return roles.map(([role, name, idEnv, keyEnv]) => {
    const appId = process.env[idEnv]?.trim() || null
    const key = process.env[keyEnv]?.trim()
    const readiness = !appId ? 'missing_id' : !key ? 'missing_key' : !key.startsWith('capi_') ? 'invalid_key' : 'configured'
    return { role, name, appId, idEnv, keyEnv, readiness }
  })
}

export function agentFor(value: unknown, requireReady = true): Agent {
  const agent = configuredAgents().find(agent => agent.role === value)
  if (!agent) throw new BackendError(400, 'UNKNOWN_AGENT', 'Choose an agent role from GET /api/backend/agents.')
  if (requireReady && agent.readiness !== 'configured') {
    throw new BackendError(503, 'AGENT_NOT_CONFIGURED', `Configure ${agent.idEnv} and a capi_ API Trigger key in ${agent.keyEnv}.`)
  }
  return agent
}

export function creaoID(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 200) {
    throw new BackendError(400, 'INVALID_INPUT', `${label} must be a non-empty CREAO identifier of at most 200 characters.`)
  }
  return value.trim()
}

// Provider messages/bodies are deliberately excluded: they may echo credentials.
export class ProviderError extends BackendError {
  constructor(code: string, message: string, public providerStatus?: number) {
    super(502, code, message)
  }
}
async function request(agent: Agent, endpoint: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const key = process.env[agent.keyEnv]!.trim()
  let response: Response
  try {
    response = await fetch(`${baseURL}/apps/${encodeURIComponent(agent.appId!)}${endpoint}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store', signal: AbortSignal.timeout(30_000),
    })
  } catch {
    throw new ProviderError('CREAO_UNREACHABLE', 'CREAO could not be reached within 30 seconds. No automatic retry was made.')
  }
  if (!response.ok) {
    let code: string | undefined
    try {
      const failure = await response.json()
      code = safeCode(failure?.error) || safeCode(failure?.error?.code) || safeCode(failure?.errorCode) || safeCode(failure?.code)
    } catch { /* Unrecognized provider bodies have no safe diagnostic fields. */ }
    throw new ProviderError(code || 'CREAO_REQUEST_FAILED', `CREAO returned HTTP ${response.status}. Check the selected agent ID and scoped API Trigger key. No automatic retry was made.`, response.status)
  }
  try {
    const data: unknown = await response.json()
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error()
    return data as Record<string, unknown>
  } catch {
    throw new ProviderError('INVALID_CREAO_RESPONSE', 'CREAO returned an invalid JSON object.')
  }
}

function runResult(value: unknown): Run {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProviderError('INVALID_CREAO_RESPONSE', 'CREAO returned an invalid run object.')
  const data = value as Record<string, unknown>
  const id = data.id ?? data.runId
  if (typeof id !== 'string' || !id.trim() || id.length > 200 || typeof data.status !== 'string' || !statuses.has(data.status)) {
    throw new ProviderError('INVALID_CREAO_RESPONSE', 'CREAO returned an invalid run identifier or status.')
  }
  const result = data.result
  if (result !== undefined && result !== null && typeof result !== 'string' && (typeof result !== 'object' || Array.isArray(result))) {
    throw new ProviderError('INVALID_CREAO_RESPONSE', 'CREAO returned an invalid run result.')
  }
  const run: Run = { id, status: data.status as RunStatus, ...(result !== undefined ? { result: result as Run['result'] } : {}) }
  for (const field of ['threadId', 'createdAt', 'startedAt', 'completedAt'] as const) {
    const item = data[field]
    if (item === undefined) continue
    if (item !== null && (typeof item !== 'string' || item.length > 200 || (field !== 'threadId' && !Number.isFinite(Date.parse(item))))) {
      throw new ProviderError('INVALID_CREAO_RESPONSE', `CREAO returned an invalid ${field}.`)
    }
    run[field] = item as string | null
  }
  if (data.errorCode === null) run.errorCode = null
  else if (data.errorCode !== undefined) {
    const code = safeCode(data.errorCode)
    if (!code) throw new ProviderError('INVALID_CREAO_RESPONSE', 'CREAO returned an invalid error code.')
    run.errorCode = code
  }
  return run
}
export function listAgents(limit: number, offset: number) {
  const agents = configuredAgents()
  return { agents: agents.slice(offset, offset + limit), total: agents.length, limit, offset, source: 'local_configuration', readinessMeaning: 'configured means local configuration only; connection has not been verified' }
}
export async function listRuns(role: unknown, limit: number, offset: number) {
  const agent = agentFor(role)
  const data = await request(agent, `/runs?limit=${limit}&offset=${offset}`)
  if (!Array.isArray(data.runs)) throw new ProviderError('INVALID_CREAO_RESPONSE', 'CREAO returned an invalid run list.')
  const runs = data.runs.map(runResult)
  return { runs, limit, offset, ...(typeof data.total === 'number' ? { total: data.total } : {}), agent: agent.role, source: 'creao_api_runs', description: 'API run history; website chat sessions are not included.' }
}
export async function checkConnection(role: unknown) {
  const history = await listRuns(role, 1, 0)
  return { connected: true, agent: history.agent, api: 'scoped-api-trigger', checkedAt: new Date().toISOString() }
}
export async function startRun(agent: Agent, inputs: Record<string, unknown>, threadId?: string) {
  return runResult(await request(agent, '/runs', { inputs, ...(threadId ? { threadId } : {}) }))
}
export async function getRun(agent: Agent, id: string) {
  return runResult(await request(agent, `/runs/${encodeURIComponent(creaoID(id, 'runId'))}`))
}
