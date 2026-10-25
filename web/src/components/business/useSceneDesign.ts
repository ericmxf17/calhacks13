'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { BusinessInput } from '@/lib/business-input'
import type { SceneDesignerJob } from '@/lib/agent-run-types'
import { profileKey } from '@/lib/scene-profile'
import { fallbackSceneSpec, validateSceneSpec, type SceneSpec } from '@/lib/scene-spec'

export type DesignState = 'designing' | 'agent' | 'quick' | 'saved'
export type SceneDesign = {
  spec: SceneSpec
  /** designing: Scene Designer is working, and the quick design shows meanwhile. agent: its design is shown. quick: the keyword design is shown. saved: a demo company's saved design. */
  state: DesignState
  /** A short note for the owner, such as why the quick design is showing. */
  message: string
  /** True when Scene Designer finished while the quick design was showing. Its design shows when the owner asks. */
  ready: boolean
  chooseQuickDesign: () => void
  showDesign: () => void
}

type Saved = { requestId: string; startedAt: number; spec?: unknown; failed?: string }
const pollEvery = 4000, quickAfter = 6 * 60_000, giveUpAfter = 20 * 60_000
const stopped = new Set(['failed', 'cancelled', 'rejected', 'dispatch_unknown'])
const storageKey = (key: string) => `consul:scene:v1:${key}`
function load(key: string): Saved | null {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(key)) ?? 'null')
    return value && typeof value.requestId === 'string' && typeof value.startedAt === 'number' ? value : null
  } catch { return null }
}
function save(key: string, value: Saved | null) {
  try { if (value) localStorage.setItem(storageKey(key), JSON.stringify(value)); else localStorage.removeItem(storageKey(key)) } catch { /* Storage may be unavailable. */ }
}

/**
 * Gets a company's building design from Scene Designer, once per company profile.
 * The request ID is saved before the run starts, so a reload resumes the same run instead of paying for another.
 * The keyword-picked quick design shows while the agent works, and whenever it can't help.
 */
export function useSceneDesign(business: BusinessInput | null, known?: SceneSpec): SceneDesign {
  const key = business ? profileKey(business) : ''
  const quick = useMemo(() => fallbackSceneSpec(business ?? { company: '', offering: '', channels: '', products: [], parts: [] }), [business])
  const [result, setResult] = useState<{ key: string; state: DesignState; message: string; spec?: SceneSpec; late?: SceneSpec }>({ key: '', state: 'quick', message: '' })

  useEffect(() => {
    if (!business || known) return
    let cancelled = false, timer: number | undefined
    const update = (next: Omit<typeof result, 'key'>) => { if (!cancelled) setResult({ key, ...next }) }
    const design = (wire: unknown) => validateSceneSpec(wire, business).spec
    const fallback = (message: string) => update({ state: 'quick', message })
    // The building never changes on its own: the finished design waits until the owner chooses to show it.
    const finished = (spec: SceneSpec) => {
      if (!cancelled) setResult(r => ({ ...r, key, state: 'quick', message: '', late: spec }))
    }

    async function poll(saved: Saved, showing: DesignState) {
      if (cancelled) return
      let job: SceneDesignerJob | null = null, status = 0
      try {
        const response = await fetch(`/api/agent-runs/scene-designer/jobs/${saved.requestId}`, { cache: 'no-store' })
        status = response.status
        if (response.ok) job = await response.json()
      } catch { /* Network trouble: try again on the next tick. */ }
      if (cancelled) return
      const age = Date.now() - saved.startedAt
      if (job?.status === 'completed' && job.spec) {
        save(key, { ...saved, spec: job.spec })
        return finished(design(job.spec))
      }
      if (job && (job.specError || stopped.has(job.status) || job.status === 'completed')) {
        save(key, { ...saved, failed: job.specError || job.message || 'Scene Designer could not finish.' })
        return fallback(job.specError || job.message || 'Scene Designer could not finish, so this is a quick design.')
      }
      // The job file may not exist yet if this poll overtook the request that creates it.
      if (status === 404 && age > 15_000) { save(key, null); return fallback('Scene Designer never received the request.') }
      if (age > giveUpAfter) return fallback('Scene Designer took too long, so this is a quick design.')
      if (showing === 'designing' && age > quickAfter) { showing = 'quick'; fallback('Scene Designer is still working. Its design will be ready to show when it finishes.') }
      timer = window.setTimeout(() => void poll(saved, showing), pollEvery)
    }

    async function start() {
      const saved = load(key)
      if (saved?.spec) return update({ state: 'agent', message: '', spec: design(saved.spec) })
      if (saved?.failed) return fallback(saved.failed)
      if (saved) { update({ state: 'designing', message: '' }); return poll(saved, 'designing') }
      const fresh: Saved = { requestId: crypto.randomUUID(), startedAt: Date.now() }
      save(key, fresh)
      update({ state: 'designing', message: '' })
      try {
        const response = await fetch('/api/agent-runs/scene-designer/jobs', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: fresh.requestId, business }),
        })
        if (response.ok || response.status === 409) return poll(fresh, 'designing')
        // Nothing was started, so a later visit may try again once the agent is set up.
        save(key, null)
        fallback(response.status === 403 ? 'Scene Designer runs in the local preview only, so this is a quick design.'
          : response.status === 503 ? 'Scene Designer isn’t connected yet, so this is a quick design.'
            : 'Scene Designer is unavailable right now, so this is a quick design.')
      } catch {
        // The request may have arrived; checking the saved ID shows whether it did.
        return poll(fresh, 'designing')
      }
    }
    void start()
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [key, known])

  // Before the effect runs, show a design this browser already has rather than a construction site.
  const remembered = useMemo(() => {
    const saved = key && !known ? load(key) : null
    return saved?.spec && business ? validateSceneSpec(saved.spec, business).spec : null
  }, [key, known, business])
  const current = result.key === key ? result : remembered ? { state: 'agent' as DesignState, message: '', spec: remembered } : { state: 'designing' as DesignState, message: '' }
  const chooseQuickDesign = useCallback(() => setResult(r => ({ ...r, key, state: 'quick', message: 'Showing a quick design. Scene Designer keeps working in the background.' })), [key])
  const showDesign = useCallback(() => setResult(r => r.late ? { key, state: 'agent', message: '', spec: r.late } : r), [key])
  if (known) return { spec: known, state: 'saved', message: '', ready: false, chooseQuickDesign, showDesign }
  if (!business) return { spec: quick, state: 'quick', message: '', ready: false, chooseQuickDesign, showDesign }
  return {
    spec: current.state === 'agent' && 'spec' in current && current.spec ? current.spec : quick,
    state: current.state, message: current.message, ready: 'late' in current && !!current.late,
    chooseQuickDesign, showDesign,
  }
}
