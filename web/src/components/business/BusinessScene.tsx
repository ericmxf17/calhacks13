import { useMemo, useRef, useState, type MutableRefObject, type ReactNode, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { CanvasTexture, MathUtils, OrthographicCamera, Vector3, type Group } from 'three'
import { departments, type DepartmentId } from './departments'

type Props = { active: DepartmentId | null; open: (id: DepartmentId) => void; reducedMotion: boolean; pointer: MutableRefObject<{ x: number; y: number }>; fallback: ReactNode }
const palette = { stone: '#e3d9c6', trim: '#eee6d7', dark: '#34413b', gold: '#ad9870', glass: '#8d9c91', wall: '#c9bda6', floor: '#b8a087' }

function Box({ at, size, color = palette.stone }: { at: [number, number, number]; size: [number, number, number]; color?: string }) {
  return <mesh position={at} castShadow receiveShadow><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={0.84}/></mesh>
}

function Sign() {
  const texture = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 128
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#e5ddcf'; ctx.fillRect(0, 0, 1024, 128)
    ctx.fillStyle = '#414b40'; ctx.font = '42px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('N O R T H S T A R', 512, 65)
    return new CanvasTexture(c)
  }, [])
  return <mesh position={[0, 2.16, 1.125]}><planeGeometry args={[4.75, 0.49]}/><meshStandardMaterial map={texture} roughness={1}/></mesh>
}

function Plant({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  return <group position={[x, 0.12, z]} scale={scale}>
    <mesh position={[0, .2, 0]} castShadow><cylinderGeometry args={[.22, .15, .4, 12]}/><meshStandardMaterial color="#b5a48a" roughness={1}/></mesh>
    <mesh position={[0, .58, 0]} castShadow><sphereGeometry args={[.27, 10, 10]}/><meshStandardMaterial color="#75816a" roughness={1}/></mesh>
    <mesh position={[0, .83, 0]} castShadow scale={[.75, 1, .75]}><sphereGeometry args={[.24, 10, 10]}/><meshStandardMaterial color="#859174" roughness={1}/></mesh>
  </group>
}

function Furnishing({ color, variant = 0 }: { color: string; variant?: number }) {
  return <group>
    <Box at={[0, -.37, .15]} size={[.82, .07, .48]} color="#9d805e"/>
    {[-.32, .32].map(x => <Box key={x} at={[x, -.62, .16]} size={[.045, .45, .32]} color={palette.dark}/>)}
    <Box at={[.05, -.16, .03]} size={[.3, .27, .035]} color={palette.dark}/>
    <Box at={[.05, -.15, .056]} size={[.25, .21, .01]} color="#d8d5bb"/>
    <Box at={[-.31, -.27, .19]} size={[.12, .1, .15]} color={color}/>
    <Box at={[.35, .35, -.52]} size={[.32, .43, .035]} color={color}/>
    <Box at={[0, -.8, .4]} size={[.3, .09, .3]} color={color}/>
    <Box at={[0, -.64, .53]} size={[.31, .36, .05]} color={color}/>
    {variant % 2 === 0 && <Box at={[-.4, .17, -.4]} size={[.27, .07, .25]} color={palette.dark}/>}
  </group>
}

function DepartmentRoom({ department, active, open, index, portal }: { department: typeof departments[number]; active: DepartmentId | null; open: Props['open']; index: number; portal: RefObject<HTMLElement> }) {
  const [hovered, setHovered] = useState(false)
  const shutters = useRef<Group>(null)
  const selected = active === department.id
  useFrame((_, dt) => {
    if (shutters.current) shutters.current.position.x = MathUtils.damp(shutters.current.position.x, selected ? -1.35 : 0, 6, dt)
  })
  const [x, y, z] = department.position
  return <group position={[x, y, z]}>
    <Box at={[0, 0, -.65]} size={[1.03, 1.6, .08]} color={selected || hovered ? '#dfc99e' : '#ada58d'}/>
    <Box at={[0, -.82, -.25]} size={[1.1, .07, 1]} color={palette.floor}/>
    <Furnishing color={department.color} variant={index}/>
    {[-.59, .59].map(side => <Box key={side} at={[side, 0, -.02]} size={[.12, 1.81, .25]} color={palette.trim}/>)}
    {[-.88, .88].map(side => <Box key={side} at={[0, side, .035]} size={[1.3, .12, .35]} color={palette.trim}/>)}
    <group ref={shutters}>
      <mesh position={[0, 0, .018]} onClick={() => open(department.id)} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
        <boxGeometry args={[1.02, 1.61, .035]}/><meshStandardMaterial color={hovered ? '#cad0ad' : '#788579'} transparent opacity={selected ? 0 : .42} roughness={.28} metalness={.2}/>
      </mesh>
      {!selected && <><Box at={[0, 0, .06]} size={[.045, 1.63, .045]} color={palette.dark}/><Box at={[0, .28, .06]} size={[1.05, .045, .045]} color={palette.dark}/></>}
    </group>
    {!selected && <Html portal={portal} position={active ? [0, -.57, .4] : [index % 2 === 0 ? -.77 : .77, -.08, .4]} center zIndexRange={[20, 10]}><button id={`room-${department.id}`} className={`room-hotspot ${active ? 'room-hotspot-compact' : index % 2 === 0 ? 'label-left' : 'label-right'}`} onClick={() => open(department.id)} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setHovered(true)} onBlur={() => setHovered(false)} aria-label={`Enter ${department.name}`}><i/><span><small>{active ? 'OPEN ROOM' : `${department.number} / ${department.floor.replace(' FLOOR', '')}`}</small><strong>{department.shortName === 'Supply' ? 'Supply chain' : department.shortName === 'Hiring' ? 'People & hiring' : department.name}</strong></span><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor"/></svg></button></Html>}
  </group>
}

function Storefront({ active, open, portal }: Pick<Props, 'active' | 'open'> & { portal: RefObject<HTMLElement> }) {
  return <group>
    {/* A solid rear shell, with an open facade around the four recessed rooms. */}
    <Box at={[0, 3.59, -.4]} size={[5.25, 7.1, 1.3]}/>
    <Box at={[0, 3.59, -.97]} size={[5.3, 7.18, .13]} color={palette.wall}/>
    {[-2.38, 0, 2.38].map((x, i) => <Box key={x} at={[x, 4.67, .72]} size={[i === 1 ? 1.75 : .5, 4.7, .6]}/>)}
    {[2.55, 4.67, 6.87].map(y => <Box key={y} at={[0, y, .72]} size={[5.2, .42, .6]}/>)}
    {[0.16, 2.51, 6.99, 7.12, 7.26].map((y, i) => <Box key={y} at={[0, y, .12]} size={[5.3 + (i > 2 ? .22 : 0), .12, 2.18 + (i > 2 ? .2 : 0)]} color={palette.trim}/>)}
    <Box at={[0, 7.23, -.15]} size={[5.2, .13, 1.65]} color="#b8b3a4"/>
    {[-2.55, 2.55].map(x => <group key={x}>{Array.from({ length: 12 }, (_, i) => <Box key={i} at={[x, 2.8 + i * .35, 1.04]} size={[.28, .28, .07]} color={palette.trim}/>)}</group>)}
    {departments.map((d, i) => <DepartmentRoom key={d.id} department={d} active={active} open={open} index={i} portal={portal}/>)}
    <Box at={[0, 4.37, 1.08]} size={[1.21, 2.8, .2]}/>
    <Box at={[0, 4.7, 1.2]} size={[.78, 1.55, .06]} color={palette.dark}/>
    {[-.2,.2].map(x => <Box key={x} at={[x, 4.7, 1.24]} size={[.32, 1.4, .035]} color="#a8ad97"/>)}
    <Box at={[0, 3.91, 1.4]} size={[1.45, .13, .76]} color={palette.trim}/>
    <Box at={[0, 4.35, 1.76]} size={[1.45, .055, .045]} color={palette.dark}/>
    <Box at={[0, 3.99, 1.76]} size={[1.45, .04, .045]} color={palette.dark}/>
    {Array.from({ length: 9 }, (_, i) => <Box key={i} at={[-.65 + i * .163, 4.17, 1.76]} size={[.025, .4, .025]} color={palette.dark}/>)}
    <Box at={[0, 2.16, 1]} size={[5.18, .57, .22]}/><Sign/>
    {[-2.52, -.68, .68, 2.52].map(x => <Box key={x} at={[x, 1.13, .94]} size={[.13, 1.83, .16]} color={palette.dark}/>)}
    {[-1.6, 1.6].map(x => <group key={x}>
      <Box at={[x, 1.1, .39]} size={[1.65, 1.7, .2]} color="#c5b59b"/>
      <Box at={[x, .32, .98]} size={[1.7, .17, .18]} color={palette.dark}/>
      <mesh position={[x, 1.16, 1.025]}><planeGeometry args={[1.64, 1.56]}/><meshStandardMaterial color="#9ea792" transparent opacity={.34} roughness={.22} metalness={.1}/></mesh>
      {[-.43, .1, .5].map((s, i) => <group position={[x+s, .45, .76]} key={s}>
        <mesh position={[0, .62, 0]} castShadow><sphereGeometry args={[.075, 12, 12]}/><meshStandardMaterial color="#c1ae91"/></mesh>
        <mesh position={[0, .34, 0]} castShadow><cylinderGeometry args={[.12, .19, .48, 8]}/><meshStandardMaterial color={['#d7ccb2','#a2a486','#c0aa97'][i]}/></mesh>
        <Box at={[0, -.02, 0]} size={[.025, .25, .025]} color={palette.gold}/>
      </group>)}
    </group>)}
    <Box at={[0, 1.06, 1]} size={[1.15, 1.8, .07]} color={palette.dark}/>
    <Box at={[0, 1.15, 1.05]} size={[.93, 1.4, .035]} color="#b1b5a0"/>
    <Box at={[.3, .97, 1.11]} size={[.035, .24, .04]} color={palette.gold}/>
    <Box at={[0, .11, 1.15]} size={[1.5, .18, .7]}/><Box at={[0, .035, 1.36]} size={[1.8, .1, .85]}/>
    <Plant x={-2.91} z={1.22} scale={1.25}/><Plant x={2.91} z={1.22} scale={1.25}/><Plant x={-1.01} z={1.55} scale={.65}/><Plant x={1.02} z={1.55} scale={.65}/>
    <Box at={[0, -.08, 0]} size={[7, .15, 4.3]} color="#d5cdbb"/>
    {[-2,-1,0,1,2].map(x => <Box key={x} at={[x, .003, 1.9]} size={[.008, .003, .45]} color="#b9b4a6"/>)}
  </group>
}

function CameraRig({ active, pointer, reducedMotion }: Pick<Props, 'active' | 'pointer' | 'reducedMotion'>) {
  const { camera, size } = useThree()
  const target = useRef(new Vector3(0, 3.5, 0))
  const position = useRef(new Vector3(8, 6.5, 16))
  const focus = useRef(new Vector3())
  const view = useRef(new Vector3())
  useFrame((_, dt) => {
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
    const orthographic = camera as OrthographicCamera
    const baseZoom = Math.min(size.height / (mobile ? 12 : 10.8), size.width / (mobile ? 9 : 15.5))
    const zoom = room ? baseZoom * (mobile ? 1.55 : 1.9) : baseZoom
    orthographic.zoom = MathUtils.lerp(orthographic.zoom, zoom, amount)
    orthographic.updateProjectionMatrix()
  })
  return null
}

export default function BusinessScene(props: Props) {
  const portal = useRef<HTMLDivElement>(null!)
  return <><div ref={portal} className="hotspot-layer"/><Canvas orthographic camera={{ position: [7.3, 6.7, 17], zoom: 65, near: .1, far: 100 }} shadows="percentage" dpr={[1, 1.6]} fallback={props.fallback} gl={{ antialias: true, alpha: true }}>
    <color attach="background" args={['#eeede5']}/>
    <fog attach="fog" args={['#eeede5', 28, 65]}/>
    <ambientLight intensity={1.25}/>
    <hemisphereLight args={['#fff7df', '#a8b6aa', 1.5]}/>
    <directionalLight position={[-5, 12, 8]} intensity={3.1} color="#fff1d4" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={12} shadow-camera-bottom={-8} shadow-normalBias={.025}/>
    <directionalLight position={[7, 6, -3]} intensity={1.2} color="#d3e0dc"/>
    <Storefront active={props.active} open={props.open} portal={portal}/>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.17, 0]} receiveShadow><planeGeometry args={[200, 200]}/><meshStandardMaterial color="#eeede5" roughness={1}/></mesh>
    <CameraRig active={props.active} pointer={props.pointer} reducedMotion={props.reducedMotion}/>
  </Canvas></>
}
