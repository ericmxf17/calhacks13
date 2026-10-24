'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import AgentAvatar from './AgentAvatar'
import AgentRunDialog from './AgentRunDialog'
import type { BrowserAgentRole } from '@/lib/agent-run-types'
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
  { id: 'bill-analyst', name: 'Bill Analyst', description: 'Reads a bill and turns its provisions into a structured fact sheet.', avatar: avatars.analyst, kind: 'creao', role: 'bill-analyst' },
  { id: 'bill-researcher', name: 'Bill Researcher', description: 'Finds sources, stakeholder views, and policy context for a bill.', avatar: avatars.researcher, kind: 'creao', role: 'researcher' },
  { id: 'bill-impact-planner', name: 'Bill Impact Planner', description: 'Builds company-specific scenarios and options to evaluate their business impact.', avatar: avatars.planner, kind: 'creao', role: 'impact-planner' },
  { id: 'test-agent', name: 'Test Agent', description: 'A general research agent for trying out the CREAO connection.', avatar: avatars.test, kind: 'creao', role: 'test-agent' },
  { id: 'finance-scout', name: 'Finance Scout', description: 'A sample concept for exploring a finance teammate.', avatar: avatars.analyst, kind: 'placeholder' },
  { id: 'people-partner', name: 'People Partner', description: 'A sample concept for exploring a people teammate.', avatar: avatars.researcher, kind: 'placeholder' },
  { id: 'supply-watch', name: 'Supply Watch', description: 'A sample concept for exploring a supply teammate.', avatar: avatars.planner, kind: 'placeholder' },
  { id: 'market-monitor', name: 'Market Monitor', description: 'A sample concept for exploring a market teammate.', avatar: avatars.test, kind: 'placeholder' },
]

export default function AgentsPanel({ reducedMotion }: { reducedMotion: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null)
  const [selectedAgent, setSelectedAgent] = useState<AgentCard | null>(null)

  useEffect(() => { heading.current?.focus() }, [])

  return <section className="agents-panel" aria-labelledby="agents-panel-title" data-reduced-motion={reducedMotion || undefined}>
    <div className="agents-panel-content">
      <header className="agents-panel-heading">
        <span className="agents-panel-kicker">MEET THE TEAM</span>
        <h1 id="agents-panel-title" ref={heading} tabIndex={-1}>Your agents.</h1>
        <p>The team behind your business.</p>
      </header>
      <div className="agents-grid">
        {agents.map((agent, index) => <article className="agent-card" key={agent.id} style={{ '--card-index': index } as CSSProperties}>
          <div className="agent-card-topline">
            <span className={`agent-kind agent-kind-${agent.kind}`}>{agent.kind === 'creao' ? 'CREAO agent' : 'Placeholder'}</span>
          </div>
          <AgentAvatar stillSrc={agent.avatar.still} animatedSrc={agent.avatar.animated} reducedMotion={reducedMotion}/>
          <h2><button type="button" className="agent-card-trigger" aria-haspopup="dialog" onClick={() => setSelectedAgent(agent)}>{agent.name}</button></h2>
          <p>{agent.description}</p>
        </article>)}
      </div>
    </div>
    {selectedAgent && <AgentRunDialog key={selectedAgent.id} agent={{ name: selectedAgent.name, role: selectedAgent.kind === 'creao' ? selectedAgent.role : null, avatar: selectedAgent.avatar }} reducedMotion={reducedMotion} onClose={() => setSelectedAgent(null)}/>}
  </section>
}
