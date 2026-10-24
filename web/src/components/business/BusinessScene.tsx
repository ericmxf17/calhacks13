import { useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { MathUtils, OrthographicCamera, Quaternion, Vector3 } from 'three'
import type { SceneSpec } from '@/lib/scene-spec'
import { type Department, type DepartmentId } from './departments'
import type { BuildingLayout } from './scene/layout'
import { ThemeProvider, sceneTheme } from './scene/parts'
import { BlankWindow, DepartmentRoom, settleEpsilon } from './scene/Room'
import { GroundProps, Lot, RoofProps } from './scene/props'
import Building from './scene/archetypes'
import Construction from './scene/archetypes/Construction'

export type BusinessView = 'home' | 'agents' | 'council'
type Props = { company: string; scene: SceneSpec; layout: BuildingLayout; constructing?: boolean; departments: Department[]; active: DepartmentId | null; open: (id: DepartmentId) => void; reducedMotion: boolean; pointer: MutableRefObject<{ x: number; y: number }>; fallback: ReactNode; view: BusinessView; viewSettled: boolean; onViewSettled: (view: BusinessView) => void }

function CameraRig({ layout, departments, active, pointer, reducedMotion, view: requestedView, viewSettled, onViewSettled, interactive }: Pick<Props, 'layout' | 'departments' | 'active' | 'pointer' | 'reducedMotion' | 'view' | 'viewSettled' | 'onViewSettled'> & { interactive: MutableRefObject<boolean> }) {
  const { camera, size, gl, invalidate } = useThree()
  const continuing = useRef(false)
  const target = useRef(new Vector3(0, 3.5, 0))
  const position = useRef(new Vector3(8, 6.5, 16))
  const focus = useRef(new Vector3())
  const view = useRef(new Vector3())
  const settledCallback = useRef(onViewSettled)
  useEffect(() => { settledCallback.current = onViewSettled }, [onViewSettled])
  const currentView = useRef<BusinessView>('home')
  const homeQuaternion = useRef<Quaternion | null>(null)
  const initialHomeReported = useRef(false)
  const swing = useRef<{ from: Quaternion; to: Quaternion; position: Vector3; zoom: number; elapsed: number; complete: boolean } | null>(null)
  useEffect(() => {
    if (requestedView !== 'home' || active || reducedMotion) return
    // App updates the pointer ref at the React root before this window listener.
    const move = (event: PointerEvent) => { if (event.pointerType !== 'touch') invalidate() }
    const world = gl.domElement.closest('.world')
    const leave = () => invalidate()
    window.addEventListener('pointermove', move, { passive: true })
    world?.addEventListener('pointerleave', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      world?.removeEventListener('pointerleave', leave)
    }
  }, [requestedView, active, reducedMotion, gl, invalidate])
  useEffect(() => {
    const transition = swing.current
    if (viewSettled || currentView.current !== requestedView || (transition && !transition.complete)) return
    interactive.current = requestedView === 'home'
    settledCallback.current(requestedView)
  }, [requestedView, viewSettled, onViewSettled])
  useFrame((_, dt) => {
    const delta = continuing.current ? dt : 1 / 60
    continuing.current = false
    const orthographic = camera as OrthographicCamera
    if (currentView.current !== requestedView) {
      interactive.current = false
      currentView.current = requestedView
      if (!homeQuaternion.current) homeQuaternion.current = camera.quaternion.clone()
      const destination = homeQuaternion.current.clone()
      if (requestedView === 'agents') destination.premultiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -Math.PI / 2))
      if (requestedView === 'council') destination.premultiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2))
      // Every request starts at the rendered pose, including reversals mid-swing.
      swing.current = { from: camera.quaternion.clone(), to: destination, position: camera.position.clone(), zoom: orthographic.zoom, elapsed: 0, complete: false }
    }
    const transition = swing.current
    if (transition && !transition.complete) {
      transition.elapsed += delta
      const progress = reducedMotion ? 1 : Math.min(transition.elapsed / .9, 1)
      const eased = progress * progress * (3 - 2 * progress)
      camera.position.copy(transition.position)
      if (orthographic.zoom !== transition.zoom) {
        orthographic.zoom = transition.zoom
        orthographic.updateProjectionMatrix()
      }
      camera.quaternion.slerpQuaternions(transition.from, transition.to, eased)
      if (progress === 1 && !transition.complete) {
        transition.complete = true
        initialHomeReported.current = true
        interactive.current = requestedView === 'home'
        position.current.copy(camera.position)
        settledCallback.current(requestedView)
      }
      // Returning Home resumes its position/target damping after the rotation.
      continuing.current = progress < 1 || requestedView === 'home'
      if (continuing.current) invalidate()
      return
    }
    // Non-home views hold a fixed pose. Request reversals are handled above before
    // this return, so a new home request can still begin from the rendered pose.
    if (requestedView !== 'home') return
    const mobile = size.width < 760
    const room = departments.find(d => d.id === active)
    const amount = reducedMotion ? 1 : 1 - Math.exp(-delta * 4)
    if (room) {
      const direction = room.side === 'left' || (!room.side && room.position[0] < 0) ? -1 : 1
      focus.current.set(room.position[0] + (mobile ? .05 : direction * 1.7), room.position[1] - (mobile ? .4 : .2), .6)
      view.current.copy(focus.current).add(new Vector3(mobile ? 1.6 : direction * 1.6, 1.2, 13))
    } else {
      // Frame the whole building; bigger buildings are centered higher and seen from further out.
      const [x, y] = layout.homeTarget
      focus.current.set(mobile ? x + .25 : x, y, 0)
      view.current.set(x + 7.55 + (reducedMotion ? 0 : pointer.current.x * .9), y + 3.2 - (reducedMotion ? 0 : pointer.current.y * .55), 17)
    }
    target.current.lerp(focus.current, amount); position.current.lerp(view.current, amount)
    const targetSettled = target.current.distanceToSquared(focus.current) <= settleEpsilon ** 2
    const positionSettled = position.current.distanceToSquared(view.current) <= settleEpsilon ** 2
    if (targetSettled) target.current.copy(focus.current)
    if (positionSettled) position.current.copy(view.current)
    camera.position.copy(position.current); camera.lookAt(target.current)
    // Room close-ups use the original building's zoom, so every room looks the same size.
    const fit = (scale: number) => Math.min(size.height / ((mobile ? 12 : 10.8) * scale), size.width / ((mobile ? 9 : 15.5) * scale))
    const zoom = room ? fit(1) * (mobile ? 1.55 : 1.9) : fit(layout.scale)
    const dampedZoom = MathUtils.lerp(orthographic.zoom, zoom, amount)
    const zoomSettled = Math.abs(dampedZoom - zoom) <= settleEpsilon
    const nextZoom = zoomSettled ? zoom : dampedZoom
    if (orthographic.zoom !== nextZoom) {
      orthographic.zoom = nextZoom
      orthographic.updateProjectionMatrix()
    }
    continuing.current = !targetSettled || !positionSettled || !zoomSettled
    if (continuing.current) invalidate()
    if (!initialHomeReported.current) {
      initialHomeReported.current = true
      interactive.current = true
      settledCallback.current('home')
    }
  })
  return null
}

export default function BusinessScene(props: Props) {
  const portal = useRef<HTMLDivElement>(null!)
  const interactive = useRef(false)
  const { scene, layout } = props
  const theme = useMemo(() => sceneTheme(scene.archetype, scene.palette), [scene.archetype, scene.palette])
  const open = (id: DepartmentId) => { if (props.view === 'home' && interactive.current) props.open(id) }
  const s = layout.scale
  // offsetSize measures the layout size, ignoring the scene layer's fade-in scale, so the canvas renders at full resolution.
  return <><div ref={portal} className="hotspot-layer"/><Canvas resize={{ offsetSize: true }} frameloop="demand" orthographic camera={{ position: [7.3, 6.7, 17], zoom: 65, near: .1, far: 100 }} shadows="percentage" dpr={[1, 1.6]} fallback={props.fallback} gl={{ antialias: true, alpha: true }}>
    <color attach="background" args={['#dcf5fc']}/>
    <fog attach="fog" args={['#dcf5fc', 28, 65]}/>
    <ambientLight intensity={1.1}/>
    <hemisphereLight args={['#ffffff', '#88b7cb', 1.1]}/>
    {/* The shadow area grows with the building; the key remounts the light so its shadow camera updates. */}
    <directionalLight key={layout.key} position={[-5, 12, 8]} intensity={2.3} color="#fff9e9" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-10 * s} shadow-camera-right={10 * s} shadow-camera-top={12 * s} shadow-camera-bottom={-8 * s} shadow-normalBias={.025}/>
    <directionalLight position={[7, 6, -3]} intensity={1.2} color="#d3e0dc"/>
    <ThemeProvider value={theme}>
      {props.constructing ? <Construction company={props.company}/> : <>
        <Building layout={layout} company={props.company} sign={scene.sign}/>
        {props.departments.map((d, i) => <DepartmentRoom key={d.id} department={d} active={props.active} open={open} index={i} portal={portal}/>)}
        {layout.blanks.map(at => <BlankWindow key={at.join()} at={at}/>)}
        <RoofProps layout={layout} props={scene.roofProps}/>
        <GroundProps layout={layout} props={scene.groundProps}/>
      </>}
      <Lot layout={layout} ground={props.constructing ? 'gravel' : scene.ground}/>
    </ThemeProvider>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.17, 0]} receiveShadow><planeGeometry args={[200, 200]}/><shadowMaterial color="#76899b" opacity={.24}/></mesh>
    <CameraRig layout={layout} departments={props.departments} active={props.active} pointer={props.pointer} reducedMotion={props.reducedMotion} view={props.view} viewSettled={props.viewSettled} onViewSettled={props.onViewSettled} interactive={interactive}/>
  </Canvas></>
}
