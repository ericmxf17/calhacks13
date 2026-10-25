'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { BusinessView } from './BusinessScene'
import './onboarding-tour.css'

/** One stop on the tour: the screen it needs, what it points at (none centers the card), and what it says. */
export type TourStep = { view: BusinessView; target?: string; title: string; body: string }

export function tourSteps(company: string): TourStep[] {
  return [
    { view: 'home', title: `Welcome to ${company}`, body: 'Review company facts in the rooms, discuss a decision with Consul, and inspect CREAO research runs in Agents.' },
    { view: 'home', target: '.room-hotspot', title: 'Every room is part of your business', body: 'Open a room to review its figures and source label. Rooms use setup estimates, fictional samples, or an empty state. Press Esc to return.' },
    { view: 'home', target: '[data-tour="home"]', title: 'Home', body: 'The Home tab brings you back to your building from anywhere.' },
    { view: 'council', target: '.council-roster', title: 'Consul, your advisory council', body: 'Ask a business question. Finance, Operations and Skeptic examine costs, feasibility and assumptions; Chair brings their views into a recommendation.' },
    { view: 'council', target: '.council-composer', title: 'Ask about a decision', body: 'Describe what you need to decide, your options and any deadline. Add policy evidence in Context & sources, then ask follow-ups or challenge an assumption.' },
    { view: 'council', target: '.council-context', title: 'What your council knows', body: 'Your company setup is included. Use Context & sources to add selected CREAO run results as evidence for the discussion.' },
    { view: 'agents', target: '.agent-card', title: 'Agents, your research team', body: 'Inspect CREAO runs for bill analysis, research, business impact and briefs. These are runs you start, rather than automatic policy monitoring.' },
    { view: 'agents', target: '[data-tour="brief-writer"]', title: 'Running an agent', body: 'Open an agent to inspect API run history, output and files. Brief Writer also accepts an analysis pack or the VoltRide example to start a new run.' },
    { view: 'home', target: '[data-tour="settings"]', title: 'Update your company info', body: 'Open Business settings to edit your company and products, or upload a new supplier spreadsheet (CSV or XLSX with the columns supplier, part and cost). Your rooms update to match.' },
    { view: 'home', target: '[data-tour="tour"]', title: 'You’re all set', body: 'You can replay this tour any time from here.' },
  ]
}

// Remembered per company, so each new company still gets the tour once in this browser.
const seenKey = (company: string) => `consul:tour:v2:${company.trim().toLowerCase()}`
/** Whether this browser has already shown the tour for this company. */
export function tourSeen(company: string) {
  try { return localStorage.getItem(seenKey(company)) === 'seen' } catch { return false }
}
export function markTourSeen(company: string) {
  try { localStorage.setItem(seenKey(company), 'seen') } catch { /* Storage may be unavailable. */ }
}

type Box = { top: number; left: number; width: number; height: number }
const pad = 8, gap = 14, cardWidth = 340, margin = 16, navClearance = 96, closeMs = 200

/** The element's highlighted box, or null while it's missing or hidden (a panel still sliding in, say). */
function measure(element: HTMLElement | null): Box | null {
  if (!element || (element.checkVisibility && !element.checkVisibility({ visibilityProperty: true }))) return null
  const r = element.getBoundingClientRect()
  // Tabs sit side by side in the bottom navigation, so their highlight hugs the tab instead of spilling onto the next.
  const p = element.closest('.bottom-navigation') ? 2 : pad
  return r.width || r.height ? { top: r.top - p, left: r.left - p, width: r.width + p * 2, height: r.height + p * 2 } : null
}
/** A closed spotlight in the middle of the screen: everything dimmed, nothing highlighted. */
const closed = (): Box => ({ top: window.innerHeight / 2, left: window.innerWidth / 2, width: 0, height: 0 })
/**
 * Scrolls only the target's own scrolling list (the agents panel, say) to center it above the bottom navigation.
 * scrollIntoView would also scroll the page's hidden-overflow layers and shift the whole workspace.
 */
function reveal(element: HTMLElement, smooth: boolean) {
  for (let list = element.parentElement; list; list = list.parentElement) {
    if (!/(auto|scroll)/.test(getComputedStyle(list).overflowY) || list.scrollHeight <= list.clientHeight) continue
    const r = element.getBoundingClientRect(), area = list.getBoundingClientRect()
    const bottom = Math.min(area.bottom, window.innerHeight - navClearance)
    list.scrollBy({ top: r.top + r.height / 2 - (area.top + bottom) / 2, behavior: smooth ? 'smooth' : 'auto' })
    return
  }
}
const same = (a: Box | null, b: Box | null) => a === b || (!!a && !!b && ['top', 'left', 'width', 'height'].every(k => Math.abs(a[k as keyof Box] - b[k as keyof Box]) < .5))

/**
 * A spotlight tour of the workspace. It switches screens when a step needs another one.
 * The spotlight moves on one continuous path: it opens from the middle of the screen, and while a new screen
 * loads it rests on that screen's tab, then glides to the target. The card always rides along with it.
 */
export default function OnboardingTour({ steps, view, onView, onClose, reducedMotion }: { steps: TourStep[]; view: BusinessView; onView: (view: BusinessView) => void; onClose: () => void; reducedMotion: boolean }) {
  const [index, setIndex] = useState(0)
  const [box, setBox] = useState<Box>(closed)
  const [closing, setClosing] = useState(false)
  const primary = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const cardRef = useRef<HTMLElement>(null)
  const [cardHeight, setCardHeight] = useState(240)
  // The card's real height decides whether it fits below its target. Text length changes per step.
  useLayoutEffect(() => { if (cardRef.current) setCardHeight(cardRef.current.offsetHeight) }, [index])
  const step = steps[index], last = index === steps.length - 1
  useEffect(() => { if (step.view !== view) onView(step.view) }, [step.view, view, onView])
  // Follow the target every frame: the camera eases and panels slide in after a screen change.
  useLayoutEffect(() => {
    let frame = 0, scrolled = false, still = 0, previous: Box | null = null
    const follow = () => {
      const element = step.target ? document.querySelector<HTMLElement>(step.target) : null
      const found = measure(element)
      // Once the target stops moving (panels slide in first), bring it into view if it's off screen
      // or behind the bottom navigation. A lower agent card, for example. Once per step.
      still = found && same(found, previous) ? still + 1 : 0
      previous = found
      if (found && !scrolled && still > 8) {
        scrolled = true
        if (found.top < 0 || found.top + found.height > window.innerHeight - navClearance) reveal(element!, !reducedMotion)
      }
      const next = !step.target ? closed() : found ?? measure(document.querySelector<HTMLElement>(`[data-tour="${step.view}"]`))
      if (next) setBox(current => same(current, next) ? current : next)
      frame = requestAnimationFrame(follow)
    }
    follow()
    return () => cancelAnimationFrame(frame)
  }, [step.target, step.view, reducedMotion])
  useEffect(() => { primary.current?.focus() }, [index])
  // Keep keyboard focus in the card. Panels that open behind it (Agents) move focus to themselves.
  useEffect(() => {
    const keep = (event: FocusEvent) => { if (!dialog.current?.contains(event.target as Node)) primary.current?.focus() }
    document.addEventListener('focusin', keep)
    return () => document.removeEventListener('focusin', keep)
  }, [])
  // Fade out, then hand back the workspace (on Home).
  const finish = () => {
    if (closing) return
    setClosing(true)
    if (view !== 'home') onView('home')
    window.setTimeout(onClose, reducedMotion ? 0 : closeMs)
  }
  const next = () => last ? finish() : setIndex(i => i + 1)
  const back = () => setIndex(i => Math.max(0, i - 1))
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); finish() }
      else if (event.key === 'ArrowRight') next()
      else if (event.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', keys)
    return () => window.removeEventListener('keydown', keys)
  })

  // The card is always placed by its top-left corner, so every move between steps is one smooth glide.
  // Below the spotlight if it fits above the bottom navigation, else above it, else beside it (a tall column),
  // else as low as fits; centered while the spotlight is closed.
  const width = Math.min(cardWidth, window.innerWidth - margin * 2), room = window.innerHeight - navClearance
  const open = box.width > 0
  let left = Math.min(Math.max(box.left + box.width / 2 - width / 2, margin), window.innerWidth - width - margin)
  const below = box.top + box.height + gap, above = box.top - gap - cardHeight
  const right = box.left + box.width + gap, leftOf = box.left - gap - width
  const beside = Math.min(Math.max(box.top, margin), room - cardHeight)
  let top = Math.max(margin, room - cardHeight)
  if (!open) top = (window.innerHeight - cardHeight) / 2
  else if (below + cardHeight < room) top = below
  else if (above > margin) top = above
  else if (right + width < window.innerWidth - margin) { left = right; top = beside }
  else if (leftOf > margin) { left = leftOf; top = beside }
  return <dialog ref={dialog} open className={`tour${reducedMotion ? ' tour-still' : ''}`} data-closing={closing || undefined} aria-labelledby="tour-title" aria-describedby="tour-body">
    <div className="tour-blocker" onClick={event => event.stopPropagation()}/>
    <div className="tour-spotlight" data-open={open || undefined} style={box}/>
    <section ref={cardRef} className="tour-card" style={{ left, top, width }}>
      <span className="tour-kicker">{index === 0 ? 'QUICK TOUR' : `STEP ${index} OF ${steps.length - 1}`}</span>
      <h2 id="tour-title">{step.title}</h2>
      <p id="tour-body">{step.body}</p>
      {index > 0 && <div className="tour-progress" aria-hidden="true">{steps.slice(1).map((_, i) => <i key={i} data-on={i + 1 === index || undefined}/>)}</div>}
      <div className="tour-actions">
        {!last && <button type="button" className="tour-skip" onClick={finish}>{index === 0 ? 'Not now' : 'Skip tour'}</button>}
        <span/>
        {index > 0 && <button type="button" onClick={back}>Back</button>}
        <button type="button" className="tour-next" ref={primary} onClick={next}>{index === 0 ? 'Show me around' : last ? 'Done' : 'Next'}</button>
      </div>
    </section>
  </dialog>
}
