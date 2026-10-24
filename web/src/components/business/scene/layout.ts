import { roomInk, type Archetype, type SceneSpec } from '@/lib/scene-spec'
import type { Department } from '../departments'

export type Vec3 = [number, number, number]
export type Side = 'left' | 'right' | 'center'
export type Cell = { position: Vec3; side: Side; floor: string; number: string }
export type BuildingLayout = {
  archetype: Archetype; key: string
  cols: number; rows: number
  colX: number[]
  /** Room row heights, top row first. */
  rowY: number[]
  cells: Cell[]
  /** Window positions in the grid with no room behind them. */
  blanks: Vec3[]
  facadeWidth: number
  /** Height of the roof line. */
  top: number
  lotWidth: number
  homeTarget: Vec3
  /** How much bigger than the original two-by-two storefront the scene is; the camera zooms out by this. */
  scale: number
}

// Every building type shares the original storefront's room grid, so room close-ups look the same everywhere.
const PITCH_X = 3.14, PITCH_Y = 2.05, FIRST_ROW_Y = 3.65, ROOM_Z = 1.04
const FLOORS = ['FIRST FLOOR', 'SECOND FLOOR', 'THIRD FLOOR', 'FOURTH FLOOR']

const columns: Record<Archetype, (rooms: number) => number> = {
  storefront: () => 2,
  studio: () => 2,
  cafe: rooms => rooms <= 4 ? 2 : 3,
  workshop: rooms => rooms === 4 ? 2 : 3,
  warehouse: rooms => rooms === 4 ? 2 : 3,
}

// How far each roof rises above the roof line, so the camera keeps it in frame.
const roofRise: Record<Archetype, number> = { storefront: 0, workshop: .6, cafe: .75, studio: .5, warehouse: 0 }

export function layoutBuilding(archetype: Archetype, rooms: number, roofProps = 0): BuildingLayout {
  const count = Math.max(1, rooms)
  const cols = columns[archetype](count), rows = Math.ceil(count / cols)
  const colX = Array.from({ length: cols }, (_, c) => (c - (cols - 1) / 2) * PITCH_X)
  const rowY = Array.from({ length: rows }, (_, r) => FIRST_ROW_Y + (rows - 1 - r) * PITCH_Y)
  const cells: Cell[] = [], blanks: Vec3[] = []
  for (let i = 0; i < rows * cols; i++) {
    const row = Math.floor(i / cols), col = i % cols
    const position: Vec3 = [colX[col], rowY[row], ROOM_Z]
    if (i >= count) { blanks.push(position); continue }
    const side: Side = col === 0 ? 'left' : col === cols - 1 ? 'right' : 'center'
    cells.push({ position, side, floor: FLOORS[rows - 1 - row] ?? `FLOOR ${rows - row}`, number: String(i + 1).padStart(2, '0') })
  }
  const facadeWidth = cols * PITCH_X - 1.03
  const top = rowY[0] + 1.6
  const lotWidth = facadeWidth + 3.05
  // Roof props stand up to about 1.5 above the roof; allow for part of that when framing.
  const extent = top + roofRise[archetype] + (roofProps ? .8 : 0)
  const scale = Math.min(1.8, Math.max(.85, lotWidth / 8.3, (extent + .2) / 7.5))
  return {
    archetype, key: `${archetype}:${cols}x${rows}:${count}:${roofProps ? 'props' : 'flat'}`, cols, rows, colX, rowY, cells, blanks,
    // Wider buildings sit a little further right, clear of the intro text on the left.
    facadeWidth, top, lotWidth, homeTarget: [-.25 - (facadeWidth - 5.25) * .3, 3.5 + (extent - 7.3) / 2, 0], scale,
  }
}

/** Puts each room into the next grid cell and fills in what the design says about it. */
export function placeRooms(layout: BuildingLayout, departments: Department[], spec: SceneSpec): Department[] {
  return departments.map((department, i) => {
    const cell = layout.cells[i], room = spec.rooms.find(r => r.id === department.id)
    const colors = department.ink && department.soft ? { ink: department.ink, soft: department.soft } : roomInk(department.color)
    return {
      ...department, ...colors, position: cell.position, side: cell.side, floor: cell.floor, number: cell.number,
      furniture: room?.furniture ?? department.furniture ?? 'desk', kind: department.kind ?? room?.kind,
    }
  })
}
