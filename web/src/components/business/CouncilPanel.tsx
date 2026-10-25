'use client'

import { useEffect, useRef, useState } from 'react'
import type { BusinessInput } from '@/lib/business-input'
import type { AgentRole } from '@/lib/agent-catalog'
import {
  councilBusinessKey,
  type CouncilClaim,
  type CouncilJob,
  type CouncilRequest,
  type CouncilSetup,
  type CouncilSourceOption,
  type CouncilThread,
} from '@/lib/council-types'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message'
import { Shimmer } from '@/components/ai-elements/shimmer'
import AgentAvatar from './AgentAvatar'
import CouncilArtifactView from './CouncilArtifact'
import { Button } from '@/components/ui/button'

const seats = [
  {
    role: 'finance',
    name: 'Finance',
    avatar: 'bill-analyst',
    purpose: 'Costs & exposure',
    focus: 'Reviewing costs',
  },
  {
    role: 'operations',
    name: 'Operations',
    avatar: 'impact-planner',
    purpose: 'Feasibility & execution',
    focus: 'Checking execution',
  },
  {
    role: 'skeptic',
    name: 'Skeptic',
    avatar: 'researcher',
    purpose: 'Assumptions & blind spots',
    focus: 'Challenging assumptions',
  },
  {
    role: 'chair',
    name: 'Chair',
    avatar: 'test-agent',
    purpose: 'The next move',
    focus: 'Synthesizing the decision',
  },
] as const

// Dedicated Council palette preserves the animated characters; CREAO assets stay unchanged.
function CouncilAvatar({
  seat,
  reducedMotion,
}: {
  seat: (typeof seats)[number]
  reducedMotion: boolean
}) {
  return (
    <span className="council-avatar">
      <AgentAvatar
        stillSrc={`/agents/council-${seat.avatar}.svg`}
        animatedSrc={`/agents/council-${seat.avatar}-animated.svg`}
        reducedMotion={reducedMotion}
      />
    </span>
  )
}

const turnIdentity = (round: CouncilJob, role: string) => `${round.id}:${role}`

// Factory publishes whole, validated summaries. Reveal their words locally;
// this is presentation, not a provider stream or a view into private reasoning.
function CouncilSummary({
  text,
  reveal,
  reducedMotion,
  motionReady,
}: {
  text: string
  reveal: boolean
  reducedMotion: boolean
  motionReady: boolean
}) {
  const [visibleText, setVisibleText] = useState(reveal ? '' : text)
  const [revealing, setRevealing] = useState(false)
  const finished = useRef(false)
  useEffect(() => {
    if (!motionReady) return
    if (!reveal || reducedMotion || finished.current) {
      finished.current = true
      setVisibleText(text)
      setRevealing(false)
      return
    }
    const words = text.match(/\S+\s*/g) ?? [text]
    let count = 0
    setVisibleText('')
    setRevealing(true)
    const timer = window.setInterval(() => {
      count = Math.min(count + 1, words.length)
      setVisibleText(words.slice(0, count).join(''))
      if (count === words.length) {
        finished.current = true
        window.clearInterval(timer)
        setVisibleText(text)
        setRevealing(false)
      }
    }, 48)
    return () => window.clearInterval(timer)
  }, [text, reveal, reducedMotion, motionReady])
  // The log exposes the validated summary once, independent of visual progress.
  // Hiding only the animated copy prevents every word becoming an announcement.
  return (
    <div className="council-summary" role="group" aria-label={text}>
      <div aria-hidden="true">
        <MessageResponse
          animated={reducedMotion ? undefined : { animation: 'fadeIn', duration: 180 }}
          isAnimating={revealing}
        >
          {motionReady && reducedMotion ? text : visibleText}
        </MessageResponse>
      </div>
    </div>
  )
}

type SavedCouncil = {
  request: CouncilRequest
  submitted: boolean
  leafId?: string
  pending?: boolean
}
class CouncilFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
  }
}
async function councilFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...options })
  const result = await response.json()
  if (!response.ok)
    throw new CouncilFetchError(
      result.error?.message || 'The council could not connect. Please try again.',
      response.status,
      result.error?.code,
    )
  return result
}
function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

function Claims({
  title,
  claims,
  onSource,
}: {
  title: string
  claims: CouncilClaim[]
  onSource: (id: string) => void
}) {
  if (!claims.length) return null
  return (
    <div className="council-claims">
      <h4>{title}</h4>
      <ul>
        {claims.map((claim, index) => (
          <li key={index}>
            {claim.text}
            {claim.sourceIds.map((id) => (
              <Button
                className="council-citation"
                size="sm"
                key={id}
                onClick={() => onSource(id)}
                aria-label={`Inspect source ${id}`}
              >
                {id}
              </Button>
            ))}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function CouncilPanel({
  business,
  previewThread,
}: {
  business: BusinessInput
  previewThread?: CouncilThread
}) {
  const businessKey = councilBusinessKey(business)
  const storageKey = `consul-council:${businessKey}`
  const heading = useRef<HTMLHeadingElement>(null)
  const contextRef = useRef<HTMLElement>(null)
  const contextToggle = useRef<HTMLButtonElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  const alive = useRef(true)
  const sourceController = useRef<AbortController | null>(null)
  const [setup, setSetup] = useState<CouncilSetup | null>(null)
  const [question, setQuestion] = useState('')
  function prefillQuestion(text: string) {
    setQuestion(text)
    composer.current?.focus()
  }
  const [role, setRole] = useState<AgentRole>('bill-analyst')
  const [options, setOptions] = useState<CouncilSourceOption[]>([])
  const [selected, setSelected] = useState<CouncilSourceOption[]>([])
  const [assigned, setAssigned] = useState(false)
  const [sourceBusy, setSourceBusy] = useState(false)
  const [sourcesLoaded, setSourcesLoaded] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextOffset, setNextOffset] = useState(0)
  const [saved, setSaved] = useState<SavedCouncil | null>(null)
  const [thread, setThread] = useState<CouncilThread | null>(previewThread ?? null)
  const seenTurns = useRef<Set<string> | null>(
    previewThread
      ? new Set(
          previewThread.rounds.flatMap((round) =>
            round.turns.map((turn) => turnIdentity(round, turn.role)),
          ),
        )
      : null,
  )
  const [revealedTurns, setRevealedTurns] = useState<Set<string>>(() => {
    const lastRound = previewThread?.rounds.at(-1)
    const lastTurn = lastRound?.turns.at(-1)
    return new Set(lastRound && lastTurn ? [turnIdentity(lastRound, lastTurn.role)] : [])
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [readVersion, setReadVersion] = useState(0)
  const [contextOpen, setContextOpen] = useState(false)
  const [inspectedSource, setInspectedSource] = useState<string | null>(null)
  const [reducedMotion, setReducedMotion] = useState(true)
  const [motionReady, setMotionReady] = useState(false)
  const job = thread?.rounds.at(-1)
  const terminal = !!job && ['completed', 'failed', 'interrupted'].includes(job.status)
  const pending = !!saved && (saved.pending ?? !terminal)
  const frozen = !!saved || !!thread
  const activeSeat =
    job?.status === 'running' ? seats.find((seat) => seat.role === job.stage) : null
  function seatModel(role: (typeof seats)[number]['role']) {
    const turn = job?.turns.find((item) => item.role === role)
    if (turn) return turn.modelId ?? 'Model not recorded'
    const recorded = job?.speakers?.[role]?.modelId
    if (recorded) return recorded
    if (job && job.status !== 'running' && job.status !== 'resolving') return 'Model unavailable'
    const configured = setup?.members?.find((member) => member.role === role)?.modelId
    return configured ? `${configured} · configured` : 'Model unavailable'
  }
  const recordedEvidence = [...(thread?.rounds[0]?.sources ?? []), ...(thread?.rounds.flatMap((round) => round.toolEvidence ?? []) ?? [])]
  const recordedIds = new Set(recordedEvidence.map((item) => item.id))
  const generatedReferences = thread?.rounds.flatMap((round) => (round.artifacts ?? [])
    .filter((artifact) => !recordedIds.has(artifact.id) && artifact.kind !== 'calculation' && artifact.kind !== 'research')
    .map((artifact) => ({ id: artifact.id, title: artifact.title, kind: 'artifact' as const, text: JSON.stringify(artifact, null, 2), provenance: 'Generated output · discussion reference, not independent factual evidence', url: null, companyMatch: 'explicit' as const, warnings: ['This generated output can be discussed; it does not independently establish factual or numerical claims.'] }))) ?? []
  const evidence = [...recordedEvidence, ...generatedReferences]
  const source = evidence.find((item) => item.id === inspectedSource)
  const sameRef = (a: CouncilSourceOption, b: CouncilSourceOption) =>
    JSON.stringify(a.ref) === JSON.stringify(b.ref)

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      setReducedMotion(preference.matches)
      setMotionReady(true)
    }
    update()
    preference.addEventListener('change', update)
    return () => preference.removeEventListener('change', update)
  }, [])

  function receiveThread(next: CouncilThread, submitted = false) {
    const identities = new Set(
      next.rounds.flatMap((round) => round.turns.map((turn) => turnIdentity(round, turn.role))),
    )
    const previous = seenTurns.current
    if (previous || submitted) {
      const appended = [...identities].filter((identity) => !previous?.has(identity))
      if (appended.length) setRevealedTurns((current) => new Set([...current, ...appended]))
    }
    // The first saved-thread read establishes a static history baseline.
    seenTurns.current = identities
    setThread(next)
  }

  useEffect(() => {
    alive.current = true
    heading.current?.focus()
    if (previewThread)
      return () => {
        alive.current = false
      }
    const controller = new AbortController()
    councilFetch<CouncilSetup>('/api/council?view=setup', { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setSetup(result)
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message)
      })
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const restored = JSON.parse(raw) as SavedCouncil
        if (
          restored.request.business &&
          councilBusinessKey(restored.request.business) === businessKey
        )
          setSaved(restored)
      }
    } catch {
      setError(
        'Your saved council could not be read. Browser storage must be available before sending.',
      )
    }
    return () => {
      alive.current = false
      controller.abort()
      sourceController.current?.abort()
    }
  }, [businessKey, storageKey, previewThread])

  // Mount and polling are read-only. An uncertain POST retains its exact payload for an explicit retry.
  useEffect(() => {
    if (previewThread || !saved?.submitted) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const read = async () => {
      try {
        const result = await councilFetch<CouncilThread>(
          `/api/council?view=thread&jobId=${encodeURIComponent(saved.leafId ?? saved.request.requestId)}`,
          { signal: controller.signal },
        )
        if (controller.signal.aborted) return
        receiveThread(result)
        setError('')
        const last = result.rounds.at(-1)
        if (last && ['completed', 'failed', 'interrupted'].includes(last.status)) {
          const completed = { ...saved, leafId: last.id, pending: false }
          localStorage.setItem(storageKey, JSON.stringify(completed))
          setSaved(completed)
        } else timer = setTimeout(read, 1800)
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            `${e instanceof Error ? e.message : 'Unable to read the council.'} Your request identity is saved. Read status or retry the same request.`,
          )
      }
    }
    void read()
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
    // A terminal read updates saved once; no need to restart that completed read.
  }, [saved?.request.requestId, saved?.submitted, readVersion, previewThread, storageKey])

  useEffect(() => {
    if (contextOpen)
      contextRef.current?.querySelector<HTMLButtonElement>('.council-context-close')?.focus()
  }, [contextOpen])

  async function loadSources(more = false) {
    if (previewThread) return
    sourceController.current?.abort()
    const controller = new AbortController()
    sourceController.current = controller
    setSourceBusy(true)
    setError('')
    try {
      const result = await councilFetch<{
        sources: CouncilSourceOption[]
        offset: number
        limit: number
        hasMore: boolean
      }>(`/api/council?view=sources&role=${role}&offset=${more ? nextOffset : 0}`, {
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      setSourcesLoaded(true)
      setOptions((current) => (more ? [...current, ...result.sources] : result.sources))
      setHasMore(result.hasMore)
      setNextOffset(result.offset + result.limit)
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : 'Could not load sources.')
    } finally {
      if (!controller.signal.aborted) setSourceBusy(false)
    }
  }
  function toggleSource(option: CouncilSourceOption) {
    const removing = selected.some((item) => sameRef(item, option))
    if (!removing && selected.length >= 8) {
      setError('Choose up to 8 evidence sources.')
      return
    }
    setSelected((current) =>
      removing ? current.filter((item) => !sameRef(item, option)) : [...current, option],
    )
    setAssigned(false)
  }
  async function send() {
    if (previewThread || busy) return
    const snapshot: SavedCouncil =
      pending && saved
        ? saved
        : {
            request: {
              requestId: crypto.randomUUID(),
              business,
              question: question.trim(),
              sources: job ? [] : selected.map((item) => item.ref),
              assignToCompany: true,
              ...(job ? { previousJobId: job.id } : {}),
            },
            submitted: true,
            pending: true,
          }
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          ...snapshot,
          submitted: true,
          pending: true,
          leafId: snapshot.request.requestId,
        }),
      )
    } catch {
      setError('Could not save the request identity. Enable browser storage before sending.')
      return
    }
    setSaved({ ...snapshot, submitted: false, pending: true, leafId: snapshot.request.requestId })
    setBusy(true)
    setError('')
    try {
      const result = await councilFetch<CouncilJob>('/api/council', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot.request),
      })
      if (!alive.current) return
      receiveThread(
        {
          rootJobId: result.rootJobId,
          rounds: [...(thread?.rounds.filter((item) => item.id !== result.id) ?? []), result],
        },
        true,
      )
      const accepted = {
        ...snapshot,
        submitted: true,
        leafId: result.id,
        pending: !['completed', 'failed', 'interrupted'].includes(result.status),
      }
      localStorage.setItem(storageKey, JSON.stringify(accepted))
      setSaved(accepted)
      setQuestion('')
    } catch (e) {
      if (!alive.current) return
      if (
        e instanceof CouncilFetchError &&
        ([400, 403, 415].includes(e.status) ||
          [
            'CONTEXT_TOO_LARGE',
            'INPUT_TOO_LARGE',
            'THREAD_LIMIT_REACHED',
            'INVALID_COUNCIL_THREAD',
            'PREVIOUS_COUNCIL_NOT_COMPLETE',
            'COUNCIL_COMPANY_CHANGED',
            'JOB_NOT_FOUND',
          ].includes(e.code ?? ''))
      ) {
        const previous = thread?.rounds.at(-1)
        if (previous && saved) {
          const restored = { ...saved, leafId: previous.id, pending: false }
          localStorage.setItem(storageKey, JSON.stringify(restored))
          setSaved(restored)
        } else {
          localStorage.removeItem(storageKey)
          setSaved(null)
        }
        setError(`${e.message} Edit your message and try again.`)
      } else {
        setSaved({
          ...snapshot,
          submitted: true,
          pending: true,
          leafId: snapshot.request.requestId,
        })
        setError(
          `${e instanceof Error ? e.message : 'The submission outcome is unknown.'} Retry uses the original request.`,
        )
      }
    } finally {
      if (alive.current) setBusy(false)
    }
  }
  function newConversation() {
    if (previewThread) return
    try {
      localStorage.removeItem(storageKey)
    } catch {
      setError('Could not clear the saved request.')
      return
    }
    setSaved(null)
    setThread(null)
    seenTurns.current = null
    setRevealedTurns(new Set())
    setQuestion('')
    setSelected([])
    setAssigned(false)
    setError('')
    setInspectedSource(null)
  }
  const maxRounds = (job?.round ?? 0) >= 4
  const canSend =
    !!setup?.available &&
    !busy &&
    (pending
      ? !!error
      : !!question.trim() &&
        (!job || job.status === 'completed') &&
        !maxRounds &&
        (frozen || !selected.length || assigned))
  function closeContext() {
    setContextOpen(false)
    contextToggle.current?.focus()
  }
  const inspect = (id: string) => {
    setInspectedSource(id)
    setContextOpen(true)
  }
  const sample: CouncilSourceOption = {
    ref: { kind: 'sample', id: 'voltride-hr973' },
    title: 'Saved VoltRide · H.R. 973 example',
    description: 'Fictional saved analysis, not fresh policy data.',
    createdAt: null,
  }

  return (
    <section className="council-panel" aria-label="Council conversation">
      <header className="council-toolbar">
        <h1 tabIndex={-1} ref={heading}>Council</h1>
        <div className="council-toolbar-actions">
          <Button
            ref={contextToggle}
            className="council-context-toggle"
            onClick={() => (contextOpen ? closeContext() : setContextOpen(true))}
            aria-expanded={contextOpen}
            aria-controls="council-context"
          >
            Context & sources
          </Button>
          <Button
            disabled={!!previewThread || pending || busy}
            onClick={newConversation}
          >
            New conversation ＋
          </Button>
        </div>
      </header>
      {previewThread && (
        <div className="council-preview-banner">
          Design preview · illustrative conversation, not a live council. No model calls or saved
          changes.
        </div>
      )}
      <div className="council-workspace">
        <aside className="council-roster" aria-label="Council members in speaking order">
          <span className="council-eyebrow">AROUND THE TABLE</span>
          {seats.map((seat, index) => (
            <div
              className={`council-seat ${activeSeat?.role === seat.role ? 'active' : ''}`}
              key={seat.role}
              title={`${seat.name} · ${seat.purpose}`}
            >
              <CouncilAvatar seat={seat} reducedMotion={reducedMotion} />
              <div>
                <strong>{seat.name}</strong>
                <small>{activeSeat?.role === seat.role ? seat.focus : seat.purpose}</small>
                <small className="council-model">{seatModel(seat.role)}</small>
              </div>
              <span className="council-seat-order">0{index + 1}</span>
            </div>
          ))}
          <p className="council-roster-note">
            Different perspectives.
            <br />
            One shared decision.
          </p>
          <div className="council-order">
            Finance → Operations
            <br />→ Skeptic → Chair
          </div>
        </aside>
        <div className="council-thread-column">
          {thread && <div className="council-thread-meta">
            <span>
              {`${thread.rounds.length} round${thread.rounds.length === 1 ? '' : 's'} · ${job?.status}`}
            </span>
            <span className="council-focus">
              {activeSeat
                ? `${activeSeat.name} · ${activeSeat.focus}`
                : 'Four perspectives, one next move'}
            </span>
          </div>}
          <Conversation>
            <ConversationContent>
              {!thread && (
                <div className="council-empty">
                  <span className="council-empty-mark">
                    <CouncilAvatar seat={seats[3]} reducedMotion={reducedMotion} />
                  </span>
                  <h2>What’s on your mind?</h2>
                  <p>
                    Bring a question. Finance, Operations and Skeptic will consider it in turn, then
                    Chair will bring the decision together.
                  </p>
                  <Button
                    onClick={() =>
                      prefillQuestion(
                        `What should ${business.company} prioritize next, and what evidence would change that decision?`,
                      )
                    }
                  >
                    Find our next priority
                  </Button>
                  <Button
                    onClick={() =>
                      prefillQuestion(
                        'Challenge the assumptions in our current company plan. What should we verify first?',
                      )
                    }
                  >
                    Challenge an assumption
                  </Button>
                  <small>
                    Company setup is included. Add policy evidence in Context & sources.
                  </small>
                </div>
              )}
              {thread?.rounds.map((round) => (
                <div className="council-round" key={round.id}>
                  <div className="council-round-label">ROUND {round.round}</div>
                  <Message from="user">
                    <MessageContent>
                      <small>You</small>
                      <p>{round.question}</p>
                    </MessageContent>
                  </Message>
                  {seats.map((seat) => {
                    const turn = round.turns.find((item) => item.role === seat.role)
                    const artifacts = round.artifacts?.filter((artifact) => artifact.role === seat.role) ?? []
                    const toolCalls = round.toolCalls?.filter((call) => call.role === seat.role) ?? []
                    if (!turn && !artifacts.length && !toolCalls.length && !(seat.role === 'chair' && round.decision)) return null
                    return (
                      <Message from="assistant" key={seat.role}>
                        <CouncilAvatar seat={seat} reducedMotion={reducedMotion} />
                        <MessageContent>
                          <div className="council-byline">
                            <strong>{seat.name}</strong>
                            <span>
                              {turn ? turn.modelId ?? 'Model not recorded' : round.speakers?.[seat.role]?.modelId ?? 'Model unavailable'}{turn?.reasoningEffort ? ` · ${turn.reasoningEffort}` : ''}
                            </span>
                          </div>
                          {toolCalls.length > 0 && <ul className="council-tool-activity" aria-label={`${seat.name} tool activity`}>
                            {toolCalls.map((call) => <li key={call.id} data-status={call.status}><span className="council-tool-status">{call.status}</span><strong>{call.title}</strong><small>{call.name}{call.completedAt ? ` · ${Math.max(0, Math.round((Date.parse(call.completedAt) - Date.parse(call.startedAt)) / 1000))}s` : ''}</small>{call.error && <p>{call.error}</p>}</li>)}
                          </ul>}
                          {artifacts.map((artifact) => <CouncilArtifactView key={artifact.id} artifact={artifact} onSource={inspect} />)}
                          {turn && (
                            <>
                              <CouncilSummary
                                text={turn.summary}
                                reveal={revealedTurns.has(turnIdentity(round, seat.role))}
                                reducedMotion={reducedMotion}
                                motionReady={motionReady}
                              />
                              {(turn.claims.length > 0 || turn.challenges.length > 0) && (
                                <details className="council-specialist-details">
                                  <summary>Review reasoning & challenges</summary>
                                  <Claims
                                    title="Reasoning"
                                    claims={turn.claims}
                                    onSource={inspect}
                                  />
                                  <Claims
                                    title="Challenges"
                                    claims={turn.challenges}
                                    onSource={inspect}
                                  />
                                </details>
                              )}
                              {turn.uncertainties.length > 0 && (
                                <details className="council-uncertainties">
                                  <summary>Open questions · {turn.uncertainties.length}</summary>
                                  <ul>
                                    {turn.uncertainties.map((text) => (
                                      <li key={text}>{text}</li>
                                    ))}
                                  </ul>
                                </details>
                              )}
                            </>
                          )}
                          {seat.role === 'chair' && round.decision && (
                            <div className="council-decision">
                              <div className="council-decision-top">
                                <span className="council-eyebrow">CHAIR · A PATH FORWARD</span>
                                <span>{round.decision.confidence} confidence</span>
                              </div>
                              <h2>{round.decision.action}</h2>
                              <span className="council-relevance">
                                {round.decision.relevance.replaceAll('_', ' ')}
                              </span>
                              <Claims
                                title="First step"
                                claims={round.decision.nextSteps.slice(0, 1)}
                                onSource={inspect}
                              />
                              <details className="council-decision-details">
                                <summary>Review the decision and evidence</summary>
                                <Claims
                                  title="Why this decision"
                                  claims={round.decision.rationale}
                                  onSource={inspect}
                                />
                                <Claims
                                  title="Tradeoffs & disagreements"
                                  claims={round.decision.disagreements}
                                  onSource={inspect}
                                />
                                <Claims
                                  title="Next steps"
                                  claims={round.decision.nextSteps}
                                  onSource={inspect}
                                />
                                {round.decision.missingEvidence.length > 0 && (
                                  <div className="council-claims">
                                    <h4>Evidence still needed</h4>
                                    <ul>
                                      {round.decision.missingEvidence.map((text) => (
                                        <li key={text}>{text}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </details>
                              <div className="council-followups">
                                <Button
                                  onClick={() =>
                                    prefillQuestion('What evidence would change your recommendation?')
                                  }
                                >
                                  Challenge this decision
                                </Button>
                                <Button
                                  onClick={() =>
                                    prefillQuestion(
                                      'Turn this recommendation into a practical plan with an owner and a first step.',
                                    )
                                  }
                                >
                                  Explore the next steps
                                </Button>
                              </div>
                            </div>
                          )}
                        </MessageContent>
                      </Message>
                    )
                  })}
                  {round.status === 'running' || round.status === 'resolving' ? (
                    <p className="council-stage" role="status">
                      <span className="council-stage-dot" aria-hidden="true" />
                      <Shimmer reducedMotion={reducedMotion}>
                        {round.status === 'running'
                          ? `${seats.find((seat) => seat.role === round.stage)?.name ?? 'Council'} · ${seats.find((seat) => seat.role === round.stage)?.focus ?? 'Preparing discussion'}`
                          : 'Preparing the shared evidence'}
                      </Shimmer>
                    </p>
                  ) : (
                    round.message && <p className="council-stage">{round.message}</p>
                  )}
                </div>
              ))}
              {pending &&
                saved &&
                !thread?.rounds.some((round) => round.id === saved.request.requestId) && (
                  <Message from="user">
                    <MessageContent>
                      <small>You · {busy ? 'sending' : 'status unconfirmed'}</small>
                      <p>{saved.request.question}</p>
                    </MessageContent>
                  </Message>
                )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
          <div className="council-composer-area">
            {error && (
              <div className="council-error" role="alert">
                {error}
                {pending && (
                  <Button onClick={() => setReadVersion((value) => value + 1)} disabled={busy}>
                    Read saved status
                  </Button>
                )}
              </div>
            )}
            {!previewThread && setup && !setup.available && (
              <details className="council-setup">
                <summary>
                  Connect Factory to start your council <span>ⓘ</span>
                </summary>
                <p>
                  {setup.message ||
                    'Factory is unavailable. Configure the server runtime to start a council.'}{' '}
                  You can still browse company context and CREAO sources.
                </p>
              </details>
            )}
            <form
              className="council-composer"
              onSubmit={(event) => {
                event.preventDefault()
                void send()
              }}
            >
              <textarea
                ref={composer}
                aria-label={job ? 'Ask a follow-up' : 'Message your council'}
                value={question}
                maxLength={2000}
                rows={2}
                disabled={pending || busy || maxRounds}
                placeholder={
                  maxRounds
                    ? 'Four rounds complete. Start a new conversation to explore another decision.'
                    : pending
                      ? 'Your council is considering the question…'
                      : job
                        ? 'Ask a follow-up, or challenge the recommendation…'
                        : 'What should your council work through?'
                }
                onChange={(event) => setQuestion(event.target.value)}
              />
              <div>
                <span>
                  {frozen
                    ? 'Shared context stays with this conversation'
                    : selected.length
                      ? `${selected.length} sources · ${assigned ? 'assigned' : 'confirm assignment in Context'}`
                      : 'Company setup · add evidence in Context'}
                  {!setup && !previewThread ? ' · Checking connection…' : ''}
                </span>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!canSend || !!previewThread}
                  aria-label={pending ? 'Retry the same request' : 'Send to council'}
                >
                  {busy ? '…' : pending && error ? 'Retry' : '↑'}
                </Button>
              </div>
            </form>
            <p className="council-fineprint">
              {previewThread
                ? 'Preview controls only prefill the composer.'
                : 'Sends your question and shared context to Factory · uses Factory credits. The final call is yours.'}
            </p>
          </div>
        </div>
        <aside
          id="council-context"
          ref={contextRef}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && contextOpen) {
              event.preventDefault()
              event.stopPropagation()
              closeContext()
            }
          }}
          className={`council-context ${contextOpen ? 'open' : ''}`}
          aria-label="Company context and evidence"
        >
          <div className="council-context-head">
            <span className="council-eyebrow">IN THE ROOM</span>
            <Button
              className="council-context-close"
              variant="ghost" size="icon"
              onClick={closeContext}
              aria-label="Close context"
            >
              <CloseIcon />
            </Button>
          </div>
          <details open>
            <summary>
              <strong>{business.company}</strong>
              <small>Company setup · always included</small>
            </summary>
            <p>{business.offering}</p>
            <p className="council-help">{business.channels}</p>
            <details>
              <summary>
                {business.products.length} products · {business.parts.length} supplier parts
              </summary>
              <ul className="council-profile-list">
                {business.products.map((product, index) => (
                  <li key={index}>
                    <strong>{product.name}</strong>
                    <span>
                      ${product.price.toLocaleString()} · {product.units.toLocaleString()} annual
                      units
                    </span>
                  </li>
                ))}
                {business.parts.map((part, index) => (
                  <li key={`part-${index}`}>
                    <strong>{part.part}</strong>
                    <span>
                      {part.supplier} · ${part.cost.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </details>
          <details open={!!source || undefined}>
            <summary>
              <strong>Sources & artifacts</strong>
              <small>
                {evidence.length
                  ? `${evidence.length} shared records`
                  : 'Company setup only · no policy evidence'}
              </small>
            </summary>
            {frozen ? (
              <p className="council-help">
                Initial sources stay fixed. Council tool evidence is saved alongside each round.
              </p>
            ) : (
              <>
                <p className="council-help">
                  Choose completed CREAO text and artifacts, then confirm they belong to this
                  company.
                </p>
                <label htmlFor="council-source-role">CREAO agent</label>
                <select
                  id="council-source-role"
                  value={role}
                  onChange={(event) => {
                    sourceController.current?.abort()
                    setSourceBusy(false)
                    setRole(event.target.value as AgentRole)
                    setOptions([])
                    setSourcesLoaded(false)
                    setHasMore(false)
                    setNextOffset(0)
                  }}
                >
                  {(setup?.roles ?? []).map((item) => (
                    <option key={item.role} value={item.role} disabled={!item.configured}>
                      {item.name}
                      {!item.configured ? ' · unavailable' : ''}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  disabled={
                    sourceBusy ||
                    !setup?.roles.some((item) => item.role === role && item.configured)
                  }
                  onClick={() => void loadSources()}
                >
                  {sourceBusy ? 'Loading…' : 'Browse CREAO results'}
                </Button>
                {sourcesLoaded && !options.length && (
                  <p>No completed text results for this agent.</p>
                )}
                {options.map((option, index) => (
                  <label className="council-source-option" key={index}>
                    <input
                      type="checkbox"
                      checked={selected.some((item) => sameRef(item, option))}
                      onChange={() => toggleSource(option)}
                    />
                    <span>
                      <strong>{option.title}</strong>
                      <small>{option.description}</small>
                    </span>
                  </label>
                ))}
                {hasMore && (
                  <Button onClick={() => void loadSources(true)} disabled={sourceBusy}>
                    Load more
                  </Button>
                )}
                {business.company.trim().toLowerCase() === 'voltride' &&
                  new URL(business.website).hostname === 'voltride.example' && (
                    <label className="council-source-option">
                      <input
                        type="checkbox"
                        checked={selected.some((item) => item.ref.kind === 'sample')}
                        onChange={() => toggleSource(sample)}
                      />
                      <span>
                        {sample.title}
                        <small>{sample.description}</small>
                      </span>
                    </label>
                  )}
                {selected.length > 0 && (
                  <div className="council-assignment">
                    <ul>
                      {selected.map((item) => (
                        <li key={JSON.stringify(item.ref)}>
                          {item.title}
                          <Button
                            variant="ghost" size="icon"
                            aria-label={`Remove ${item.title}`}
                            onClick={() => toggleSource(item)}
                          >
                            <CloseIcon />
                          </Button>
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant="outline"
                      disabled={assigned}
                      onClick={() => setAssigned(true)}
                    >
                      {assigned
                        ? 'Assigned ✓'
                        : `Assign ${selected.length} sources to ${business.company}`}
                    </Button>
                  </div>
                )}
              </>
            )}
            {evidence.map((item) => (
              <Button
                className={`council-evidence-item ${item.id === inspectedSource ? 'selected' : ''}`}
                key={item.id}
                onClick={() => inspect(item.id)}
              >
                <span>{item.id}</span>
                <strong>{item.title}</strong>
                <small>
                  {item.kind === 'sample' ? 'Saved illustrative analysis' : item.provenance}
                </small>
              </Button>
            ))}
            {source && (
              <div
                className="council-source-excerpt"
                role="region"
                aria-label={`Source ${source.id} excerpt`}
              >
                <div>
                  <strong>{source.title}</strong>
                  <Button variant="ghost" size="icon" onClick={() => setInspectedSource(null)} aria-label="Close excerpt">
                    <CloseIcon />
                  </Button>
                </div>
                <small>{source.provenance}</small>
                <blockquote>{source.text}</blockquote>
                {source.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
                {source.url &&
                  (/^https?:\/\//.test(source.url) || /^\/api\/agent-runs\//.test(source.url)) && (
                    <a href={source.url} target="_blank" rel="noreferrer">
                      Open original source ↗
                    </a>
                  )}
              </div>
            )}
          </details>
        </aside>
      </div>
    </section>
  )
}
