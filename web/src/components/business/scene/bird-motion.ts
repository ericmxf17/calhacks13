import type { BusinessView } from './view-turn'

export type BirdPoint = { x: number; y: number }
export const birdEntrySide = (view: BusinessView) => view === 'agents' ? -1 : 1
export const roofBirdSize = (zoom: number) => Math.min(22, Math.max(9, zoom * .27))
export const cardBirdSize = (width: number) => Math.min(21, Math.max(15, width * .055))
export function birdFlightPoint(from: BirdPoint, to: BirdPoint, progress: number, arc: number): BirdPoint {
  const t = Math.min(1, Math.max(0, progress)), eased = t * t * (3 - 2 * t)
  return { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased - Math.sin(Math.PI * t) * arc }
}
