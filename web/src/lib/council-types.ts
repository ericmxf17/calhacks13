import { validateBusiness, type BusinessInput } from './business-input'
import type { AgentRole } from './agent-catalog'

export type CouncilRole = 'finance' | 'operations' | 'skeptic' | 'chair'
export type CouncilSourceRef = { kind: 'conversation'; role: AgentRole; runId: string }
  | { kind: 'artifact'; role: AgentRole; runId: string; index: number }
  | { kind: 'sample'; id: 'voltride-hr973' }
export type CouncilEvidence = { id: string; title: string; text: string; provenance: string; kind: 'profile' | 'conversation' | 'artifact' | 'sample' | 'calculation' | 'research'; url: string | null; companyMatch: 'explicit' | 'unidentified'; warnings: string[] }
export type CouncilJson = null | boolean | number | string | CouncilJson[] | { [key: string]: CouncilJson }
export type CouncilModel = { modelId: string; reasoningEffort: string }
export type CouncilToolName = 'publish_visual' | 'calculate_policy' | 'calculate_javascript' | 'research_url'
export type CouncilToolCall = { id: string; role: CouncilRole; name: CouncilToolName; title: string; status: 'running' | 'completed' | 'failed' | 'interrupted'; startedAt: string; completedAt?: string; artifactIds: string[]; error?: string }
export type CouncilArtifact = { id: string; role: CouncilRole; title: string; createdAt: string; sourceIds: string[]; illustrative: boolean; assumptions: string[] } & (
  | { kind: 'chart'; chartType: 'bar' | 'line'; labels: string[]; series: { label: string; values: number[] }[]; unit?: string }
  | { kind: 'table'; columns: string[]; rows: (string | number | null)[][] }
  | { kind: 'flowchart'; nodes: { id: string; label: string }[]; edges: { from: string; to: string; label?: string }[] }
  | { kind: 'map'; markers: { label: string; latitude: number; longitude: number }[] }
  | { kind: 'html'; html: string }
  | { kind: 'calculation'; engine: 'python' | 'quickjs'; input: { [key: string]: CouncilJson }; code: string; result: CouncilJson }
  | { kind: 'research'; url: string; text: string; retrievedAt: string }
)
export type CouncilClaim = { text: string; sourceIds: string[] }
export type CouncilTurn = { role: CouncilRole; sessionId: string; modelId?: string; reasoningEffort?: string; summary: string; claims: CouncilClaim[]; challenges: CouncilClaim[]; uncertainties: string[] }
export type CouncilDecision = { action: string; rationale: CouncilClaim[]; disagreements: CouncilClaim[]; nextSteps: CouncilClaim[]; missingEvidence: string[]; confidence: 'low' | 'medium' | 'high'; relevance: 'relevant' | 'not_relevant' | 'insufficient_evidence' }
export type CouncilJob = { id: string; previousJobId: string | null; rootJobId: string; round: number; business: BusinessInput; businessKey: string; question: string; status: 'resolving' | 'running' | 'completed' | 'failed' | 'interrupted'; stage: CouncilRole | null; sources: CouncilEvidence[]; artifacts?: CouncilArtifact[]; toolCalls?: CouncilToolCall[]; toolEvidence?: CouncilEvidence[]; speakers?: Partial<Record<CouncilRole, CouncilModel>>; turns: CouncilTurn[]; decision: CouncilDecision | null; message: string | null; createdAt: string; updatedAt: string }
export type CouncilHistoryRound = Pick<CouncilJob, 'id' | 'question' | 'turns' | 'decision' | 'createdAt' | 'artifacts' | 'toolEvidence'>
export type CouncilThread = { rootJobId: string; rounds: CouncilJob[] }
export type CouncilSourceOption = { ref: CouncilSourceRef; title: string; description: string; createdAt: string | null }
export type CouncilSetup = { mode?: 'live' | 'archive'; members?: ({ role: CouncilRole } & CouncilModel)[]; capabilities?: string[]; available: boolean; message: string | null; roles: { role: AgentRole; name: string; configured: boolean }[] }
export type CouncilRequest = { requestId: string; business: BusinessInput; question: string; sources: CouncilSourceRef[]; assignToCompany: true; previousJobId?: string }

/** Browser/server freshness identity over the entire validated profile; never authorization. */
export function councilBusinessKey(raw: BusinessInput): string {
  const value = JSON.stringify(validateBusiness(raw))
  let a = 0x811c9dc5, b = 0x9e3779b9
  for (let index = 0; index < value.length; index++) {
    a = Math.imul(a ^ value.charCodeAt(index), 0x01000193)
    b = Math.imul(b ^ value.charCodeAt(index), 0x85ebca6b)
  }
  return `${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`
}
