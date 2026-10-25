import { useMemo, useRef, useState, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { MathUtils, MeshStandardMaterial, type Group } from 'three'
import type { Department, DepartmentId } from '../departments'
import type { Vec3 } from './layout'
import { Box, useTheme } from './parts'
import RoomFurniture from './furniture'
import { paneDestination, windowClipPlanes } from './window-pane-motion'

export const settleEpsilon = 1e-4

// Side posts meet the horizontal rails without overlapping their outer faces.
function Frame() {
  const { trim } = useTheme()
  return <>
    {[-.59, .59].map(side => <Box key={side} at={[side, 0, -.02]} size={[.12, 1.64, .25]} color={trim}/>)}
    {[-.88, .88].map(side => <Box key={side} at={[0, side, .035]} size={[1.3, .12, .35]} color={trim}/>)}
  </>
}

export function DepartmentRoom({ department, active, open, index, portal }: { department: Department; active: DepartmentId | null; open: (id: DepartmentId) => void; index: number; portal: RefObject<HTMLElement> }) {
  const [hovered, setHovered] = useState(false)
  const shutters = useRef<Group>(null)
  const continuing = useRef(false)
  const invalidate = useThree(state => state.invalidate)
  const theme = useTheme()
  const [x, y, z] = department.position
  const side = department.side ?? (index % 2 === 0 ? 'left' : 'right')
  const clippingPlanes = useMemo(() => side === 'left' ? windowClipPlanes(x) : undefined, [side, x])
  const selected = active === department.id
  useFrame((_, dt) => {
    if (!shutters.current) return
    const destination = paneDestination(selected, side)
    // The first frame after idle includes the entire dormant interval in dt.
    const delta = continuing.current ? dt : 1 / 60
    const next = MathUtils.damp(shutters.current.position.x, destination, 6, delta)
    continuing.current = Math.abs(next - destination) > settleEpsilon
    shutters.current.position.x = continuing.current ? next : destination
    if (continuing.current) invalidate()
  })
  // A middle-column label sits on the beam above its room, clear of the window and the sign below.
  const label: Vec3 = active ? [0, -.57, .4] : side === 'center' ? [0, 1.02, .5] : [side === 'left' ? -.77 : .77, -.08, .4]
  return <group position={[x, y, z]}>
    <Box at={[0, 0, -.65]} size={[1.03, 1.6, .08]} color={selected || hovered ? department.color : theme.roomIdle}/>
    <Box at={[0, -.82, -.25]} size={[1.1, .07, 1]} color={theme.floor}/>
    <RoomFurniture type={department.furniture} color={department.color} variant={index}/>
    <Frame/>
    <group ref={shutters}>
      <mesh position={[0, 0, .018]} onClick={() => open(department.id)} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
        <boxGeometry args={[1.02, 1.61, .035]}/><meshStandardMaterial color={hovered ? '#a5edff' : '#47a8ce'} transparent depthWrite={false} opacity={side === 'left' ? .28 : selected ? 0 : .28} roughness={.28} metalness={.2} clippingPlanes={clippingPlanes}/>
      </mesh>
      {side === 'left' ? <>
        <mesh position={[0, 0, .06]} castShadow receiveShadow><boxGeometry args={[.045, 1.63, .045]}/><meshStandardMaterial color={theme.dark} roughness={.84} clippingPlanes={clippingPlanes} clipShadows/></mesh>
        <mesh position={[0, .28, .06]} castShadow receiveShadow><boxGeometry args={[1.05, .045, .045]}/><meshStandardMaterial color={theme.dark} roughness={.84} clippingPlanes={clippingPlanes} clipShadows/></mesh>
      </> : !selected && <><Box at={[0, 0, .06]} size={[.045, 1.63, .045]} color={theme.dark}/><Box at={[0, .28, .06]} size={[1.05, .045, .045]} color={theme.dark}/></>}
    </group>
    {!selected && <Html portal={portal} position={label} center zIndexRange={[20, 10]}><button id={`room-${department.id}`} className={`room-hotspot ${active ? 'room-hotspot-compact' : `label-${side}`}`} onClick={() => open(department.id)} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setHovered(true)} onBlur={() => setHovered(false)} aria-label={`Enter ${department.name}`}><i/><span><small>{active ? 'OPEN ROOM' : `${department.number} / ${department.floor.replace(' FLOOR', '')}`}</small><strong>{department.name}</strong></span><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor"/></svg></button></Html>}
  </group>
}

const blindsGlass = new MeshStandardMaterial({ color: '#47a8ce', transparent: true, depthWrite: false, opacity: .28, roughness: .28, metalness: .2 })

/** A window in the room grid with no room behind it, shown with its blinds down. */
export function BlankWindow({ at }: { at: Vec3 }) {
  const theme = useTheme()
  return <group position={at}>
    <Box at={[0, 0, -.65]} size={[1.03, 1.6, .08]} color={theme.roomIdle}/>
    {[-.56, -.28, 0, .28, .56].map(y => <Box key={y} at={[0, y, -.1]} size={[1, .22, .03]} color={theme.trim} cast={false}/>)}
    <Frame/>
    <mesh position={[0, 0, .018]} scale={[1.02, 1.61, .035]} material={blindsGlass}><boxGeometry/></mesh>
  </group>
}
