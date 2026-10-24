export type BrowserAgentRole = 'bill-analyst' | 'researcher' | 'impact-planner' | 'test-agent'

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
  agent: { role: string; name: string; connection: 'connected' | 'not_configured' }
  runs: AgentRunDetail[]
  limit: number
  offset: number
}

export type ArtifactPreview = { title: string; mediaType: string; content: string; truncated: boolean }
