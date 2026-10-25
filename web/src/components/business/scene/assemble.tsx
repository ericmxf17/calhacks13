import { useEffect, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Box3, Vector3, type Group, type Mesh } from 'three'

/** How long the finished building takes to assemble after the construction site. */
export const assembleSeconds = 1.6

/** A part of the scene that assembles in a window of the total time (0 to 1). Lower pieces go first. */
export type AssembleStage = { root: RefObject<Group | null>; from: number; to: number; length: number }

// rise: the piece's half height, when it grows up from its base instead of dropping in.
type Piece = { mesh: Mesh; position: Vector3; scale: Vector3; delay: number; length: number; rise: number | null }

const hidden = 1e-4, drop = 1.2
// A gentle overshoot, so each piece settles into place.
const easeOutBack = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2
const easeOut = (t: number) => 1 - (1 - t) ** 2

function collect(stages: AssembleStage[]): Piece[] {
  const pieces: Piece[] = [], bounds = new Box3()
  for (const { root, from, to, length } of stages) {
    if (!root.current) continue
    root.current.updateWorldMatrix(true, true)
    const found: { mesh: Mesh; bottom: number; top: number; x: number }[] = []
    root.current.traverse(object => {
      if (!(object as Mesh).isMesh) return
      bounds.setFromObject(object)
      found.push({ mesh: object as Mesh, bottom: bounds.min.y, top: bounds.max.y, x: (bounds.min.x + bounds.max.x) / 2 })
    })
    const span = (values: number[]) => [Math.min(...values), Math.max(...values) - Math.min(...values) || 1]
    const [low, height] = span(found.flatMap(f => [f.bottom, f.top])), [left, width] = span(found.map(f => f.x))
    const spread = to - from
    for (const { mesh, bottom, top, x } of found) {
      const base = { mesh, position: mesh.position.clone(), scale: mesh.scale.clone() }
      if (mesh.userData.build === 'late') { pieces.push({ ...base, delay: .8, length: .18, rise: null }); continue }
      // Walls and pillars rise from the ground at the pace the floors go up beside them.
      const { geometry, rotation } = mesh
      if (top - bottom > height / 4 && !rotation.x && !rotation.y && !rotation.z) {
        geometry.boundingBox ?? geometry.computeBoundingBox()
        const box = geometry.boundingBox!
        pieces.push({ ...base, delay: from + spread * .85 * (bottom - low) / height, length: Math.max(.12, spread * .85 * (top - bottom) / height + .1), rise: (box.max.y - box.min.y) / 2 * base.scale.y })
        continue
      }
      // Everything else drops in floor by floor, with a slight left-to-right ripple.
      pieces.push({ ...base, delay: from + spread * (.85 * (bottom - low) / height + .15 * (x - left) / width), length, rise: null })
    }
  }
  return pieces
}

/** Drops every mesh in the stages into place, then calls onDone. Mount it only while assembling. */
export default function Assemble({ stages, onDone }: { stages: AssembleStage[]; onDone?: () => void }) {
  const invalidate = useThree(state => state.invalidate)
  const pieces = useRef<Piece[] | null>(null)
  const started = useRef(0)
  const finished = useRef(false)
  const done = useRef(onDone)
  useEffect(() => { done.current = onDone }, [onDone])
  // Leave every piece in its real place if this unmounts early.
  useEffect(() => () => { for (const p of pieces.current ?? []) { p.mesh.position.copy(p.position); p.mesh.scale.copy(p.scale) } }, [])
  useFrame(() => {
    if (finished.current) return
    if (!pieces.current) { pieces.current = collect(stages); started.current = performance.now() }
    const t = (performance.now() - started.current) / 1000 / assembleSeconds
    for (const p of pieces.current) {
      const local = Math.min(Math.max((t - p.delay) / p.length, 0), 1)
      if (local <= 0) { p.mesh.scale.setScalar(hidden); continue }
      if (p.rise !== null) {
        const grow = Math.max(easeOut(local), hidden)
        p.mesh.scale.set(p.scale.x, p.scale.y * grow, p.scale.z)
        p.mesh.position.set(p.position.x, p.position.y - p.rise * (1 - grow), p.position.z)
        continue
      }
      const grow = Math.max(easeOutBack(local), hidden)
      p.mesh.scale.set(p.scale.x * grow, p.scale.y * grow, p.scale.z * grow)
      p.mesh.position.set(p.position.x, p.position.y + drop * (1 - local) ** 2, p.position.z)
    }
    if (t < 1) { invalidate(); return }
    finished.current = true
    for (const p of pieces.current) { p.mesh.position.copy(p.position); p.mesh.scale.copy(p.scale) }
    invalidate()
    done.current?.()
  })
  return null
}
