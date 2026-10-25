type Volume = { at: [number, number, number]; size: [number, number, number] }

export const groundShadowY = -.33

/** Adjacent layers avoid competing vertical faces along the pavement edges. */
export function lotVolumes(width: number): Record<'base' | 'surface' | 'plaza' | 'road', Volume> {
  const surfaceBottom = .005 - .08 / 2, baseBottom = -.31
  const curbFront = 2.6, roadFront = 3.75
  return {
    base: { at: [0, (baseBottom + surfaceBottom) / 2, 0], size: [width, surfaceBottom - baseBottom, 5.2] },
    surface: { at: [0, .005, -.2], size: [width, .08, 4.8] },
    plaza: { at: [0, .06, .3], size: [width - 1.7, .12, 3.7] },
    road: { at: [0, -.06, (curbFront + roadFront) / 2], size: [Math.max(12, width + 3.7), .12, roadFront - curbFront] },
  }
}
