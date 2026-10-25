import { useEffect, useMemo } from 'react'
import { MeshStandardMaterial } from 'three'
import { createFacadeGeometry } from '../facade-geometry'
import type { BuildingLayout, Vec3 } from '../layout'
import { Box, Sign, material, useTheme } from '../parts'
import type { ArchetypeProps } from '.'

/** Measurements every building type shares: the room grid's frame and the ground-floor bays. */
export function frame(layout: BuildingLayout) {
  const { rowY, colX, facadeWidth: width } = layout
  const yTop = rowY[0], y0 = rowY[rowY.length - 1], half = width / 2
  const mids = colX.slice(1).map((x, i) => (x + colX[i]) / 2)
  const posts = [-(half - .1), ...mids, half - .1]
  return {
    width, half, yTop, y0, mids,
    shellTop: yTop + 1.44,
    pierY: (y0 - 1.33 + yTop + 1.32) / 2, pierHeight: yTop - y0 + 2.65,
    beams: [y0 - 1.1, ...rowY.slice(1).map((y, i) => (y + rowY[i]) / 2 - .005), yTop + 1.17],
    posts,
    /** Ground-floor openings between the posts, left to right. */
    bays: posts.slice(1).map((x, i) => ({ x: (x + posts[i]) / 2, width: x - posts[i] - .2 })),
  }
}

const glass = new MeshStandardMaterial({ color: '#53bdd4', transparent: true, depthWrite: false, opacity: .34, roughness: .22, metalness: .1 })

/** One continuous facade: intersecting column/beam cubes leave competing depth and shadow edges. */
export function Facade({ layout }: { layout: BuildingLayout }) {
  const theme = useTheme()
  const { geometry, centerY } = useMemo(() => createFacadeGeometry({ ...frame(layout), roofBase: layout.rowY[0] + 1.36 }), [layout])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh position={[0, centerY, .42]} geometry={geometry} material={material(theme.body)} castShadow receiveShadow/>
}

export function GlassPane({ at, width, height }: { at: Vec3; width: number; height: number }) {
  return <mesh position={at} scale={[width, height, 1]} material={glass}><planeGeometry/></mesh>
}

/** The rear shell, the back wall and the trim bands at the ground floor and sign line. */
export function Shell({ layout }: { layout: BuildingLayout }) {
  const theme = useTheme(), f = frame(layout)
  return <>
    <Box at={[0, (.04 + f.shellTop) / 2, -.4]} size={[f.width, f.shellTop - .04, 1.3]}/>
    <Box at={[0, (f.shellTop + .04) / 2, -.97]} size={[f.width + .05, f.shellTop + .04, .13]} color={theme.wall}/>
    {[.16, 2.51].map(y => <Box key={y} at={[0, y, .12]} size={[f.width + .05, .12, 2.18]} color={theme.trim}/>)}
  </>
}

/** The company sign on its band above the ground floor. */
export function SignBand({ layout, company, sign, width }: ArchetypeProps & { width?: number }) {
  const f = frame(layout)
  return <>
    <Box at={[0, 2.16, 1]} size={[f.width - .07, .57, .22]}/>
    <Sign text={company} tagline={sign.tagline} background={sign.background} color={sign.color} at={[0, 2.16, 1.125]} width={width ?? f.width - .5}/>
  </>
}

/** A glass entrance door with steps; the frame takes the design's accent color. */
export function Entrance({ x }: { x: number }) {
  const theme = useTheme()
  return <>
    <Box at={[x, 1.06, 1]} size={[1.15, 1.8, .07]} color={theme.accent}/>
    <Box at={[x, 1.15, 1.05]} size={[.93, 1.4, .035]} color="#59cee2"/>
    <Box at={[x + .3, .97, 1.11]} size={[.035, .24, .04]} color={theme.gold}/>
    <Box at={[x, .11, 1.15]} size={[1.5, .18, .7]}/><Box at={[x, .035, 1.36]} size={[1.8, .1, .85]}/>
  </>
}
