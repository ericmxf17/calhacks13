import { useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { MathUtils, OrthographicCamera, Quaternion, Vector3, type Group } from 'three'
import type { SceneSpec } from '@/lib/scene-spec'
import { type Department, type DepartmentId } from './departments'
import type { BuildingLayout } from './scene/layout'
import { ThemeProvider, sceneTheme } from './scene/parts'
import { BlankWindow, DepartmentRoom, settleEpsilon } from './scene/Room'
import { GroundProps, Lot, RoofProps } from './scene/props'
import Building from './scene/archetypes'
import Construction from './scene/archetypes/Construction'
import Assemble, { type AssembleStage } from './scene/assemble'
import Birds from './scene/Birds'
import { viewTurn, type BusinessView } from './scene/view-turn'
import { clearScenePosition } from './scene/view-framing'
import { groundShadowY } from './scene/lot-volumes'
import { homeCameraPose } from './scene/home-camera-pose'

export type { BusinessView } from './scene/view-turn'
type Props = { company: string; scene: SceneSpec; layout: BuildingLayout; constructing?: boolean; onSiteShown?: () => void; assembling?: boolean; onAssembled?: () => void; onDrawn?: () => void; departments: Department[]; active: DepartmentId | null; open: (id: DepartmentId) => void; reducedMotion: boolean; pointer: MutableRefObject<{ x: number; y: number }>; fallback: ReactNode; view: BusinessView; viewSettled: boolean; onViewSettled: (view: BusinessView) => void }

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
  const homePosition = useRef(new Vector3())
  // A new building frames Home differently, so the Home angle is measured again before the next swing.
  useEffect(() => { if (currentView.current === 'home') homeQuaternion.current = null }, [layout.key])
  const initialHomeReported = useRef(false)
  const swing = useRef<{ from: Quaternion; to: Quaternion; position: Vector3; destination: Vector3; zoom: number; destinationZoom: number; homeTarget: Vector3 | null; elapsed: number; complete: boolean } | null>(null)
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
      if (currentView.current === 'home') {
        homePosition.current.copy(camera.position)
        homeQuaternion.current = camera.quaternion.clone()
      }
      currentView.current = requestedView
      if (!homeQuaternion.current) homeQuaternion.current = camera.quaternion.clone()
      const home = requestedView === 'home' ? homeCameraPose(layout, size, pointer.current, reducedMotion) : null
      const destination = home ? home.rotation : homeQuaternion.current.clone().premultiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), viewTurn(requestedView)))
      // Every request starts at the rendered pose, including reversals mid-swing.
      const destinationPosition = home ? home.position : clearScenePosition(homePosition.current, destination, size.width, orthographic.zoom, layout.lotWidth, layout.top, requestedView === 'agents' ? -1 : 1)
      swing.current = { from: camera.quaternion.clone(), to: destination, position: camera.position.clone(), destination: destinationPosition, zoom: orthographic.zoom, destinationZoom: home?.zoom ?? orthographic.zoom, homeTarget: home?.target ?? null, elapsed: 0, complete: false }
    }
    const transition = swing.current
    if (transition && !transition.complete) {
      transition.elapsed += delta
      const progress = reducedMotion ? 1 : Math.min(transition.elapsed / .9, 1)
      const eased = progress * progress * (3 - 2 * progress)
      camera.position.lerpVectors(transition.position, transition.destination, eased)
      const nextZoom = MathUtils.lerp(transition.zoom, transition.destinationZoom, eased)
      if (orthographic.zoom !== nextZoom) {
        orthographic.zoom = nextZoom
        orthographic.updateProjectionMatrix()
      }
      camera.quaternion.slerpQuaternions(transition.from, transition.to, eased)
      if (progress === 1 && !transition.complete) {
        transition.complete = true
        initialHomeReported.current = true
        interactive.current = requestedView === 'home'
        position.current.copy(camera.position)
        if (transition.homeTarget) target.current.copy(transition.homeTarget)
        settledCallback.current(requestedView)
      }
      // Home resumes damping from the exact landing pose, including its look-at target.
      continuing.current = progress < 1 || requestedView === 'home'
      if (continuing.current) invalidate()
      return
    }
    // Non-home views hold a fixed pose. Request reversals are handled above before
    // this return, so a new home request can still begin from the rendered pose.
    if (requestedView !== 'home') {
      // Resizing a settled view must not reveal a previously off-screen vehicle.
      camera.position.copy(clearScenePosition(homePosition.current, camera.quaternion, size.width, orthographic.zoom, layout.lotWidth, layout.top, requestedView === 'agents' ? -1 : 1))
      return
    }
    const mobile = size.width < 760
    const room = departments.find(d => d.id === active)
    const amount = reducedMotion ? 1 : 1 - Math.exp(-delta * 4)
    let zoom: number
    if (room) {
      const direction = room.side === 'left' || (!room.side && room.position[0] < 0) ? -1 : 1
      focus.current.set(room.position[0] + (mobile ? .05 : direction * 1.7), room.position[1] - (mobile ? .4 : .2), .6)
      view.current.copy(focus.current).add(new Vector3(mobile ? 1.6 : direction * 1.6, 1.2, 13))
      // Every room uses the original building's close-up scale.
      const fit = Math.min(size.height / (mobile ? 12 : 10.8), size.width / (mobile ? 9 : 15.5))
      zoom = fit * (mobile ? 1.55 : 1.9)
    } else {
      // Frame the whole building; bigger buildings are centered higher and seen from further out.
      const home = homeCameraPose(layout, size, pointer.current, reducedMotion)
      focus.current.copy(home.target)
      view.current.copy(home.position)
      zoom = home.zoom
    }
    target.current.lerp(focus.current, amount); position.current.lerp(view.current, amount)
    const targetSettled = target.current.distanceToSquared(focus.current) <= settleEpsilon ** 2
    const positionSettled = position.current.distanceToSquared(view.current) <= settleEpsilon ** 2
    if (targetSettled) target.current.copy(focus.current)
    if (positionSettled) position.current.copy(view.current)
    camera.position.copy(position.current); camera.lookAt(target.current)
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
  }, -2)
  return null
}

/** Tells the page once the scene has drawn its first frame, so overlays don't open over an empty sky. */
function FirstFrame({ onDrawn }: { onDrawn?: () => void }) {
  const done = useRef(false)
  useFrame(() => { if (!done.current) { done.current = true; onDrawn?.() } })
  return null
}

export default function BusinessScene(props: Props) {
  const portal = useRef<HTMLDivElement>(null!)
  const interactive = useRef(false)
  const structure = useRef<Group>(null), roof = useRef<Group>(null), ground = useRef<Group>(null)
  // When the construction site gives way, the building goes up floor by floor, then roof props, then ground props.
  const stages = useMemo<AssembleStage[]>(() => [
    { root: structure, from: 0, to: .55, length: .35 },
    { root: roof, from: .6, to: .72, length: .2 },
    { root: ground, from: .66, to: .78, length: .2 },
  ], [])
  const { scene, layout } = props
  const theme = useMemo(() => sceneTheme(scene.archetype, scene.palette), [scene.archetype, scene.palette])
  const open = (id: DepartmentId) => { if (props.view === 'home' && interactive.current) props.open(id) }
  const s = layout.scale
  // offsetSize measures the layout size, ignoring the scene layer's fade-in scale, so the canvas renders at full resolution.
  return <><div ref={portal} className="hotspot-layer" style={props.assembling ? { visibility: 'hidden' } : undefined}/><Canvas resize={{ offsetSize: true }} frameloop="demand" orthographic camera={{ position: [7.3, 6.7, 17], zoom: 65, near: .1, far: 100 }} shadows="percentage" dpr={[1, 2]} fallback={props.fallback} gl={{ antialias: true, alpha: true }} onCreated={({ gl }) => { gl.localClippingEnabled = true }}>
    <color attach="background" args={['#dcf5fc']}/>
    <fog attach="fog" args={['#dcf5fc', 28, 65]}/>
    <ambientLight intensity={1.1}/>
    <hemisphereLight args={['#ffffff', '#88b7cb', 1.1]}/>
    {/* The shadow area grows with the building; the key remounts the light so its shadow camera updates. */}
    <directionalLight key={layout.key} position={[-5, 12, 8]} intensity={2.3} color="#fff9e9" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-10 * s} shadow-camera-right={10 * s} shadow-camera-top={12 * s} shadow-camera-bottom={-8 * s} shadow-camera-near={.5} shadow-camera-far={40 * s} shadow-bias={-.0001} shadow-normalBias={.025} shadow-radius={1.5}/>
    <directionalLight position={[7, 6, -3]} intensity={1.2} color="#d3e0dc"/>
    <ThemeProvider value={theme}>
      {props.constructing ? <Construction company={props.company} reducedMotion={props.reducedMotion} onShown={props.onSiteShown}/> : <>
        <group ref={structure}>
          <Building layout={layout} company={props.company} sign={scene.sign}/>
          {props.departments.map((d, i) => <DepartmentRoom key={d.id} department={d} active={props.active} open={open} index={i} portal={portal}/>)}
          {layout.blanks.map(at => <BlankWindow key={at.join()} at={at}/>)}
        </group>
        <group ref={roof}><RoofProps layout={layout} props={scene.roofProps}/></group>
        <group ref={ground}><GroundProps layout={layout} props={scene.groundProps}/></group>
        {!props.assembling && <Birds layout={layout} view={props.view} settled={props.viewSettled} reducedMotion={props.reducedMotion}/>}
        {props.assembling && <Assemble stages={stages} onDone={props.onAssembled}/>}
      </>}
      <Lot layout={layout} ground={props.constructing ? 'gravel' : scene.ground}/>
    </ThemeProvider>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, groundShadowY, 0]} receiveShadow><planeGeometry args={[200, 200]}/><shadowMaterial color="#76899b" opacity={.24}/></mesh>
    <FirstFrame onDrawn={props.onDrawn}/>
    <CameraRig layout={layout} departments={props.departments} active={props.active} pointer={props.pointer} reducedMotion={props.reducedMotion} view={props.view} viewSettled={props.viewSettled} onViewSettled={props.onViewSettled} interactive={interactive}/>
  </Canvas></>
}
