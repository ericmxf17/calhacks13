import { Matrix4, Quaternion, Vector3 } from 'three'

type Layout = { homeTarget: readonly number[]; scale: number }

/** One Home pose for both the navigation landing and normal pointer motion. */
export function homeCameraPose(layout: Layout, size: { width: number; height: number }, pointer: { x: number; y: number }, reducedMotion: boolean) {
  const mobile = size.width < 760, [x, y] = layout.homeTarget
  const target = new Vector3(mobile ? x + .25 : x, y, 0)
  const position = new Vector3(x + 7.55 + (reducedMotion ? 0 : pointer.x * .9), y + 3.2 - (reducedMotion ? 0 : pointer.y * .55), 17)
  const zoom = Math.min(size.height / ((mobile ? 12 : 10.8) * layout.scale), size.width / ((mobile ? 9 : 15.5) * layout.scale))
  const rotation = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(position, target, new Vector3(0, 1, 0)))
  return { target, position, zoom, rotation }
}
