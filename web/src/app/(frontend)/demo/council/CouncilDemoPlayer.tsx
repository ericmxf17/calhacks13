'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
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
      artifacts: round.artifacts?.filter((artifact) => speakingOrder.indexOf(artifact.role) <= step),
      toolCalls: round.toolCalls?.filter((call) => speakingOrder.indexOf(call.role) <= step),
      decision: null,
    }
    return { rootJobId: round.id, rounds: [visibleRound] }
  }, [step, round])

  return <main className="council-demo" style={{ position: 'fixed', inset: 0, background: '#dcf5fc' }}>
    <div style={{ position: 'absolute', top: 25, left: 24, color: '#243957', fontFamily: 'Trebuchet MS', fontSize: 24, fontWeight: 800 }}>
      consul <small style={{ fontSize: 12, fontWeight: 400 }}> / illustrative council demo</small>
    </div>
    <nav aria-label="Demo playback" style={{ position: 'absolute', top: 67, left: 12, right: 12, flexWrap: 'wrap', display: 'flex', gap: 8 }}>
      <Button onClick={() => {
        if (completed) { setStep(0); setPlaying(true) }
        else setPlaying(!playing)
      }}>{completed ? 'Replay demo' : playing ? 'Pause demo' : 'Play demo'}</Button>
      <Button disabled={completed} onClick={() => { setPlaying(false); setStep(step + 1) }}>Next turn</Button>
      <Button onClick={() => { setPlaying(false); setStep(speakingOrder.length) }}>Show all artifacts</Button>
    </nav>
    <CouncilPanel key={step} business={round.business} previewThread={thread} />
  </main>
}
