import type { AgentRole } from './agent-catalog'

export type BrowserAgentRole = AgentRole
export type AgentConnection = 'connected' | 'not_configured' | 'unavailable'
export type ArchivedAgentEvidence = { label: string; recordedAt: string; mode: 'archive' }
export type AgentConnectionsResponse = { agents: { role: AgentRole; connection: AgentConnection }[]; evidence?: ArchivedAgentEvidence }

export type AgentArtifact = {
  index: number
  title: string
  mediaType: string
  downloadUrl: string
  previewUrl: string | null
}

export type AgentRunDetail = {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  threadId: string | null
  createdAt: string | null
  startedAt: string | null
  completedAt: string | null
  errorCode: string | null
  output: { text: string | null; conversation: string | null }
  artifacts: AgentArtifact[]
}

export type AgentRunsResponse = {
  evidence?: ArchivedAgentEvidence
  agent: { role: string; name: string; connection: 'connected' | 'not_configured' }
  runs: AgentRunDetail[]
  limit: number
  offset: number
}

export type ArtifactPreview = { title: string; mediaType: string; content: string; truncated: boolean }

export type BriefWriterJob = {
  id: string
  status: AgentRunDetail['status'] | 'dispatching' | 'dispatch_unknown' | 'rejected'
  runId: string | null
  message: string | null
}

export type SceneDesignerJob = BriefWriterJob & {
  /** The checked design in snake_case, once the run has finished. */
  spec: Record<string, unknown> | null
  /** What the app had to fix in the agent's design. */
  repairs: string[]
  /** Why a finished run's design could not be used. */
  specError: string | null
}
