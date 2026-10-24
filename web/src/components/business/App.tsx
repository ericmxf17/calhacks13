'use client'
import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import BusinessScene from './BusinessScene'
import { departments, type DepartmentId } from './departments'

export function Button({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={className} {...props}>{children}</button>
}

function Arrow({ back = false }: { back?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={back ? 'M19 12H5m6-6-6 6 6 6' : 'M5 12h14m-6-6 6 6-6 6'} stroke="currentColor" strokeWidth="1.5"/></svg>
}

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function FlatStorefront({ open }: { open: (id: DepartmentId) => void }) {
  return <div className="flat-scene"><div className="flat-building"><div className="flat-cornice" />
    <div className="flat-windows">{departments.map(d => <Button id={`room-${d.id}`} key={d.id} className="flat-window" onClick={() => open(d.id)}><span />{d.name}<Arrow /></Button>)}</div>
    <div className="flat-sign">NORTHSTAR</div><div className="flat-shop"><span/><span/><span/></div>
  </div><p className="fallback-note">Simplified view · 3D isn’t available on this device</p></div>
}

function DepartmentView({ id, close, select }: { id: DepartmentId; close: () => void; select: (id: DepartmentId) => void }) {
  const d = departments.find(item => item.id === id)!
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [id])
  return <section className="department-view" aria-labelledby="room-title" key={id}>
    <div className="room-topline"><span className="section-kicker">{d.floor} / {d.number}</span><span className="period">This month · May 2025</span></div>
    <h1 id="room-title" ref={heading} tabIndex={-1}>{d.name}<span>.</span></h1>
    <p className="room-description">{d.description}</p>
    <div className="metrics">{d.metrics.map(m => <div className="metric" key={m.label}><span>{m.label}</span><strong>{m.value}</strong><small>{m.change}</small></div>)}</div>
    <div className="chart-heading"><h2>{d.chartTitle}</h2><span>{d.chartNote}</span></div>
    <div className="room-chart" role="img" aria-label={`${d.chartTitle}: ${d.chartLabels.map((l, i) => `${l}: ${d.chartValues[i]}${d.unit}`).join(', ')}`}>
      <div className="chart-grid"><i/><i/><i/></div>
      <div className="chart-columns">{d.chartValues.map((value, i) => <div className="chart-column" key={d.chartLabels[i]}><span className="bar-value">{value}{d.unit}</span><div className="chart-bar" style={{ height: `${value / Math.max(...d.chartValues) * 100}%` }} /><span className="bar-label">{d.chartLabels[i]}</span></div>)}</div>
    </div>
    <div className="list-heading"><h2>{d.listTitle}</h2><span>{d.rows.length} items</span></div>
    <div className="room-list">{d.rows.map(row => <div className="room-row" key={row.title}><span className="row-mark">{row.initial}</span><div><strong>{row.title}</strong><small>{row.subtitle}</small></div><span className="row-value">{row.value}</span></div>)}</div>
    <div className="room-footer"><span><i/> Demo data, for exploration</span><Button className="subtle-link" onClick={close}>Back to the building <Arrow back/></Button></div>
    <nav className="room-switcher" aria-label="Explore another room">{departments.map(item => <Button aria-pressed={item.id === id} key={item.id} onClick={() => select(item.id)}>{item.shortName}</Button>)}</nav>
  </section>
}

export default function App({ company = 'Northstar Goods' }: { company?: string }) {
  const [active, setActive] = useState<DepartmentId | null>(null)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [ready, setReady] = useState(false)
  const lastRoom = useRef<DepartmentId | null>(null)
  const pointer = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    update(); query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  const open = (id: DepartmentId) => { lastRoom.current = id; setReady(false); setActive(id) }
  const close = () => {
    setActive(null); setReady(false)
    window.setTimeout(() => document.getElementById(`room-${lastRoom.current}`)?.focus(), reducedMotion ? 20 : 850)
  }
  useEffect(() => {
    if (!active) return
    const timer = window.setTimeout(() => setReady(true), reducedMotion ? 30 : 650)
    return () => window.clearTimeout(timer)
  }, [active, reducedMotion])
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && active) close() }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [active, reducedMotion])
  const fallback = <FlatStorefront open={open}/>

  return <main className={`world ${active ? 'inside-room' : ''} ${reducedMotion ? 'reduce-motion' : ''}`}
    onPointerMove={event => {
      if (event.pointerType === 'touch' || active || reducedMotion) return
      pointer.current = { x: event.clientX / window.innerWidth * 2 - 1, y: event.clientY / window.innerHeight * 2 - 1 }
    }} onPointerLeave={() => { pointer.current = { x: 0, y: 0 } }}>
    <div className="scene-layer"><SceneBoundary fallback={fallback}><BusinessScene active={active} open={open} pointer={pointer} reducedMotion={reducedMotion} fallback={fallback}/></SceneBoundary></div>
    <header className="world-header">
      <div className="wordmark"><span className="wordmark-symbol">n.</span><div>northstar<span>THE BUSINESS, CONNECTED</span></div></div>
      <div className="workspace-status"><i/> {company}<span className="status-divider"/><span className="established">Illustrative room data</span></div>
    </header>
    {active && <Button className="back-button" onClick={close}><Arrow back/>Back to business<span>ESC</span></Button>}
    <div className={`intro ${active ? 'intro-hidden' : ''}`}><span className="section-kicker">A NEW PERSPECTIVE</span><h1>Your business.<br/><em>A world of its own.</em></h1><p>Step closer. Every room tells a story.</p></div>
    {active && ready && <DepartmentView id={active} close={close} select={open}/>}
    {!active && <footer className="world-footer"><div className="coordinate"><span>01 — THE WHOLE PICTURE</span><small>{company} · Your business, connected</small></div><div className="explore-hint"><span className="mouse-icon"/><span>Move to explore <i/> Select a room to step inside</span></div><span className="scene-index">A little closer to everything.</span></footer>}
  </main>
}
