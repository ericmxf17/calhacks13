'use client'
import { Component, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { defaultSceneSpec, type SceneSpec } from '@/lib/scene-spec'
import BusinessScene, { type BusinessView } from './BusinessScene'
import AgentsPanel from './AgentsPanel'
import CouncilPanel from './CouncilPanel'
import './council-transition.css'
import type { BusinessInput } from '@/lib/business-input'
import { councilBusinessKey } from '@/lib/council-types'
import { departments as defaultDepartments, type Department, type DepartmentId } from './departments'
import { layoutBuilding, placeRooms, type BuildingLayout } from './scene/layout'
import { drawnArchetype } from './scene/archetypes'
import { sceneTheme } from './scene/parts'
import type { DesignState } from './useSceneDesign'

const defaultScene = defaultSceneSpec('storefront')

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

function SceneFallback({ children, view, settled, onViewSettled }: { children: ReactNode; view: BusinessView; settled: boolean; onViewSettled: (view: BusinessView) => void }) {
  // Only the error boundary uses this signal. Canvas mounts its fallback children even with working WebGL.
  useEffect(() => { if (!settled) onViewSettled(view) }, [view, settled, onViewSettled])
  return children
}

function FlatStorefront({ open, company, departments, scene, layout }: { open: (id: DepartmentId) => void; company: string; departments: Department[]; scene: SceneSpec; layout: BuildingLayout }) {
  const theme = sceneTheme(scene.archetype, scene.palette)
  const colors = { '--flat-body': theme.body, '--flat-trim': theme.trim, '--flat-wall': theme.wall, '--flat-sign': scene.sign.background, '--flat-sign-ink': scene.sign.color } as CSSProperties
  return <div className="flat-scene" style={colors}><div className="flat-building" style={{ width: 160 * layout.cols, height: 430 + (layout.rows - 2) * 117 }}><div className="flat-cornice" />
    <div className="flat-windows" style={{ gridTemplateColumns: `repeat(${layout.cols}, 1fr)` }}>{departments.map(d => <Button id={`room-${d.id}`} key={d.id} className="flat-window" style={{ background: d.ink }} onClick={() => open(d.id)}><span />{d.name}<Arrow /></Button>)}</div>
    <div className="flat-sign"><svg viewBox="0 0 600 60" role="img" aria-label={company}><text x="300" y="42" textAnchor="middle" fontSize="40" textLength={Math.min(560, company.length * 29)} lengthAdjust="spacingAndGlyphs">{company.toUpperCase()}</text></svg></div><div className="flat-shop"><span/><span/><span/></div>
  </div><p className="fallback-note">Simplified view · 3D isn’t available on this device</p></div>
}

const sourceNote = { illustrative: 'Demo data, for exploration', setup: 'Calculated from your setup details', placeholder: 'Not connected yet' }

function DepartmentView({ department: d, departments, close, select }: { department: Department; departments: Department[]; close: () => void; select: (id: DepartmentId) => void }) {
  const id = d.id
  const values = d.chartValues ?? [], labels = d.chartLabels ?? [], rows = d.rows ?? [], unit = d.unit ?? ''
  const top = values.length ? Math.max(...values) : 0
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [id])
  return <section className="department-view" aria-labelledby="room-title" key={id}>
    <div className="room-topline"><span className="section-kicker">{d.floor} / {d.number}</span><span className="period">{d.period ?? 'This month · May 2025'}</span></div>
    <nav className="room-switcher" aria-label="Explore another room"><span className="room-switcher-label">Explore rooms</span><div>{departments.map(item => <Button aria-pressed={item.id === id} key={item.id} onClick={() => select(item.id)}>{item.shortName}{item.id !== id && <Arrow />}</Button>)}</div></nav>
    <h1 id="room-title" ref={heading} tabIndex={-1}>{d.name}<span>.</span></h1>
    <p className="room-description">{d.description}</p>
    {d.callout && <aside className="room-callout"><strong>{d.callout.title}</strong><p>{d.callout.body}</p></aside>}
    {d.metrics.length > 0 && <div className="metrics">{d.metrics.map((m, i) => <div className="metric" key={i}><span>{m.label}</span><strong>{m.value}</strong><small>{m.change}</small></div>)}</div>}
    {values.length > 0 && <>
      <div className="chart-heading"><h2>{d.chartTitle}</h2><span>{d.chartNote}</span></div>
      <div className="room-chart" role="img" aria-label={`${d.chartTitle}: ${labels.map((l, i) => `${l}: ${values[i]}${unit}`).join(', ')}`}>
        <div className="chart-grid"><i/><i/><i/></div>
        <div className="chart-columns">{values.map((value, i) => <div className="chart-column" key={i}><span className="bar-value">{value}{unit}</span><div className="chart-bar" style={{ height: `${top > 0 ? value / top * 100 : 0}%` }} /><span className="bar-label">{labels[i]}</span></div>)}</div>
      </div>
    </>}
    {rows.length > 0 && <>
      <div className="list-heading"><h2>{d.listTitle}</h2><span>{rows.length} items</span></div>
      <div className="room-list">{rows.map((row, i) => <div className="room-row" key={i}><span className="row-mark">{row.initial}</span><div><strong>{row.title}</strong><small>{row.subtitle}</small></div><span className="row-value">{row.value}</span></div>)}</div>
    </>}
    {d.source === 'placeholder' && d.tracks && d.tracks.length > 0 && <div className="room-empty"><h2>What this room will track</h2><ul>{d.tracks.map(t => <li key={t}>{t}<small>Not connected yet</small></li>)}</ul></div>}
    <div className="room-footer"><span><i/> {sourceNote[d.source ?? 'illustrative']}</span><Button className="subtle-link" onClick={close}>Back to the building <Arrow back/></Button></div>

  </section>
}

type Design = { state: DesignState; message: string; ready: boolean; chooseQuickDesign: () => void; showDesign: () => void }

function DesignStatus({ design }: { design: Design }) {
  if (design.state === 'designing') return <aside className="design-status" aria-live="polite">
    <span className="section-kicker">SCENE DESIGNER</span>
    <strong><i className="design-spinner" aria-hidden="true"/>Designing your building…</strong>
    <p>It reads your company profile and picks a building and rooms that fit. This usually takes a minute or two.</p>
    <button type="button" onClick={design.chooseQuickDesign}>Use a quick design for now</button>
  </aside>
  if (design.ready) return <aside className="design-status" aria-live="polite">
    <span className="section-kicker">SCENE DESIGNER</span>
    <strong>Your designed building is ready.</strong>
    <button type="button" onClick={design.showDesign}>Show it</button>
  </aside>
  if (design.message) return <aside className="design-status design-status-note" aria-live="polite"><p>{design.message}</p></aside>
  return null
}

export default function App({ company = 'Consul Goods', departments: rooms = defaultDepartments, scene = defaultScene, design, actions, business }: { business?: BusinessInput; company?: string; departments?: Department[]; scene?: SceneSpec; design?: Design; actions?: ReactNode }) {
  // The design picks the building; rooms keep their content and get their place in the building's grid.
  // While Scene Designer works, a construction site stands in, framed like a three-floor building.
  const constructing = design?.state === 'designing'
  const layout = useMemo(() => constructing ? layoutBuilding('storefront', 6) : layoutBuilding(drawnArchetype(scene.archetype), rooms.length, scene.roofProps.length), [constructing, scene.archetype, rooms.length, scene.roofProps.length])
  const departments = useMemo(() => constructing ? [] : placeRooms(layout, rooms, scene), [constructing, layout, rooms, scene])
  const drawn = useMemo(() => ({ ...scene, archetype: layout.archetype }), [scene, layout.archetype])
  const [sceneView, setSceneView] = useState<{ view: BusinessView; settled: boolean }>({ view: 'home', settled: true })
  const [active, setActive] = useState<DepartmentId | null>(null)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [ready, setReady] = useState(false)
  const lastRoom = useRef<DepartmentId | null>(null)
  const pointer = useRef({ x: 0, y: 0 })
  const settleView = useCallback((view: BusinessView) => {
    setSceneView(current => current.view === view && !current.settled ? { view, settled: true } : current)
  }, [])
  const selectView = (view: BusinessView) => {
    if (sceneView.view === view) return
    setActive(null)
    setReady(false)
    pointer.current = { x: 0, y: 0 }
    setSceneView({ view, settled: false })
  }
  const homeReady = sceneView.view === 'home' && sceneView.settled
  const councilReady = sceneView.view === 'council' && sceneView.settled
  const activeDepartment = departments.find(department => department.id === active)
  const panelSide = activeDepartment?.side === 'left' ? 'left' : 'right'
  const roomColors = activeDepartment ? { '--room-color': activeDepartment.ink, '--room-soft': activeDepartment.soft } as CSSProperties : undefined
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
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (document.querySelector('dialog[open]')) return
      if (sceneView.view === 'council') { selectView('home'); document.getElementById('nav-consul')?.focus() }
      else if (sceneView.view === 'agents') { selectView('home'); document.getElementById('nav-agents')?.focus() }
      else if (active) close()
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [active, reducedMotion, sceneView.view])
  const fallback = homeReady ? <FlatStorefront open={open} company={company} departments={departments} scene={drawn} layout={layout}/> : null

  return <main className={`world ${active ? 'inside-room' : ''} ${reducedMotion ? 'reduce-motion' : ''}`} data-council-open={councilReady} data-view={sceneView.view} data-view-settled={sceneView.settled} data-panel-side={panelSide} data-department={active || undefined} style={roomColors}
    onPointerMove={event => {
      if (event.pointerType === 'touch' || active || reducedMotion || !homeReady) return
      pointer.current = { x: event.clientX / window.innerWidth * 2 - 1, y: event.clientY / window.innerHeight * 2 - 1 }
    }} onPointerLeave={() => { pointer.current = { x: 0, y: 0 } }}>
    <div className="scene-layer" inert={!homeReady}><SceneBoundary key={layout.key} fallback={<SceneFallback view={sceneView.view} settled={sceneView.settled} onViewSettled={settleView}>{fallback}</SceneFallback>}><BusinessScene company={company} scene={drawn} layout={layout} constructing={constructing} departments={departments} active={active} open={open} pointer={pointer} reducedMotion={reducedMotion} view={sceneView.view} viewSettled={sceneView.settled} onViewSettled={settleView} fallback={fallback}/></SceneBoundary></div>
    <header className="world-header">
      <div className="wordmark brand-glass"><span className="wordmark-symbol">c.</span><div>consul<span>THE BUSINESS, CONNECTED</span></div></div>
      <div className="world-header-content">
        <div className="workspace-status"><i/><span className="workspace-company" title={company}>{company}</span><span className="status-divider"/><span className="established">{departments.some(d => d.source === 'illustrative') ? 'Illustrative room data' : 'Rooms built from your setup'}</span></div>
        {actions && <div className="workspace-actions" aria-label="Workspace actions">{actions}</div>}
      </div>
    </header>
    {active && <Button className="back-button" onClick={close}><Arrow back/>Back to business<span>ESC</span></Button>}
    <div className={`intro ${active || !homeReady ? 'intro-hidden' : ''}`} aria-hidden={!homeReady || undefined}><span className="section-kicker">A NEW PERSPECTIVE</span><h1>Your business.<br/><em>A world of its own.</em></h1><p>{design?.state === 'agent' ? `Designed by Scene Designer: ${scene.reasoning}` : design && design.state !== 'designing' ? scene.reasoning : 'Step closer. Every room tells a story.'}</p></div>
    {design && !active && homeReady && <DesignStatus design={design}/>}
    {homeReady && activeDepartment && ready && <DepartmentView department={activeDepartment} departments={departments} close={close} select={open}/>}
    {!active && homeReady && <footer className="world-footer"><div className="coordinate"><span>01 — THE WHOLE PICTURE</span><small>{company} · Your business, connected</small></div><div className="explore-hint"><span className="mouse-icon"/><span>Move to explore <i/> Select a room to step inside</span></div><span className="scene-index">A little closer to everything.</span></footer>}
    {sceneView.view === 'agents' && sceneView.settled && <AgentsPanel reducedMotion={reducedMotion}/>}
    {councilReady && business && <CouncilPanel key={councilBusinessKey(business)} business={business}/>}
    <nav className="bottom-navigation" aria-label="Main navigation">
      <Button id="nav-consul" className="bottom-navigation-item" disabled={!business} aria-current={sceneView.view === 'council' ? 'page' : undefined} onClick={() => selectView('council')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 9 3 3-3 3m6 0h4"/></svg>
        <span>Consul</span>
      </Button>
      <Button className="bottom-navigation-item" aria-current={sceneView.view === 'home' ? 'page' : undefined} onClick={() => { sceneView.view === 'home' ? close() : selectView('home') }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9"/></svg>
        <span>Home</span>
      </Button>
      <Button id="nav-agents" className="bottom-navigation-item" aria-current={sceneView.view === 'agents' ? 'page' : undefined} onClick={() => selectView('agents')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="7" width="16" height="13" rx="3"/><path d="M12 3v4M2 12v4m20-4v4M9 16h6"/><circle cx="9" cy="12" r=".8" fill="currentColor"/><circle cx="15" cy="12" r=".8" fill="currentColor"/></svg>
        <span>Agents</span>
      </Button>
    </nav>
  </main>
}
