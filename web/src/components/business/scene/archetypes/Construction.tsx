import { useEffect, useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { Group } from 'three'
import type { Vec3 } from '../layout'
import { Box, Sign, useTheme } from '../parts'

const concrete = '#cfcac0', slab = '#e2ddd2', steel = '#f2b134', wood = '#c98a55'
const floors = [2.5, 4.55, 6.6]
// The frame goes up one step at a time: each floor's columns, then its slab.
// Quickly, since the site is the first half of a three-second loading screen.
const stepSeconds = .18, popSeconds = .35
const easeOutBack = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2
const smooth = (t: number) => t * t * (3 - 2 * t)

/** One piece of the frame. It grows up from its base, or out across, when its step comes. */
function Piece({ step, at, size, color, across = false, clock, still }: { step: number; at: Vec3; size: Vec3; color: string; across?: boolean; clock: MutableRefObject<number>; still: boolean }) {
  const group = useRef<Group>(null!)
  useFrame(() => {
    const p = still ? 1 : Math.min(Math.max(((performance.now() - clock.current) / 1000 - step * stepSeconds) / popSeconds, 0), 1)
    // Hidden on every axis until its step, or a slab would show as a thin sliver in mid-air.
    if (p <= 0) { group.current.scale.setScalar(1e-4); return }
    const grow = Math.max(easeOutBack(p), 1e-4)
    group.current.scale.set(across ? grow : 1, across ? 1 : grow, 1)
  })
  return <group ref={group} position={[at[0], at[1] - size[1] / 2, at[2]]}><Box at={[0, size[1] / 2, 0]} size={size} color={color}/></group>
}

// The crane's loop, as keyframes: [seconds, jib angle (radians), trolley distance, cable length, load size].
// It lifts a load off the pallets, swings it over the frame, sets it down, and swings back for the next one.
const loop: [number, number, number, number, number][] = [
  [0, Math.PI / 2, 2.6, 9.0, 1], [1.6, Math.PI / 2, 2.6, 1.6, 1], [4, 0, 4.2, 1.6, 1], [5.4, 0, 4.2, 2.6, 1],
  [5.9, 0, 4.2, 2.6, 0], [6.3, 0, 4.2, 1.6, 0], [8.2, Math.PI / 2, 2.6, 1.6, 0], [8.6, Math.PI / 2, 2.6, 8.6, 0], [9, Math.PI / 2, 2.6, 9.0, 1],
]
const loopSeconds = loop[loop.length - 1][0]
function crane(seconds: number) {
  const t = seconds % loopSeconds
  const i = loop.findIndex(([at], n) => n > 0 && t <= at)
  const [t0, ...a] = loop[i - 1], [t1, ...b] = loop[i]
  const k = smooth((t - t0) / (t1 - t0))
  return a.map((v, n) => v + (b[n] - v) * k)
}

/** The building site that opens the loading screen: the frame goes up while a tower crane lifts loads onto it. */
export default function Construction({ company, reducedMotion = false, onShown }: { company: string; reducedMotion?: boolean; onShown?: () => void }) {
  const { dark, accent } = useTheme()
  const invalidate = useThree(state => state.invalidate)
  const clock = useRef(0)
  const shown = useRef(false)
  const jib = useRef<Group>(null!), trolley = useRef<Group>(null!), cable = useRef<Group>(null!), load = useRef<Group>(null!)
  // The site keeps moving while it shows, at about 30 frames a second. The building scene stays idle as before.
  useEffect(() => {
    clock.current = performance.now()
    if (reducedMotion) return
    const timer = window.setInterval(() => invalidate(), 1000 / 30)
    return () => window.clearInterval(timer)
  }, [reducedMotion, invalidate])
  useFrame(() => {
    // The loading screen's clock starts with the first frame, since the first canvas can take a moment to start.
    if (!shown.current) { shown.current = true; clock.current = performance.now(); onShown?.() }
    const [angle, distance, length, size] = reducedMotion ? [0, 4.2, 2.1, 1] : crane((performance.now() - clock.current) / 1000)
    jib.current.rotation.y = angle
    trolley.current.position.x = -distance
    cable.current.scale.y = length
    load.current.position.y = -length - .175
    load.current.scale.setScalar(Math.max(size, 1e-4))
  })
  const piece = (step: number, at: Vec3, size: Vec3, color: string, across = false) =>
    <Piece key={`${at.join()}`} step={step} at={at} size={size} color={color} across={across} clock={clock} still={reducedMotion}/>
  const bases = [0, ...floors.slice(0, -1)]
  return <group>
    {piece(0, [0, 2.4, -.5], [4.4, 4.8, .9], concrete)}
    {floors.flatMap((top, k) => [-2.3, -.8, .8, 2.3].flatMap(x => [-.75, .85].map(z =>
      piece(1 + 2 * k, [x, (bases[k] + top) / 2, z], [.2, top - bases[k], .2], concrete))))}
    {floors.map((y, k) => piece(2 + 2 * k, [0, y, .1], [5.0, .16, 1.9], slab, true))}
    {/* Scaffolding across the front, with a plank at each finished floor. */}
    {[-2.6, -1.3, 0, 1.3, 2.6].map(x => piece(1, [x, 3.6, 1.35], [.05, 7.2, .05], steel))}
    {[1.2, 2.5, 3.8, 5.1, 6.4].map((y, k) => piece(1 + k, [0, y, 1.35], [5.3, .05, .05], steel, true))}
    {floors.map((y, k) => piece(2 + 2 * k, [0, y + .05, 1.35], [5.3, .05, .4], wood, true))}
    {/* A tower crane beside the building. The jib turns about the tower; the cable hangs from the trolley. */}
    <Box at={[3.6, 4.8, -1.2]} size={[.4, 9.6, .4]} color={steel}/>
    <Box at={[3.6, 9.2, -1.2]} size={[.7, .6, .6]} color={dark}/>
    <group ref={jib} position={[3.6, 9.75, -1.2]}>
      <Box at={[-2.2, 0, 0]} size={[6.4, .25, .25]} color={steel}/>
      <Box at={[1.7, 0, 0]} size={[1.6, .25, .25]} color={steel}/>
      <Box at={[2.2, -.3, 0]} size={[.6, .5, .5]} color={concrete}/>
      <group ref={trolley}>
        <Box at={[0, -.15, 0]} size={[.3, .1, .3]} color={dark} cast={false}/>
        <group ref={cable} position={[0, -.2, 0]}><Box at={[0, -.5, 0]} size={[.03, 1, .03]} color={dark} cast={false}/></group>
        <group ref={load}><Box at={[0, 0, 0]} size={[.8, .35, .5]} color={accent}/></group>
      </group>
    </group>
    {/* Pallets the crane lifts its loads from. */}
    <Box at={[3.6, .15, 1.4]} size={[.95, .3, .7]} color={wood}/>
    <Box at={[3.6, .34, 1.4]} size={[.8, .08, .6]} color="#a8713f"/>
    {/* Site hoarding with the company name. */}
    <Box at={[0, .6, 2.05]} size={[5.6, 1.0, .08]} color={accent}/>
    <Sign text={company} tagline="Designing your building" background="#fffdf4" color="#243957" at={[0, .62, 2.1]} width={4.2} height={.62}/>
    {[-1.9, 2.1].map(x => <group key={x}>
      <Box at={[x, .3, 2.45]} size={[.22, .45, .22]} color="#ff7a45" cast={false}/>
      <Box at={[x, .36, 2.45]} size={[.24, .06, .24]} color="#ffffff" cast={false}/>
    </group>)}
  </group>
}
