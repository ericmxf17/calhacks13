import { validateBusiness, type BusinessInput } from './business-input'
import type { AgentRole } from './agent-catalog'

export type CouncilRole = 'finance' | 'operations' | 'skeptic' | 'chair'
export type CouncilSourceRef = { kind: 'conversation'; role: AgentRole; runId: string }
  | { kind: 'artifact'; role: AgentRole; runId: string; index: number }
  | { kind: 'sample'; id: 'voltride-hr973' }
export type CouncilEvidence = { id: string; title: string; text: string; provenance: string; kind: 'profile' | 'conversation' | 'artifact' | 'sample'; url: string | null; companyMatch: 'explicit' | 'unidentified'; warnings: string[] }
export type CouncilClaim = { text: string; sourceIds: string[] }
export type CouncilTurn = { role: CouncilRole; sessionId: string; summary: string; claims: CouncilClaim[]; challenges: CouncilClaim[]; uncertainties: string[] }
export type CouncilDecision = { action: string; rationale: CouncilClaim[]; disagreements: CouncilClaim[]; nextSteps: CouncilClaim[]; missingEvidence: string[]; confidence: 'low' | 'medium' | 'high'; relevance: 'relevant' | 'not_relevant' | 'insufficient_evidence' }
export type CouncilJob = { id: string; previousJobId: string | null; rootJobId: string; round: number; business: BusinessInput; businessKey: string; question: string; status: 'resolving' | 'running' | 'completed' | 'failed' | 'interrupted'; stage: CouncilRole | null; sources: CouncilEvidence[]; turns: CouncilTurn[]; decision: CouncilDecision | null; message: string | null; createdAt: string; updatedAt: string }
export type CouncilHistoryRound = Pick<CouncilJob, 'id' | 'question' | 'turns' | 'decision' | 'createdAt'>
export type CouncilThread = { rootJobId: string; rounds: CouncilJob[] }
export type CouncilSourceOption = { ref: CouncilSourceRef; title: string; description: string; createdAt: string | null }
export type CouncilSetup = { available: boolean; message: string | null; roles: { role: AgentRole; name: string; configured: boolean }[] }
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
