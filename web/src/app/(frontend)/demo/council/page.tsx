import { notFound } from 'next/navigation'
import CouncilPanel from '@/components/business/CouncilPanel'
import { findDemoCompany } from '@/lib/demo-companies'
import type { CouncilJob, CouncilThread } from '@/lib/council-types'
import { councilBusinessKey } from '@/lib/council-types'

// Development-only fixture: the production renderer is used without network or storage effects.
export default async function CouncilDesignPreview({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>
}) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const active = (await searchParams).stage === 'skeptic'
  const business = findDemoCompany('harbor-goods')!.business
  const claim = (text: string) => ({ text, sourceIds: ['profile'] })
  const round: CouncilJob = {
    id: 'design-preview',
    previousJobId: null,
    rootJobId: 'design-preview',
    round: 1,
    business,
    businessKey: councilBusinessKey(business),
    question: 'Should we add more products, or focus on the range we already carry?',
    status: 'completed',
    stage: null,
    createdAt: '2026-10-24T12:00:00Z',
    updatedAt: '2026-10-24T12:00:00Z',
    message: null,
    sources: [
      {
        id: 'profile',
        title: 'Harbor Goods company setup',
        text: `${business.offering}. ${business.channels}. Products: ${business.products.map((product) => product.name).join(', ')}. This is an illustrative company profile, not evidence of current sales performance.`,
        provenance: 'Company setup · design preview fixture',
        kind: 'profile',
        url: null,
        companyMatch: 'explicit',
        warnings: ['Illustrative design preview. No live research or council generation.'],
      },
    ],
    turns: [
      {
        role: 'finance',
        sessionId: 'preview-finance',
        summary:
          'A wider range commits more cash before we know which products customers want. First establish the margin and inventory position of the current range.',
        claims: [
          claim(
            'The company sells through an online shop and two neighborhood stores, so any expansion needs to account for stock across channels.',
          ),
        ],
        challenges: [],
        uncertainties: [
          'Current margin, stock levels and working capital are not in the company setup.',
        ],
      },
      {
        role: 'operations',
        sessionId: 'preview-operations',
        summary:
          'Focus on making the existing range easy to replenish. A small, contained product trial would be easier to learn from than a broad launch.',
        claims: [],
        challenges: [],
        uncertainties: [],
      },
      {
        role: 'skeptic',
        sessionId: 'preview-skeptic',
        summary:
          'A smaller range is not automatically a better range. We need customer demand and sell-through evidence before treating focus as the answer.',
        claims: [],
        challenges: [
          claim(
            'Company setup describes the offering, but does not establish what is selling well.',
          ),
        ],
        uncertainties: [],
      },
      {
        role: 'chair',
        sessionId: 'preview-chair',
        summary: 'Make this an evidence decision before making it an inventory decision.',
        claims: [],
        challenges: [],
        uncertainties: [],
      },
    ],
    decision: {
      action: 'Review the current range before expanding.',
      confidence: 'low',
      relevance: 'insufficient_evidence',
      rationale: [
        claim(
          'The company profile establishes the channels and product range, but not the commercial case for expansion.',
        ),
      ],
      disagreements: [
        {
          text: 'Finance favors conserving cash. Operations leaves room for a limited trial. Skeptic needs demand evidence before endorsing either.',
          sourceIds: [],
        },
      ],
      nextSteps: [
        {
          text: 'Bring sales, margin and stock records for the current products, then identify one specific expansion candidate to compare.',
          sourceIds: [],
        },
      ],
      missingEvidence: [
        'Sales and margin by product and channel.',
        'Stock age, reorder lead times and customer requests.',
      ],
    },
  }
  if (active) {
    round.status = 'running'
    round.stage = 'skeptic'
    round.turns = round.turns.filter(
      (turn) => turn.role === 'finance' || turn.role === 'operations',
    )
    round.decision = null
  }
  const thread: CouncilThread = { rootJobId: round.id, rounds: [round] }
  return (
    <main style={{ position: 'fixed', inset: 0, background: '#dcf5fc' }}>
      <div
        style={{
          position: 'absolute',
          top: 30,
          left: 34,
          color: '#243957',
          fontFamily: 'Trebuchet MS',
          fontSize: 25,
        }}
      >
        consul <small style={{ fontSize: 11 }}> / council design studio</small>
      </div>
      <nav
        aria-label="Illustrative preview states"
        style={{
          position: 'absolute',
          top: 70,
          left: 34,
          display: 'flex',
          gap: 18,
          fontSize: 11,
          color: '#365e88',
        }}
      >
        <a href="/demo/council">Synthesis preview</a>
        <a href="/demo/council?stage=skeptic">Active council preview</a>
      </nav>
      <CouncilPanel
        key={active ? 'active' : 'completed'}
        business={business}
        previewThread={thread}
      />
    </main>
  )
}
