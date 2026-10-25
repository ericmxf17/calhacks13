import { ExtrudeGeometry, Path, Shape } from 'three'

type Frame = { half: number; pierY: number; pierHeight: number; mids: number[]; beams: number[]; roofBase: number }

/** Cut window openings out of a single solid instead of overlapping beam and column faces. */
export function createFacadeGeometry(frame: Frame) {
  const halfBeam = .21
  const columns = [-(frame.half - .245), ...frame.mids, frame.half - .245]
  const widths = columns.map((_, i) => i === 0 || i === columns.length - 1 ? .5 : 1.75)
  const bottom = Math.min(frame.pierY - frame.pierHeight / 2, ...frame.beams.map(y => y - halfBeam))
  // The roof slab has the same front depth: stop at its underside, never inside it.
  const top = Math.min(frame.roofBase, Math.max(frame.pierY + frame.pierHeight / 2, ...frame.beams.map(y => y + halfBeam)))
  // Match the shell's side plane; their depth ranges meet without overlapping.
  const halfWidth = frame.half, centerY = (bottom + top) / 2
  const shape = new Shape()
  shape.moveTo(-halfWidth, bottom)
  shape.lineTo(halfWidth, bottom)
  shape.lineTo(halfWidth, top)
  shape.lineTo(-halfWidth, top)
  shape.closePath()
  for (let row = 0; row < frame.beams.length - 1; row++) {
    for (let col = 0; col < columns.length - 1; col++) {
      const left = columns[col] + widths[col] / 2
      const right = columns[col + 1] - widths[col + 1] / 2
      const low = frame.beams[row] + halfBeam, high = frame.beams[row + 1] - halfBeam
      const opening = new Path()
      opening.moveTo(left, low)
      opening.lineTo(left, high)
      opening.lineTo(right, high)
      opening.lineTo(right, low)
      opening.closePath()
      shape.holes.push(opening)
    }
  }
  const geometry = new ExtrudeGeometry(shape, { depth: .6, bevelEnabled: false, steps: 1, curveSegments: 1 })
  // Assembly scales each part about its center, then anchors its base as it rises.
  geometry.translate(0, -centerY, 0)
  return { geometry, centerY }
}
