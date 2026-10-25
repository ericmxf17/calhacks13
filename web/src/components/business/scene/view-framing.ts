import { Quaternion, Vector3 } from 'three'

/** Clear the complete lot, including vehicles, even on an ultrawide viewport. */
export function clearScenePosition(position: Vector3, rotation: Quaternion, width: number, zoom: number, lotWidth: number, height: number, side: -1 | 1) {
  const inverse = rotation.clone().invert(), right = new Vector3(1, 0, 0).applyQuaternion(rotation)
  const halfRoad = Math.max(12, lotWidth + 3.7) / 2
  const coordinates: number[] = []
  for (const x of [-halfRoad, halfRoad]) for (const y of [-.4, height + 2]) for (const z of [-2.7, 3.8]) {
    coordinates.push(new Vector3(x, y, z).sub(position).applyQuaternion(inverse).x)
  }
  const edge = width / (2 * zoom) + .7
  const shift = side === -1 ? Math.max(0, Math.max(...coordinates) + edge) : Math.min(0, Math.min(...coordinates) - edge)
  return position.clone().addScaledVector(right, shift)
}
