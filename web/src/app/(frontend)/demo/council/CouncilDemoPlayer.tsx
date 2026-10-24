'use client'

import { useEffect, useMemo, useState } from 'react'
import CouncilPanel from '@/components/business/CouncilPanel'
import type { CouncilJob, CouncilRole, CouncilThread } from '@/lib/council-types'

const speakingOrder: CouncilRole[] = ['finance', 'operations', 'skeptic', 'chair']

// Playback reveals fixture turns. It never creates or resumes a provider job.
export default function CouncilDemoPlayer({
  round,
  initialStep,
  autoplay,
}: {
  round: CouncilJob
  initialStep: number
  autoplay: boolean
}) {
  const [step, setStep] = useState(initialStep)
  const [playing, setPlaying] = useState(autoplay)
  const completed = step === speakingOrder.length

  useEffect(() => {
    if (!playing || completed) return
    const timer = window.setTimeout(() => setStep(step + 1), 6000)
    return () => window.clearTimeout(timer)
  }, [playing, completed, step])

  // Pausing keeps the same preview identity, preserving focus and open context.
  const thread = useMemo<CouncilThread>(() => {
    const visibleRound: CouncilJob = step === speakingOrder.length ? round : {
      ...round,
      status: 'running',
      stage: speakingOrder[step],
      turns: round.turns.slice(0, step),
      decision: null,
    }
    return { rootJobId: round.id, rounds: [visibleRound] }
  }, [step, round])
  const controlStyle = {
    padding: '5px 10px', border: '2px solid #294b70', borderRadius: 5,
    background: '#fffdf4', color: '#243957', font: '700 11px Trebuchet MS',
    boxShadow: '2px 2px 0 #294b7040', cursor: 'pointer',
  }

  return <main style={{ position: 'fixed', inset: 0, background: '#dcf5fc' }}>
    <div style={{ position: 'absolute', top: 25, left: 24, color: '#243957', fontFamily: 'Trebuchet MS', fontSize: 24, fontWeight: 800 }}>
      consul <small style={{ fontSize: 11, fontWeight: 400 }}> / illustrative council demo</small>
    </div>
    <nav aria-label="Demo playback" style={{ position: 'absolute', top: 67, left: 24, display: 'flex', gap: 8 }}>
      <button style={controlStyle} onClick={() => {
        if (completed) { setStep(0); setPlaying(true) }
        else setPlaying(!playing)
      }}>{completed ? 'Replay demo' : playing ? 'Pause demo' : 'Play demo'}</button>
      <button style={controlStyle} disabled={completed} onClick={() => { setPlaying(false); setStep(step + 1) }}>Next turn</button>
      <button style={controlStyle} onClick={() => { setPlaying(false); setStep(speakingOrder.length) }}>Show conclusion</button>
    </nav>
    <CouncilPanel key={step} business={round.business} previewThread={thread} />
  </main>
}
