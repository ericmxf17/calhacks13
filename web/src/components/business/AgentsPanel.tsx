'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import AgentAvatar from './AgentAvatar'
import { Button } from '@/components/ui/button'
import AgentRunDialog from './AgentRunDialog'
import { agentCatalog } from '@/lib/agent-catalog'
import type { AgentConnection, AgentConnectionsResponse, BrowserAgentRole } from '@/lib/agent-run-types'
import './agents-panel.css'

type AgentAvatar = { still: string; animated: string }
const avatars = {
  analyst: { still: '/agents/bill-analyst.svg', animated: '/agents/bill-analyst-animated.svg' },
  researcher: { still: '/agents/researcher.svg', animated: '/agents/researcher-animated.svg' },
  planner: { still: '/agents/impact-planner.svg', animated: '/agents/impact-planner-animated.svg' },
  test: { still: '/agents/test-agent.svg', animated: '/agents/test-agent-animated.svg' },
} satisfies Record<string, AgentAvatar>

type AgentCard = {
  id: string
  name: string
  description: string
  avatar: AgentAvatar
} & ({ kind: 'creao'; role: BrowserAgentRole } | { kind: 'placeholder'; role?: never })

const agents: AgentCard[] = [
  ...agentCatalog.map(agent => ({ id: agent.role, name: agent.name, description: agent.description,
    avatar: { still: `/agents/${agent.avatar}.svg`, animated: `/agents/${agent.avatar}-animated.svg` },
    kind: 'creao' as const, role: agent.role })),
  { id: 'finance-scout', name: 'Finance Scout', description: 'Concept only. No finance runs or account connection.', avatar: avatars.analyst, kind: 'placeholder' },
  { id: 'people-partner', name: 'People Partner', description: 'Concept only. No hiring runs or account connection.', avatar: avatars.researcher, kind: 'placeholder' },
  { id: 'supply-watch', name: 'Supply Watch', description: 'Concept only. No supplier monitoring or run connection.', avatar: avatars.planner, kind: 'placeholder' },
  { id: 'market-monitor', name: 'Market Monitor', description: 'Concept only. No market monitoring or run connection.', avatar: avatars.test, kind: 'placeholder' },
]

function isConnectionsResponse(value: unknown): value is AgentConnectionsResponse {
  if (!value || typeof value !== 'object' || !('agents' in value) || !Array.isArray(value.agents)) return false
  const entries = value.agents
  return entries.length === agentCatalog.length && agentCatalog.every(agent =>
    entries.filter((item: unknown) => item && typeof item === 'object' && 'role' in item && item.role === agent.role
      && 'connection' in item && ['connected', 'not_configured', 'unavailable'].includes(String(item.connection))).length === 1)
}

const connectionLabels: Record<AgentConnection, string> = {
  connected: 'Connected', not_configured: 'Needs setup', unavailable: 'Connection unavailable',
}

export default function AgentsPanel({ reducedMotion }: { reducedMotion: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null)
  const [selectedAgent, setSelectedAgent] = useState<AgentCard | null>(null)
  const [connections, setConnections] = useState<AgentConnectionsResponse | null>(null)
  const [checking, setChecking] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const archive = connections?.evidence?.mode === 'archive'
  const visibleAgents = archive ? agents.filter(agent => agent.kind === 'creao' && connections?.agents.some(item => item.role === agent.role && item.connection === 'connected')) : agents

  useEffect(() => { heading.current?.focus() }, [])
  useEffect(() => {
    const controller = new AbortController()
    setChecking(true)
    setConnectionError(null)
    async function loadConnections() {
      try {
        const response = await fetch('/api/agent-runs/agents', { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error()
        const body: unknown = await response.json()
        if (!isConnectionsResponse(body)) throw new Error()
        setConnections(body)
      } catch {
        if (controller.signal.aborted) return
        setConnections(null)
        setConnectionError('Connection status could not be checked. You can still open an agent and retry its history.')
      } finally {
        if (!controller.signal.aborted) setChecking(false)
      }
    }
    void loadConnections()
    return () => controller.abort()
  }, [refreshKey])

  return <section className="agents-panel" aria-labelledby="agents-panel-title" data-reduced-motion={reducedMotion || undefined}>
    <div className="agents-panel-content">
      <header className="agents-panel-heading">
        <span className="agents-panel-kicker">CREAO RUNS</span>
        <h1 id="agents-panel-title" ref={heading} tabIndex={-1}>Research & briefs.</h1>
        <p>{archive ? 'Read the completed CREAO analyses and their original output files. These examples use fictional company data; opening them starts no paid run.' : 'Open an agent to inspect past API runs and files. Start a new brief from an analysis pack in Brief Writer.'}</p>
        {archive && <p>{connections?.evidence?.label}</p>}
        <div className="agents-connection-toolbar">
          <p role="status">{checking ? 'Checking agent connections…' : connectionError
            || (archive ? `${visibleAgents.length} agents with saved runs` : `${connections?.agents.filter(agent => agent.connection === 'connected').length ?? 0} of ${agentCatalog.length} agents connected`)}</p>
          <Button onClick={() => setRefreshKey(key => key + 1)} disabled={checking}>{archive ? 'Reload saved runs' : 'Refresh connections'}</Button>
        </div>
      </header>
      <div className="agents-grid">
        {visibleAgents.map((agent, index) => {
          const connection = connections?.agents.find(item => item.role === agent.role)?.connection
          return <article className="agent-card" key={agent.id} data-tour={agent.id === 'brief-writer' ? 'brief-writer' : undefined} style={{ '--card-index': index } as CSSProperties}>
          <div className="agent-card-topline">
            {agent.kind === 'creao' && <span className="agent-connection" data-connection={checking ? 'checking' : connection}>
              {checking ? 'Checking…' : archive && connection === 'connected' ? 'Saved runs' : connection ? connectionLabels[connection] : 'Status unavailable'}
            </span>}
            <span className={`agent-kind agent-kind-${agent.kind}`}>{agent.kind === 'creao' ? 'CREAO agent' : 'Placeholder'}</span>
          </div>
          <AgentAvatar stillSrc={agent.avatar.still} animatedSrc={agent.avatar.animated} reducedMotion={reducedMotion}/>
          <h2><button type="button" className="agent-card-trigger" aria-haspopup="dialog" onClick={() => setSelectedAgent(agent)}>{agent.name}</button></h2>
          <p>{agent.description}</p>
        </article>})}
      </div>
    </div>
    {selectedAgent && <AgentRunDialog key={selectedAgent.id} agent={{ name: selectedAgent.name, role: selectedAgent.kind === 'creao' ? selectedAgent.role : null, avatar: selectedAgent.avatar }} reducedMotion={reducedMotion} onClose={() => setSelectedAgent(null)}/>}
  </section>
}
