'use client'

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { BusinessView } from './BusinessScene'
import './onboarding-tour.css'

/** One stop on the tour: the screen it needs, what it points at (none centers the card), and what it says. */
export type TourStep = { view: BusinessView; target?: string; title: string; body: string }

export function tourSteps(company: string): TourStep[] {
  return [
    { view: 'home', title: `Welcome to ${company}`, body: 'This building is your business. Take a one-minute tour to see how to get around, run your agents, and keep your company details up to date.' },
    { view: 'home', target: '.room-hotspot', title: 'Every room is part of your business', body: 'Rooms show numbers worked out from your setup, like revenue, products and suppliers. Click a room’s label to step inside, and press Esc to step back out.' },
    { view: 'home', target: '[data-tour="home"]', title: 'Home', body: 'The Home tab brings you back to your building from anywhere.' },
    { view: 'home', target: '[data-tour="consul"]', title: 'Consul, your advisory council', body: 'Ask about a decision you’re facing. Four AI advisors (Finance, Operations, Skeptic and Chair) talk it through and give you a recommendation with sources.' },
    { view: 'agents', target: '.agent-card', title: 'Agents, your research team', body: 'These AI agents read new bills, research them, work out what they mean for your company, and write you a short brief.' },
    { view: 'agents', target: '[data-tour="brief-writer"]', title: 'Running an agent', body: 'Click an agent’s name to open it and see its past runs, outputs and files. To start one, open Brief Writer and press Run Brief Writer. The result shows up in the same window after a few minutes.' },
    { view: 'home', target: '[data-tour="settings"]', title: 'Update your company info', body: 'Open Business settings to edit your company and products, or upload a new supplier spreadsheet (CSV or XLSX with the columns supplier, part and cost). Your rooms update to match.' },
    { view: 'home', target: '[data-tour="tour"]', title: 'You’re all set', body: 'You can replay this tour any time from here.' },
  ]
}

const seenKey = 'consul:tour:v1'
/** Whether this browser has already started the tour once. */
export function tourSeen() {
  try { return localStorage.getItem(seenKey) === 'seen' } catch { return false }
}
export function markTourSeen() {
  try { localStorage.setItem(seenKey, 'seen') } catch { /* Storage may be unavailable. */ }
}

type Box = { top: number; left: number; width: number; height: number }
const pad = 8, gap = 14, cardWidth = 340, margin = 16, navClearance = 96

/** The highlighted target's box, or null while it's missing or hidden (a panel still sliding in, say). */
function measure(element: HTMLElement | null): Box | null {
  if (!element || (element.checkVisibility && !element.checkVisibility({ visibilityProperty: true }))) return null
  const r = element.getBoundingClientRect()
  return r.width || r.height ? { top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 } : null
}
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

/** A spotlight tour of the workspace. It switches screens when a step needs another one. */
export default function OnboardingTour({ steps, view, onView, onClose, reducedMotion }: { steps: TourStep[]; view: BusinessView; onView: (view: BusinessView) => void; onClose: () => void; reducedMotion: boolean }) {
  const [index, setIndex] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
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
    let frame = 0, scrolled = false, still = 0, last: Box | null = null
    const follow = () => {
      const element = step.target ? document.querySelector<HTMLElement>(step.target) : null
      const next = measure(element)
      // Once the target stops moving (panels slide in first), bring it into view if it's off screen
      // or behind the bottom navigation. A lower agent card, for example. Once per step.
      still = next && same(next, last) ? still + 1 : 0
      last = next
      if (next && !scrolled && still > 8) {
        scrolled = true
        if (next.top < 0 || next.top + next.height > window.innerHeight - navClearance) reveal(element!, !reducedMotion)
      }
      setBox(current => same(current, next) ? current : next)
      frame = requestAnimationFrame(follow)
    }
    follow()
    return () => cancelAnimationFrame(frame)
  }, [step.target, reducedMotion])
  useEffect(() => { primary.current?.focus() }, [index])
  // Keep keyboard focus in the card. Panels that open behind it (Agents) move focus to themselves.
  useEffect(() => {
    const keep = (event: FocusEvent) => { if (!dialog.current?.contains(event.target as Node)) primary.current?.focus() }
    document.addEventListener('focusin', keep)
    return () => document.removeEventListener('focusin', keep)
  }, [])
  const finish = () => { onClose(); if (view !== 'home') onView('home') }
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

  // The card sits below the target, or above it when there's no room below; centered when nothing is highlighted.
  let card: CSSProperties = {}
  if (step.target && box) {
    const width = Math.min(cardWidth, window.innerWidth - margin * 2)
    const left = Math.min(Math.max(box.left + box.width / 2 - width / 2, margin), window.innerWidth - width - margin)
    // Below the target if it fits above the bottom navigation, else above it, else as low as fits.
    const below = box.top + box.height + gap, room = window.innerHeight - navClearance
    card = below + cardHeight < room ? { left, width, top: below }
      : box.top - gap - cardHeight > margin ? { left, width, bottom: window.innerHeight - box.top + gap }
        : { left, width, top: Math.max(margin, room - cardHeight) }
  }
  const centered = !step.target || !box
  return <dialog ref={dialog} open className={`tour${reducedMotion ? ' tour-still' : ''}`} aria-labelledby="tour-title" aria-describedby="tour-body">
    <div className="tour-blocker" onClick={event => event.stopPropagation()}/>
    {box && step.target ? <div className="tour-spotlight" style={box}/> : <div className="tour-dim"/>}
    <section ref={cardRef} className={`tour-card${centered ? ' tour-card-centered' : ''}`} style={card}>
      <span className="tour-kicker">{index === 0 ? 'QUICK TOUR' : `STEP ${index} OF ${steps.length - 1}`}</span>
      <h2 id="tour-title">{step.title}</h2>
      <p id="tour-body">{step.body}</p>
      <div className="tour-progress" aria-hidden="true">{steps.map((_, i) => <i key={i} data-on={i === index || undefined}/>)}</div>
      <div className="tour-actions">
        {!last && <button type="button" className="tour-skip" onClick={finish}>{index === 0 ? 'Not now' : 'Skip tour'}</button>}
        <span/>
        {index > 0 && <button type="button" onClick={back}>Back</button>}
        <button type="button" className="tour-next" ref={primary} onClick={next}>{index === 0 ? 'Show me around' : last ? 'Done' : 'Next'}</button>
      </div>
    </section>
  </dialog>
}
