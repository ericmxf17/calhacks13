import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Vector3, type Group, type OrthographicCamera } from 'three'
import type { BuildingLayout } from './layout'
import type { BusinessView } from './view-turn'
import { birdEntrySide, birdFlightPoint, cardBirdSize, roofBirdSize, type BirdPoint } from './bird-motion'

const colors = ['#f9f5df', '#d3dce6', '#fff0cf']
type Anchor = { element: HTMLElement; fraction: number }
type Phase = 'roof' | 'departing' | 'waiting' | 'arriving' | 'card'

function roofHeight(layout: BuildingLayout) {
  const offset = { storefront: .02, workshop: -.04, warehouse: -.07, cafe: -.13, studio: .385 }
  return layout.top + (offset[layout.archetype as keyof typeof offset] ?? .02)
}

function cardPerch(world: HTMLElement, view: BusinessView, index: number): Anchor | null {
  if (view === 'home') return null
  const panel = world.querySelector(view === 'agents' ? '.agents-panel' : '.council-panel')
  if (!panel) return null
  const clip = panel.getBoundingClientRect()
  const cards = Array.from(world.querySelectorAll<HTMLElement>(view === 'agents' ? '.agent-card' : '.council-panel'))
    .map(element => ({ element, rect: element.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width > 0 && rect.top >= clip.top && rect.top < Math.min(clip.bottom, innerHeight) - 35)
  if (!cards.length) return null
  const top = Math.min(...cards.map(({ rect }) => rect.top))
  const row = cards.filter(({ rect }) => Math.abs(rect.top - top) < 8)
  const { element } = row[index % row.length]
  const siblings = Math.ceil((3 - index % row.length) / row.length), slot = Math.floor(index / row.length)
  return { element, fraction: (slot + 1) / (siblings + 1) }
}

function Bird({ index, layout, view, settled, reducedMotion }: { index: number; layout: BuildingLayout; view: BusinessView; settled: boolean; reducedMotion: boolean }) {
  const root = useRef<Group>(null!), sprite = useRef<SVGSVGElement>(null!)
  const leftWing = useRef<SVGGElement>(null!), rightWing = useRef<SVGGElement>(null!)
  const { camera, gl, invalidate } = useThree()
  const world = gl.domElement.closest('.world') as HTMLElement
  // Html owns the contents; moving this host into a card lets the browser scroll
  // the bird and its perch in the same compositor layer, without frame sampling.
  const host = useMemo(() => {
    const element = document.createElement('div')
    element.className = 'bird-perch-anchor'
    return element
  }, [])
  const portal = useMemo(() => ({ current: host }), [host])
  useEffect(() => {
    world.appendChild(host)
    return () => host.remove()
  }, [world, host])
  const perch = useMemo(() => new Vector3(layout.facadeWidth * [-.34, .04, .34][index], roofHeight(layout), layout.archetype === 'studio' ? .95 : .93), [layout, index])
  const projected = useRef(new Vector3()), anchor = useRef<Anchor | null>(null)
  const screen = useRef<BirdPoint | null>(null), origin = useRef<BirdPoint>({ x: 0, y: 0 })
  const previousView = useRef<BusinessView>('home'), entry = useRef(1)
  const started = useRef(0), phase = useRef<Phase>('roof'), currentSize = useRef(15), departureSize = useRef(15)

  useEffect(() => {
    const resize = () => { anchor.current = null; invalidate() }
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [invalidate])

  const roofPoint = () => {
    projected.current.copy(perch).project(camera)
    const canvas = gl.domElement.getBoundingClientRect(), container = world.getBoundingClientRect()
    return { x: (projected.current.x * .5 + .5) * canvas.width + canvas.left - container.left, y: (-projected.current.y * .5 + .5) * canvas.height + canvas.top - container.top }
  }
  const landing = () => {
    if (!anchor.current?.element.isConnected) anchor.current = cardPerch(world, view, index)
    if (!anchor.current) return null
    const rect = anchor.current.element.getBoundingClientRect(), container = world.getBoundingClientRect()
    const panel = world.querySelector(view === 'agents' ? '.agents-panel' : '.council-panel')?.getBoundingClientRect()
    if (!panel) return null
    return {
      point: { x: rect.left - container.left + anchor.current.element.clientLeft + anchor.current.element.clientWidth * anchor.current.fraction, y: rect.top - container.top + anchor.current.element.clientTop - 1 },
      size: cardBirdSize(rect.width),
    }
  }

  useEffect(() => {
    if (previousView.current === view) { invalidate(); return }
    const from = previousView.current
    previousView.current = view
    anchor.current = null
    // Agents enter from the left; Consul enters from the right. Home reverses the departure.
    entry.current = view === 'home' ? -birdEntrySide(from) : birdEntrySide(view)
    const rect = sprite.current?.getBoundingClientRect(), container = world.getBoundingClientRect()
    origin.current = rect ? { x: rect.left + rect.width / 2 - container.left, y: rect.bottom - container.top } : screen.current ?? roofPoint()
    departureSize.current = currentSize.current
    phase.current = reducedMotion ? (view === 'home' ? 'roof' : 'card') : 'departing'
    started.current = performance.now()
    invalidate()
  }, [view, settled, reducedMotion, perch, camera, invalidate])

  useFrame(() => {
    if (!sprite.current) return
    // CameraRig runs first, so the rooftop projection uses this frame's camera.
    camera.updateMatrixWorld()
    const now = performance.now(), container = world.getBoundingClientRect()
    const goal = view === 'home' ? { point: roofPoint(), size: roofBirdSize((camera as OrthographicCamera).zoom), clip: null } : landing()
    let visible = true, moving = false, flightFacing = -entry.current
    if (reducedMotion) phase.current = view === 'home' ? 'roof' : 'card'

    if (phase.current === 'departing') {
      const t = Math.max(0, (now - started.current) / 1000 - index * .045) / .38
      const edge = view === 'home' ? entry.current : -entry.current
      flightFacing = edge
      screen.current = birdFlightPoint(origin.current, { x: edge < 0 ? -32 : container.width + 32, y: origin.current.y - 36 - index * 8 }, t, 16)
      currentSize.current = departureSize.current
      moving = true
      if (t >= 1) phase.current = 'waiting'
    }
    if (phase.current === 'waiting') {
      visible = false
      // Cards mount after the camera swing. Don't begin a landing before the real destination exists.
      if (settled && goal) {
        origin.current = { x: entry.current < 0 ? -32 : container.width + 32, y: Math.max(28, goal.point.y - 35 - index * 9) }
        screen.current = origin.current
        started.current = now
        phase.current = 'arriving'
        invalidate()
      }
    } else if (phase.current === 'arriving') {
      if (!goal) { phase.current = 'waiting'; visible = false }
      else {
        const t = Math.max(0, (now - started.current) / 1000 - index * .07) / 1.05
        screen.current = birdFlightPoint(origin.current, goal.point, t, 28 + index * 5)
        currentSize.current = goal.size
        moving = true
        if (t >= 1) phase.current = view === 'home' ? 'roof' : 'card'
      }
    } else if (phase.current === 'roof' || phase.current === 'card') {
      if (goal) { screen.current = goal.point; currentSize.current = goal.size }
      else visible = false
    }

    const point = screen.current ?? roofPoint(), size = currentSize.current
    const attached = phase.current === 'card' && anchor.current?.element.isConnected
    const parent = attached ? anchor.current!.element : world
    if (host.parentElement !== parent) parent.appendChild(host)
    host.style.left = attached ? `${anchor.current!.fraction * 100}%` : '0px'
    host.style.top = attached ? '-1px' : '0px'
    sprite.current.style.visibility = visible ? 'visible' : 'hidden'
    sprite.current.style.width = sprite.current.style.height = `${size}px`
    // Outer birds look inward when perched; birds in flight face their actual travel direction.
    const facing = moving ? flightFacing : index === 2 ? -1 : 1
    sprite.current.style.transform = `translate(-50%, -100%) scaleX(${facing})`
    sprite.current.dataset.perched = String(phase.current === 'card' || phase.current === 'roof')
    sprite.current.dataset.phase = phase.current
    const flap = moving ? Math.sin(now / 1000 * 17 + index * .8) * 38 : 55
    leftWing.current?.setAttribute('transform', `rotate(${-flap} 11 15)`)
    rightWing.current?.setAttribute('transform', `rotate(${flap} 19 15)`)

    const canvas = gl.domElement.getBoundingClientRect()
    if (phase.current === 'roof') root.current.position.copy(perch)
    else root.current.position.set((point.x + container.left - canvas.left) / canvas.width * 2 - 1, 1 - (point.y + container.top - canvas.top) / canvas.height * 2, 0).unproject(camera)
    root.current.updateWorldMatrix(true, true)
    if (moving) invalidate()
  }, -1)

  return <group ref={root} position={perch}>
    <Html portal={portal} zIndexRange={[36, 36]} style={{ pointerEvents: 'none' }} calculatePosition={(object, projectionCamera, size) => {
      if (phase.current === 'card' && host.parentElement === anchor.current?.element) return [0, 0]
      projected.current.setFromMatrixPosition(object.matrixWorld).project(projectionCamera)
      const canvas = gl.domElement.getBoundingClientRect(), container = world.getBoundingClientRect()
      return [(projected.current.x * .5 + .5) * size.width + canvas.left - container.left, (-projected.current.y * .5 + .5) * size.height + canvas.top - container.top]
    }}>
      <svg ref={sprite} className="perching-bird" viewBox="0 0 32 32" width="18" height="18" aria-hidden="true" focusable="false">
        <path d="M11 27v4h4M20 27v4h4" fill="none" stroke="#d69a43" strokeWidth="2"/>
        <path d="m6 20-4 3 7 2 5-3z" fill="#71879f"/>
        <path d="m10 12 12 2v13l-12-2z" fill={colors[index]}/>
        <path d="m10 12 4-4 12 2-4 4z" fill="#ffffff"/>
        <path d="m22 14 4-4v13l-4 4z" fill="#aebed0"/>
        <g ref={leftWing}><path d="m11 15-9-1-1 4 10 4z" fill="#71879f"/><path d="m2 14 3-2 9 1-3 2z" fill="#a7b7c9"/></g>
        <g ref={rightWing}><path d="m19 15 10-2 2 4-10 5z" fill="#8195ab"/></g>
        <path d="m17 4 9 1v10l-9-1z" fill={colors[index]}/>
        <path d="m17 4 3-3 9 1-3 3z" fill="#fffdf4"/>
        <path d="m26 5 3-3v10l-3 3z" fill="#c2cbd4"/>
        <path d="m26 10 6 1-6 3z" fill="#f5b541"/>
        <path d="M23 7h2v2h-2z" fill="#253b64"/>
      </svg>
    </Html>
  </group>
}

export default function Birds(props: { layout: BuildingLayout; view: BusinessView; settled: boolean; reducedMotion: boolean }) {
  return <group name="rooftop-birds">{colors.map((_, index) => <Bird key={`${props.layout.key}:${index}`} index={index} {...props}/>)}</group>
}
