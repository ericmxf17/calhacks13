import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { CanvasTexture, MathUtils, OrthographicCamera, Quaternion, Vector3, type Group } from 'three'
import { type Department, type DepartmentId } from './departments'

export type BusinessView = 'home' | 'agents'
type Props = { company: string; departments: Department[]; active: DepartmentId | null; open: (id: DepartmentId) => void; reducedMotion: boolean; pointer: MutableRefObject<{ x: number; y: number }>; fallback: ReactNode; view: BusinessView; viewSettled: boolean; onViewSettled: (view: BusinessView) => void }
const palette = { stone: '#ffb16d', trim: '#fff4d4', dark: '#253b64', gold: '#ffd447', glass: '#58cde3', wall: '#ef8259', floor: '#e48b58' }

function Box({ at, size, color = palette.stone }: { at: [number, number, number]; size: [number, number, number]; color?: string }) {
  return <mesh position={at} castShadow receiveShadow><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={0.84}/></mesh>
}

function Sign({ company }: { company: string }) {
  const texture = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 128
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#3475dc'; ctx.fillRect(0, 0, 1024, 128)
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 58px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const label = company.toUpperCase()
    const width = ctx.measureText(label).width
    ctx.font = `bold ${Math.min(58, 58 * 944 / Math.max(width, 1))}px sans-serif`
    ctx.fillText(label, 512, 65)
    return new CanvasTexture(c)
  }, [company])
  useEffect(() => () => texture.dispose(), [texture])
  return <mesh position={[0, 2.16, 1.125]}><planeGeometry args={[4.75, 0.49]}/><meshStandardMaterial map={texture} roughness={1}/></mesh>
}

function Plant({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  return <group position={[x, 0.12, z]} scale={scale}>
    <Box at={[0, .17, 0]} size={[.4, .34, .4]} color="#ee7758" />
    <Box at={[0, .48, 0]} size={[.09, .35, .09]} color="#9c663d" />
    <Box at={[0, .7, 0]} size={[.53, .5, .5]} color="#49b968" />
    <Box at={[.09, .98, .02]} size={[.34, .3, .33]} color="#88d65f" />
  </group>
}

function Furnishing({ color, variant = 0 }: { color: string; variant?: number }) {
  return <group>
    <Box at={[0, -.37, .15]} size={[.82, .07, .48]} color="#dc8550"/>
    {[-.32, .32].map(x => <Box key={x} at={[x, -.62, .16]} size={[.045, .45, .32]} color={palette.dark}/>)}
    <Box at={[.05, -.16, .03]} size={[.3, .27, .035]} color={palette.dark}/>
    <Box at={[.05, -.15, .056]} size={[.25, .21, .01]} color="#bcefff"/>
    <Box at={[-.31, -.27, .19]} size={[.12, .1, .15]} color={color}/>
    <Box at={[.35, .35, -.52]} size={[.32, .43, .035]} color={color}/>
    <Box at={[0, -.8, .4]} size={[.3, .09, .3]} color={color}/>
    <Box at={[0, -.64, .53]} size={[.31, .36, .05]} color={color}/>
    {variant % 2 === 0 && <Box at={[-.4, .17, -.4]} size={[.27, .07, .25]} color={palette.dark}/>}
  </group>
}

function DepartmentRoom({ department, active, open, index, portal }: { department: Department; active: DepartmentId | null; open: Props['open']; index: number; portal: RefObject<HTMLElement> }) {
  const [hovered, setHovered] = useState(false)
  const shutters = useRef<Group>(null)
  const selected = active === department.id
  useFrame((_, dt) => {
    if (shutters.current) shutters.current.position.x = MathUtils.damp(shutters.current.position.x, selected ? -1.35 : 0, 6, dt)
  })
  const [x, y, z] = department.position
  return <group position={[x, y, z]}>
    <Box at={[0, 0, -.65]} size={[1.03, 1.6, .08]} color={selected || hovered ? department.color : '#b8dfe9'}/>
    <Box at={[0, -.82, -.25]} size={[1.1, .07, 1]} color={palette.floor}/>
    <Furnishing color={department.color} variant={index}/>
    {[-.59, .59].map(side => <Box key={side} at={[side, 0, -.02]} size={[.12, 1.81, .25]} color={palette.trim}/>)}
    {[-.88, .88].map(side => <Box key={side} at={[0, side, .035]} size={[1.3, .12, .35]} color={palette.trim}/>)}
    <group ref={shutters}>
      <mesh position={[0, 0, .018]} onClick={() => open(department.id)} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
        <boxGeometry args={[1.02, 1.61, .035]}/><meshStandardMaterial color={hovered ? '#a5edff' : '#47a8ce'} transparent opacity={selected ? 0 : .28} roughness={.28} metalness={.2}/>
      </mesh>
      {!selected && <><Box at={[0, 0, .06]} size={[.045, 1.63, .045]} color={palette.dark}/><Box at={[0, .28, .06]} size={[1.05, .045, .045]} color={palette.dark}/></>}
    </group>
    {!selected && <Html portal={portal} position={active ? [0, -.57, .4] : [index % 2 === 0 ? -.77 : .77, -.08, .4]} center zIndexRange={[20, 10]}><button id={`room-${department.id}`} className={`room-hotspot ${active ? 'room-hotspot-compact' : index % 2 === 0 ? 'label-left' : 'label-right'}`} onClick={() => open(department.id)} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setHovered(true)} onBlur={() => setHovered(false)} aria-label={`Enter ${department.name}`}><i/><span><small>{active ? 'OPEN ROOM' : `${department.number} / ${department.floor.replace(' FLOOR', '')}`}</small><strong>{department.shortName === 'Supply' ? 'Supply chain' : department.shortName === 'Hiring' ? 'People & hiring' : department.name}</strong></span><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor"/></svg></button></Html>}
  </group>
}

function Storefront({ company, departments, active, open, portal }: Pick<Props, 'company' | 'departments' | 'active' | 'open'> & { portal: RefObject<HTMLElement> }) {
  return <group>
    {/* A solid rear shell, with an open facade around the four recessed rooms. */}
    <Box at={[0, 3.59, -.4]} size={[5.25, 7.1, 1.3]}/>
    <Box at={[0, 3.59, -.97]} size={[5.3, 7.18, .13]} color={palette.wall}/>
    {[-2.38, 0, 2.38].map((x, i) => <Box key={x} at={[x, 4.67, .72]} size={[i === 1 ? 1.75 : .5, 4.7, .6]}/>)}
    {[2.55, 4.67, 6.87].map(y => <Box key={y} at={[0, y, .72]} size={[5.2, .42, .6]}/>)}
    {[0.16, 2.51, 6.99, 7.12, 7.26].map((y, i) => <Box key={y} at={[0, y, .12]} size={[5.3 + (i > 2 ? .22 : 0), .12, 2.18 + (i > 2 ? .2 : 0)]} color={palette.trim}/>)}
    <Box at={[0, 7.23, -.15]} size={[5.2, .13, 1.65]} color="#eb7b55"/>
    {[-2.55, 2.55].map(x => <group key={x}>{Array.from({ length: 12 }, (_, i) => <Box key={i} at={[x, 2.8 + i * .35, 1.04]} size={[.28, .28, .07]} color={palette.trim}/>)}</group>)}
    {departments.map((d, i) => <DepartmentRoom key={d.id} department={d} active={active} open={open} index={i} portal={portal}/>)}
    <Box at={[0, 4.37, 1.08]} size={[1.21, 2.8, .2]}/>
    <Box at={[0, 4.7, 1.2]} size={[.78, 1.55, .06]} color={palette.dark}/>
    {[-.2,.2].map(x => <Box key={x} at={[x, 4.7, 1.24]} size={[.32, 1.4, .035]} color="#5bc9e8"/>)}
    <Box at={[0, 3.91, 1.4]} size={[1.45, .13, .76]} color={palette.trim}/>
    <Box at={[0, 4.35, 1.76]} size={[1.45, .055, .045]} color={palette.dark}/>
    <Box at={[0, 3.99, 1.76]} size={[1.45, .04, .045]} color={palette.dark}/>
    {Array.from({ length: 9 }, (_, i) => <Box key={i} at={[-.65 + i * .163, 4.17, 1.76]} size={[.025, .4, .025]} color={palette.dark}/>)}
    <Box at={[0, 2.16, 1]} size={[5.18, .57, .22]}/><Sign company={company}/>
    {[-2.52, -.68, .68, 2.52].map(x => <Box key={x} at={[x, 1.13, .94]} size={[.13, 1.83, .16]} color={palette.dark}/>)}
    {[-1.6, 1.6].map(x => <group key={x}>
      <Box at={[x, 1.1, .39]} size={[1.65, 1.7, .2]} color="#ffd473"/>
      <Box at={[x, .32, .98]} size={[1.7, .17, .18]} color={palette.dark}/>
      <mesh position={[x, 1.16, 1.025]}><planeGeometry args={[1.64, 1.56]}/><meshStandardMaterial color="#53bdd4" transparent opacity={.34} roughness={.22} metalness={.1}/></mesh>
      {[-.43, .1, .5].map((s, i) => <group position={[x+s, .45, .76]} key={s}>
        <mesh position={[0, .62, 0]} castShadow><boxGeometry args={[.15, .15, .15]}/><meshStandardMaterial color="#ffd9ad"/></mesh>
        <mesh position={[0, .34, 0]} castShadow><boxGeometry args={[.28, .48, .22]}/><meshStandardMaterial color={['#ff6488','#6d8aef','#ffd447'][i]}/></mesh>
        <Box at={[0, -.02, 0]} size={[.025, .25, .025]} color={palette.gold}/>
      </group>)}
    </group>)}
    <Box at={[0, 1.06, 1]} size={[1.15, 1.8, .07]} color={palette.dark}/>
    <Box at={[0, 1.15, 1.05]} size={[.93, 1.4, .035]} color="#59cee2"/>
    <Box at={[.3, .97, 1.11]} size={[.035, .24, .04]} color={palette.gold}/>
    <Box at={[0, .11, 1.15]} size={[1.5, .18, .7]}/><Box at={[0, .035, 1.36]} size={[1.8, .1, .85]}/>
    <Plant x={-2.91} z={1.22} scale={1.25}/><Plant x={2.91} z={1.22} scale={1.25}/><Plant x={-1.01} z={1.55} scale={.65}/><Plant x={1.02} z={1.55} scale={.65}/>
    <Box at={[0, -.16, 0]} size={[8.3, .3, 5.2]} color="#529d58"/>
    <Box at={[0, .005, -.2]} size={[8.3, .08, 4.8]} color="#8cda68"/>
    <Box at={[0, .06, .3]} size={[6.6, .12, 3.7]} color="#ffe5b2"/>
    <Box at={[0, -.06, 3.1]} size={[12, .12, 1.3]} color="#718ba2"/>
    {[-5,-3,-1,1,3,5].map(x => <Box key={`lane-${x}`} at={[x, .01, 3.1]} size={[.75, .012, .07]} color="#fff6d9"/>)}
    {[-2,-1,0,1,2].map(x => <Box key={x} at={[x, .003, 1.9]} size={[.008, .003, .45]} color="#e3b97b"/>)}
  </group>
}

function CameraRig({ departments, active, pointer, reducedMotion, view: requestedView, viewSettled, onViewSettled, interactive }: Pick<Props, 'departments' | 'active' | 'pointer' | 'reducedMotion' | 'view' | 'viewSettled' | 'onViewSettled'> & { interactive: MutableRefObject<boolean> }) {
  const { camera, size } = useThree()
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
    const transition = swing.current
    if (viewSettled || currentView.current !== requestedView || (transition && !transition.complete)) return
    interactive.current = requestedView === 'home'
    settledCallback.current(requestedView)
  }, [requestedView, viewSettled, onViewSettled])
  useFrame((_, dt) => {
    const orthographic = camera as OrthographicCamera
    if (currentView.current !== requestedView) {
      interactive.current = false
      currentView.current = requestedView
      if (!homeQuaternion.current) homeQuaternion.current = camera.quaternion.clone()
      const destination = homeQuaternion.current.clone()
      if (requestedView === 'agents') destination.premultiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -Math.PI / 2))
      // Every request starts at the rendered pose, including reversals mid-swing.
      swing.current = { from: camera.quaternion.clone(), to: destination, position: camera.position.clone(), zoom: orthographic.zoom, elapsed: 0, complete: false }
    }
    const transition = swing.current
    if (transition && (!transition.complete || requestedView === 'agents')) {
      transition.elapsed += dt
      const progress = reducedMotion || transition.complete ? 1 : Math.min(transition.elapsed / .9, 1)
      const eased = progress * progress * (3 - 2 * progress)
      camera.position.copy(transition.position)
      orthographic.zoom = transition.zoom
      camera.quaternion.slerpQuaternions(transition.from, transition.to, eased)
      orthographic.updateProjectionMatrix()
      if (progress === 1 && !transition.complete) {
        transition.complete = true
        initialHomeReported.current = true
        interactive.current = requestedView === 'home'
        position.current.copy(camera.position)
        settledCallback.current(requestedView)
      }
      return
    }
    const mobile = size.width < 760
    const room = departments.find(d => d.id === active)
    const amount = reducedMotion ? 1 : 1 - Math.exp(-dt * 4)
    if (room) {
      const direction = room.position[0] < 0 ? -1 : 1
      focus.current.set(room.position[0] + (mobile ? .05 : direction * 1.7), room.position[1] - (mobile ? .4 : .2), .6)
      view.current.copy(focus.current).add(new Vector3(mobile ? 1.6 : direction * 1.6, 1.2, 13))
    } else {
      focus.current.set(mobile ? 0 : -.25, 3.5, 0)
      view.current.set(7.3 + (reducedMotion ? 0 : pointer.current.x * .9), 6.7 - (reducedMotion ? 0 : pointer.current.y * .55), 17)
    }
    target.current.lerp(focus.current, amount); position.current.lerp(view.current, amount)
    camera.position.copy(position.current); camera.lookAt(target.current)
    const baseZoom = Math.min(size.height / (mobile ? 12 : 10.8), size.width / (mobile ? 9 : 15.5))
    const zoom = room ? baseZoom * (mobile ? 1.55 : 1.9) : baseZoom
    orthographic.zoom = MathUtils.lerp(orthographic.zoom, zoom, amount)
    orthographic.updateProjectionMatrix()
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
  return <><div ref={portal} className="hotspot-layer"/><Canvas orthographic camera={{ position: [7.3, 6.7, 17], zoom: 65, near: .1, far: 100 }} shadows="percentage" dpr={[1, 1.6]} fallback={props.fallback} gl={{ antialias: true, alpha: true }}>
    <color attach="background" args={['#dcf5fc']}/>
    <fog attach="fog" args={['#dcf5fc', 28, 65]}/>
    <ambientLight intensity={1.1}/>
    <hemisphereLight args={['#ffffff', '#88b7cb', 1.1]}/>
    <directionalLight position={[-5, 12, 8]} intensity={2.3} color="#fff9e9" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={12} shadow-camera-bottom={-8} shadow-normalBias={.025}/>
    <directionalLight position={[7, 6, -3]} intensity={1.2} color="#d3e0dc"/>
    <Storefront company={props.company} departments={props.departments} active={props.active} open={id => { if (props.view === 'home' && interactive.current) props.open(id) }} portal={portal}/>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.17, 0]} receiveShadow><planeGeometry args={[200, 200]}/><meshStandardMaterial color="#dcf5fc" roughness={1}/></mesh>
    <CameraRig departments={props.departments} active={props.active} pointer={props.pointer} reducedMotion={props.reducedMotion} view={props.view} viewSettled={props.viewSettled} onViewSettled={props.onViewSettled} interactive={interactive}/>
  </Canvas></>
}
