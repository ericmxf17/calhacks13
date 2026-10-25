type Volume = { at: [number, number, number]; size: [number, number, number] }
const signBottom = 2.16 - .57 / 2, postBottom = 1.13 - 1.83 / 2

export const signBandVolume = (width: number): Volume => ({ at: [0, 2.16, 1], size: [width - .07, .57, .22] })
export const groundPostVolume = (x: number): Volume => ({ at: [x, (postBottom + signBottom) / 2, .94], size: [.13, signBottom - postBottom, .16] })

// Extrusion starts at local z=0, rather than being centered like BoxGeometry.
export const facadeDepth = { back: .42, front: 1.02 }
const rearWallDepth = { back: -1.035, front: -.905 }

/** Adjacent depth ranges give each exterior side surface exactly one owner. */
export function shellVolumes(width: number, top: number): { body: Volume; rear: Volume } {
  return {
    body: {
      at: [0, (.04 + top) / 2, (rearWallDepth.front + facadeDepth.back) / 2],
      size: [width, top - .04, facadeDepth.back - rearWallDepth.front],
    },
    rear: {
      at: [0, (top + .04) / 2, (rearWallDepth.back + rearWallDepth.front) / 2],
      size: [width + .05, top + .04, rearWallDepth.front - rearWallDepth.back],
    },
  }
}

/** Stop the corner pipe at trim bands instead of passing through their edges. */
export const cornerPipeSegments = (topRow: number) => [
  { bottom: .22, top: 2.45 },
  { bottom: 2.57, top: topRow + 1.23 },
]
