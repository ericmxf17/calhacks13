import { Plane, Vector3 } from 'three'

export const paneDestination = (selected: boolean, side: string) => selected ? (side === 'left' ? 1.35 : -1.35) : 0

/** Fixed world-space edges hide the sliding pane behind the window frame. */
export const windowClipPlanes = (centerX: number) => [
  new Plane(new Vector3(1, 0, 0), .53 - centerX),
  new Plane(new Vector3(-1, 0, 0), .53 + centerX),
]
