import { notFound } from 'next/navigation'
import CouncilDemoPlayer from './CouncilDemoPlayer'
import { findDemoCompany } from '@/lib/demo-companies'
import type { CouncilArtifact, CouncilJob } from '@/lib/council-types'
import { councilBusinessKey } from '@/lib/council-types'

// Development-only fixture: the production renderer is used without network or storage effects.
export default async function CouncilDesignPreview({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>
}) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const stage = (await searchParams).stage
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
  const base = { createdAt: round.createdAt, sourceIds: ['profile'], illustrative: true, assumptions: ['All values and locations are fictional examples for this design preview. They do not describe actual sales.'] }
  round.artifacts = [
    { ...base, id: 'demo-bar', role: 'finance', title: 'Illustrative margin comparison', kind: 'chart', chartType: 'bar', labels: ['Current range', 'Small trial', 'Full expansion'], series: [{ label: 'Scenario margin', values: [32, 28, 21] }], unit: '%' },
    { ...base, id: 'demo-line', role: 'finance', title: 'Illustrative demand trend', kind: 'chart', chartType: 'line', labels: ['Week 1', 'Week 2', 'Week 3'], series: [{ label: 'Trial units', values: [12, 20, 18] }] },
    { ...base, id: 'demo-table', role: 'operations', title: 'Compare the next steps', kind: 'table', columns: ['Option', 'Stock commitment', 'Learning'], rows: [['Current range', 'Low', 'Establish baseline'], ['Small trial', 'Limited', 'Observe demand'], ['Full expansion', 'High', 'Many variables']] },
    { ...base, id: 'demo-flow', role: 'operations', title: 'A staged decision', kind: 'flowchart', nodes: [{ id: 'review', label: 'Review current sales' }, { id: 'trial', label: 'Run a limited trial' }, { id: 'decide', label: 'Compare margin and demand' }], edges: [{ from: 'review', to: 'trial', label: 'If evidence supports it' }, { from: 'trial', to: 'decide' }] },
    { ...base, id: 'demo-map', role: 'skeptic', title: 'Illustrative channel locations', kind: 'map', markers: [{ label: 'Example west store', latitude: 37.8, longitude: -122.4 }, { label: 'Example east store', latitude: 40.7, longitude: -74 }] },
    { ...base, id: 'demo-html', role: 'chair', title: 'Explore an illustrative trial budget', kind: 'html', html: `<style>body{font:16px system-ui;color:#243957;background:#fffdf4;padding:20px}input{width:100%}output{font-size:26px;color:#6750a4;font-weight:bold}</style><h2>Illustrative trial budget</h2><p>Fictional fixed unit cost: $12. No live business data.</p><label for="units">Trial quantity</label><input id="units" type="range" min="10" max="100" value="30"><p><span id="quantity">30</span> units · <output id="cost">$360</output></p><script>document.getElementById('units').addEventListener('input',function(){document.getElementById('quantity').textContent=this.value;document.getElementById('cost').textContent='$'+Number(this.value)*12})</script>` },
  ] satisfies CouncilArtifact[]
  round.toolCalls = round.artifacts.map((artifact) => ({ id: `call-${artifact.id}`, role: artifact.role, name: 'publish_visual', title: artifact.title, status: 'completed', startedAt: round.createdAt, completedAt: round.updatedAt, artifactIds: [artifact.id] }))
  return <CouncilDemoPlayer key={stage ?? 'completed'} round={round} initialStep={stage === 'play' ? 0 : stage === 'skeptic' ? 2 : 4} autoplay={stage === 'play'} />
}
