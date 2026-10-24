'use client'

import { useEffect, useRef, useState } from 'react'
import type { BusinessInput } from '@/lib/business-input'
import type { AgentRole } from '@/lib/agent-catalog'
import { councilBusinessKey, type CouncilClaim, type CouncilJob, type CouncilRequest, type CouncilSetup, type CouncilSourceOption } from '@/lib/council-types'

const seats = [
  { role: 'finance', name: 'Finance', initial: '$', purpose: 'Costs, exposure & tradeoffs', color: 'blue' },
  { role: 'operations', name: 'Operations', initial: '↗', purpose: 'Feasibility & execution', color: 'mint' },
  { role: 'skeptic', name: 'Skeptic', initial: '?', purpose: 'Assumptions & blind spots', color: 'peach' },
  { role: 'chair', name: 'Chair', initial: 'c.', purpose: 'A decision you can act on', color: 'lavender' },
] as const

class CouncilFetchError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message) }
}

type SavedCouncil = { request: CouncilRequest; submitted: boolean }
async function councilFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...options })
  const result = await response.json()
  if (!response.ok) throw new CouncilFetchError(result.error?.message || 'The council could not connect. Please try again.', response.status, result.error?.code)
  return result
}
function Claims({ title, claims }: { title: string; claims: CouncilClaim[] }) {
  if (!claims.length) return null
  return <div className="council-claims"><h4>{title}</h4><ul>{claims.map((claim, i) => <li key={i}>{claim.text}{claim.sourceIds.length > 0 && <span className="council-citations">{claim.sourceIds.map(id => <a key={id} href={`#council-source-${id}`} onClick={() => { const detail = document.getElementById(`council-source-${id}`); if (detail instanceof HTMLDetailsElement) detail.open = true }}>[{id}]</a>)}</span>}</li>)}</ul></div>
}

export default function CouncilPanel({ business }: { business: BusinessInput }) {
  const businessKey = councilBusinessKey(business)
  const storageKey = `consul-council:${businessKey}`
  const heading = useRef<HTMLHeadingElement>(null)
  const alive = useRef(true)
  const [setup, setSetup] = useState<CouncilSetup | null>(null)
  const [question, setQuestion] = useState('')
  const [role, setRole] = useState<AgentRole>('bill-analyst')
  const [options, setOptions] = useState<CouncilSourceOption[]>([])
  const [selected, setSelected] = useState<CouncilSourceOption[]>([])
  const [assigned, setAssigned] = useState(false)
  const [sourceBusy, setSourceBusy] = useState(false)
  const [sourcesLoaded, setSourcesLoaded] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextOffset, setNextOffset] = useState(0)
  const [saved, setSaved] = useState<SavedCouncil | null>(null)
  const [job, setJob] = useState<CouncilJob | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const sourceController = useRef<AbortController | null>(null)
  const terminal = !!job && ['completed', 'failed', 'interrupted'].includes(job.status)
  const frozen = !!saved
  const sameRef = (a: CouncilSourceOption, b: CouncilSourceOption) => JSON.stringify(a.ref) === JSON.stringify(b.ref)

  useEffect(() => {
    alive.current = true
    heading.current?.focus()
    const controller = new AbortController()
    councilFetch<CouncilSetup>('/api/council?view=setup', { signal: controller.signal }).then(setSetup).catch(e => { if (!controller.signal.aborted) setError(e.message) })
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const restored = JSON.parse(raw) as SavedCouncil
        if (restored.request.business && councilBusinessKey(restored.request.business) === businessKey) {
          setSaved(restored); setQuestion(restored.request.question)
        }
      }
    } catch { setError('Your saved council could not be read. Browser storage must be available before starting a run.') }
    return () => { alive.current = false; controller.abort(); sourceController.current?.abort() }
  }, [businessKey, storageKey])

  // Reload and polling only read the saved job. They never submit work or spend credits.
  useEffect(() => {
    if (!saved?.submitted || terminal) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const read = async () => {
      try {
        const result = await councilFetch<CouncilJob>(`/api/council?jobId=${saved.request.requestId}`, { signal: controller.signal })
        if (!controller.signal.aborted) { setJob(result); setError('') }
        if (!['completed', 'failed', 'interrupted'].includes(result.status)) timer = setTimeout(read, 1800)
      } catch (e) {
        if (!controller.signal.aborted) setError(`${e instanceof Error ? e.message : 'Unable to read the council.'} Retry uses the same request, without starting another council.`)
      }
    }
    void read()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [saved, terminal])

  async function loadSources(more = false) {
    sourceController.current?.abort()
    const controller = new AbortController()
    sourceController.current = controller
    setSourceBusy(true); setError('')
    try {
      const result = await councilFetch<{ sources: CouncilSourceOption[]; offset: number; limit: number; hasMore: boolean }>(`/api/council?view=sources&role=${role}&offset=${more ? nextOffset : 0}`, { signal: controller.signal })
      if (controller.signal.aborted) return
      setSourcesLoaded(true)
      setOptions(current => more ? [...current, ...result.sources] : result.sources)
      setHasMore(result.hasMore); setNextOffset(result.offset + result.limit)
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load sources.') }
    finally { if (!controller.signal.aborted) setSourceBusy(false) }
  }
  function toggleSource(option: CouncilSourceOption) {
    const removing = selected.some(item => sameRef(item, option))
    if (!removing && selected.length >= 8) { setError('Choose up to 8 evidence sources. Remove a selected source before adding another.'); return }
    setSelected(current => removing ? current.filter(item => !sameRef(item, option)) : [...current, option]); setAssigned(false); setError('')
  }
  async function convene() {
    setError('')
    const snapshot: SavedCouncil = saved ?? { request: { requestId: crypto.randomUUID(), business, question: question.trim(), sources: selected.map(item => item.ref), assignToCompany: true }, submitted: false }
    // Persist the immutable payload before any POST, including retries after an unknown outcome.
    try { localStorage.setItem(storageKey, JSON.stringify({ ...snapshot, submitted: true })) }
    catch { setError('Could not save the request identity. Enable browser storage before starting a council.'); return }
    setSaved({ ...snapshot, submitted: false }); setBusy(true)
    try {
      const result = await councilFetch<CouncilJob>('/api/council', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot.request) })
      if (alive.current) { setJob(result); setError(''); setSaved({ ...snapshot, submitted: true }) }
    } catch (e) {
      if (!alive.current) return
      if (e instanceof CouncilFetchError && [400, 403, 415].includes(e.status)) {
        try { localStorage.removeItem(storageKey); setSaved(null) } catch { setError('Could not clear the rejected request from browser storage.'); return }
        setError(`${e.message} Edit the question or sources, then convene again.`)
      } else {
        setSaved({ ...snapshot, submitted: true }); setError(`${e instanceof Error ? e.message : 'The submission outcome is unknown.'} Retry preserves the original request and sources.`)
      }
    }
    finally { if (alive.current) setBusy(false) }
  }
  function startAnother() {
    try { localStorage.removeItem(storageKey) } catch { setError('Could not clear the saved request.'); return }
    setSaved(null); setJob(null); setError(''); setAssigned(false)
  }
  const evidence = job?.sources ?? []
  const hasSample = evidence.some(source => source.kind === 'sample') || selected.some(source => source.ref.kind === 'sample')
  const selectedCount = saved ? saved.request.sources.length : selected.length
  const sample: CouncilSourceOption = { ref: { kind: 'sample', id: 'voltride-hr973' }, title: 'VoltRide · H.R. 973', description: 'Saved illustrative analysis. No fresh live policy data.', createdAt: null }

  return <section className="council-panel" aria-labelledby="council-title">
    <div className="council-page-heading"><div><span className="council-eyebrow">YOUR COUNCIL</span><h1 id="council-title" tabIndex={-1} ref={heading}>A decision.<br/><em>With the reasoning attached.</em></h1><p>Four perspectives. Shared evidence. One clear next move for {business.company}.</p></div><div className="council-heading-seal" aria-hidden="true"><span>c.</span><small>BETTER TOGETHER</small></div></div>
    <div className="council-profile-strip"><span className="council-live-dot"/><strong>{business.company}</strong><span>{business.products.length} products</span><span>{business.parts.length} supplier parts</span><span className="council-profile-offering">{business.offering}</span></div>
    <div className="council-layout"><div className="council-main">
      <section className="council-card council-question"><div className="council-card-top"><span className="council-eyebrow">01 / THE QUESTION</span><span className="council-tag">{selectedCount ? `${selectedCount} chosen sources` : 'Company setup only · no policy evidence'}</span></div><label htmlFor="council-question">What should your council work through?</label><textarea id="council-question" value={question} disabled={frozen} maxLength={2000} onChange={e => setQuestion(e.target.value)} placeholder={`Which decision should ${business.company} prioritize, and what evidence would change it?`} rows={3}/><p className="council-help">Ask about a business priority or a policy decision. Your company setup is always included.</p>
      {!setup ? <p role="status" className="council-readiness">Checking the Factory runtime…</p> : !setup.available && <p role="status" className="council-readiness">{setup.message || 'Factory is not configured. Add the server runtime key and CLI to convene a council.'} You can still browse and select CREAO sources.</p>}
      <div className="council-run-row">{terminal ? <button className="council-primary" type="button" onClick={startAnother}>Start another council <span>↗</span></button> : <button className="council-primary" type="button" disabled={!setup?.available || busy || (!saved && (!question.trim() || (selected.length > 0 && !assigned))) || (!!job && !error)} onClick={() => void convene()}>{busy ? 'Submitting…' : saved ? error ? 'Retry this council' : 'Council in progress' : 'Convene council'}<span>↗</span></button>}<small>On run, your company profile and selected text are sent to Factory. Uses Factory credits.</small></div></section>
      {error && <div className="council-error" role="alert"><p>{error}</p>{saved?.submitted && !terminal && <button className="council-secondary" type="button" disabled={busy} onClick={() => { setError(''); setSaved({ ...saved }) }}>Read saved status</button>}</div>}
      {job?.decision && <section className="council-card council-decision"><div className="council-card-top"><span className="council-eyebrow">THE RECOMMENDATION</span><span className="council-tag">{job.decision.confidence} confidence</span></div><h2>{job.decision.action}</h2><p className="council-relevance">Relevance: {job.decision.relevance.replaceAll('_', ' ')}</p><Claims title="Why this decision" claims={job.decision.rationale}/><Claims title="Where the council disagrees" claims={job.decision.disagreements}/><Claims title="Your next steps" claims={job.decision.nextSteps}/>{job.decision.missingEvidence.length > 0 && <div className="council-claims"><h4>Evidence still needed</h4><ul>{job.decision.missingEvidence.map(text => <li key={text}>{text}</li>)}</ul></div>}</section>}
      <section className="council-card council-discussion"><div className="council-card-top"><div><span className="council-eyebrow">02 / AROUND THE TABLE</span><h2>The discussion</h2></div><span className="council-tag" role="status">{job ? job.status : 'Ready when you are'}</span></div><p className="council-help">{job?.message || (job ? `Working from ${evidence.length} evidence records. ${job.stage ? `${job.stage} is considering the question.` : 'Preparing the council.'}` : 'Four perspectives, with their assumptions and sources in the open.')}</p>
      <div className="council-turns">{seats.map(seat => { const turn = job?.turns.find(item => item.role === seat.role); return <article className="council-turn" key={seat.role}><span className={`council-avatar ${seat.color}`} aria-hidden="true">{seat.initial}</span><div className="council-turn-body"><div className="council-turn-heading"><h3>{seat.name}</h3><span>{turn ? 'Contributed' : job?.stage === seat.role ? 'Thinking…' : 'Awaiting council'}</span></div><p className="council-seat-purpose">{seat.purpose}</p>{turn ? <><p>{turn.summary}</p><Claims title="Reasoning" claims={turn.claims}/><Claims title="Challenges" claims={turn.challenges}/>{turn.uncertainties.length > 0 && <div className="council-claims"><h4>Uncertainties</h4><ul>{turn.uncertainties.map(text => <li key={text}>{text}</li>)}</ul></div>}</> : <p className="council-pending">{job?.stage === seat.role ? 'Reviewing the company and selected evidence.' : 'This seat will contribute when you convene the council.'}</p>}</div></article> })}</div></section>
    </div><aside className="council-evidence-rail" aria-label="Council evidence">
      <section className="council-card"><div className="council-card-top"><span className="council-eyebrow">THE CONTEXT</span><span className="council-tag">Always included</span></div><h2>{business.company}</h2><p>{business.offering}</p><p className="council-help">{business.channels}</p><details><summary>Company products & supplier parts</summary><ul className="council-profile-list">{business.products.map((product, i) => <li key={i}><strong>{product.name}</strong><span>${product.price.toLocaleString()} · {product.units.toLocaleString()} annual units</span></li>)}{business.parts.map((part, i) => <li key={`part-${i}`}><strong>{part.part}</strong><span>{part.supplier} · ${part.cost.toLocaleString()}</span></li>)}</ul></details></section>
      <section className="council-card"><span className="council-eyebrow">03 / THE EVIDENCE</span><h2>Bring the source.</h2><p className="council-help">Choose completed CREAO conversations and artifacts, then assign them to this company.</p><label className="council-source-label" htmlFor="council-source-role">CREAO agent</label><select id="council-source-role" disabled={frozen} value={role} onChange={e => { sourceController.current?.abort(); setSourceBusy(false); setRole(e.target.value as AgentRole); setOptions([]); setSourcesLoaded(false); setHasMore(false) }}>{(setup?.roles ?? []).map(item => <option key={item.role} value={item.role} disabled={!item.configured}>{item.name}{!item.configured ? ' · not configured' : ''}</option>)}</select><button type="button" className="council-secondary" disabled={frozen || sourceBusy || !setup?.roles.some(item => item.role === role && item.configured)} onClick={() => void loadSources()}>{sourceBusy ? 'Loading…' : 'Load CREAO results'}</button>
      {sourcesLoaded && options.length === 0 && <p className="council-help" role="status">No completed text results yet for this agent.</p>}
      {options.length > 0 && <div className="council-source-options">{options.map((option, i) => <label key={`${JSON.stringify(option.ref)}-${i}`}><input type="checkbox" disabled={frozen} checked={selected.some(item => sameRef(item, option))} onChange={() => toggleSource(option)}/><span><strong>{option.title}</strong><small>{option.description}</small></span></label>)}</div>}{hasMore && <button className="council-text-button" type="button" disabled={frozen || sourceBusy} onClick={() => void loadSources(true)}>Load more results</button>}
      {business.company.trim().toLowerCase() === 'voltride' && <label className="council-sample-option"><input type="checkbox" disabled={frozen} checked={selected.some(item => item.ref.kind === 'sample')} onChange={() => toggleSource(sample)}/><span><strong>Attach saved VoltRide example</strong><small>Illustrative H.R. 973 analysis. No fresh live data.</small></span></label>}
      {selected.length > 0 && <div className="council-assignment"><ul className="council-selected-list">{selected.map(item => <li key={JSON.stringify(item.ref)}><span>{item.title}</span>{!frozen && <button type="button" aria-label={`Remove ${item.title}`} onClick={() => toggleSource(item)}>×</button>}</li>)}</ul><p>{selected.length} source{selected.length === 1 ? '' : 's'} selected{assigned ? ` for ${business.company}` : '. Confirm that these belong to your company.'}</p><button type="button" className="council-secondary" disabled={frozen || assigned} onClick={() => setAssigned(true)}>{assigned ? 'Sources assigned ✓' : `Use these sources for ${business.company}`}</button></div>}
      {hasSample && <p className="council-sample-note">Saved illustrative analysis · not fresh live policy data</p>}
      <div className="council-evidence-list">{evidence.length ? evidence.map(source => <details key={source.id} id={`council-source-${source.id}`}><summary><span className="council-source-id">{source.id}</span><strong>{source.title}</strong></summary><p className="council-provenance">{source.provenance}</p><p className="council-excerpt">{source.text}</p>{source.warnings.map(warning => <p className="council-source-warning" key={warning}>{warning}</p>)}{source.url && (/^https?:\/\//.test(source.url) || /^\/api\/agent-runs\//.test(source.url)) && <a href={source.url} target="_blank" rel="noreferrer">Open source / download ↗</a>}</details>) : <div className="council-evidence-empty"><span aria-hidden="true">↗</span><strong>Your evidence, in one place.</strong><p>Source excerpts appear here when a council runs. Without selected sources, analysis uses company setup only.</p></div>}</div></section>
    </aside></div><div className="council-bottom-note">A considered recommendation. The final call is yours.</div>
  </section>
}
