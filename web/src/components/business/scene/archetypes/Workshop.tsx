import { Box, useTheme } from '../parts'
import type { ArchetypeProps } from '.'
import { Entrance, GlassPane, Shell, SignBand, frame } from './shared'

function LoadingBay({ x, width }: { x: number; width: number }) {
  const theme = useTheme(), door = width - .3
  return <>
    <Box at={[x, 1.02, .95]} size={[door + .2, 1.95, .1]} color={theme.dark}/>
    <Box at={[x, 1, 1.01]} size={[door, 1.75, .05]} color={theme.accent}/>
    {[.35, .6, .85, 1.1, 1.35, 1.6].map(y => <Box key={y} at={[x, y, 1.04]} size={[door, .03, .02]} color={theme.dark} cast={false}/>)}
    <Box at={[x, .2, 1.3]} size={[door + .3, .4, .6]} color="#c9c2b4"/>
    <Box at={[x, .41, 1.6]} size={[door + .3, .03, .02]} color="#ffd447" cast={false}/>
    {[-1, 1].map(side => <Box key={side} at={[x + side * door * .4, .26, 1.62]} size={[.18, .25, .06]} color="#2b2f36" cast={false}/>)}
  </>
}

function Showroom({ x, width }: { x: number; width: number }) {
  const theme = useTheme(), w = width - .2
  return <>
    <Box at={[x, 1.1, .39]} size={[w, 1.7, .2]} color="#ffe2b8"/>
    <Box at={[x, .32, .98]} size={[w + .05, .17, .18]} color={theme.dark}/>
    {[-.32, .32].map(dx => <group key={dx}>
      <Box at={[x + dx * w, .55, .75]} size={[.42, .3, .4]} color={theme.trim} cast={false}/>
      <Box at={[x + dx * w, .86, .75]} size={[.3, .32, .26]} color={theme.accent} cast={false}/>
    </group>)}
    <Box at={[x, .75, .7]} size={[.5, .7, .4]} color={theme.trim} cast={false}/>
    <Box at={[x, 1.28, .7]} size={[.36, .36, .3]} color="#ff8a72" cast={false}/>
    <GlassPane at={[x, 1.16, 1.025]} width={w} height={1.56}/>
  </>
}

// A maker's workshop: brick piers, a sawtooth roof with skylights, a loading bay and a showroom.
export default function Workshop(props: ArchetypeProps) {
  const { layout } = props
  const theme = useTheme(), f = frame(layout)
  const teeth = Math.max(3, Math.round(f.width / 1.6)), tooth = f.width / teeth, rise = .62
  const [first, ...rest] = f.bays, last = rest.pop()
  return <group>
    <Shell layout={layout}/>
    {/* The facade frame: slim outer piers, wide inner piers with steel ribs, and floor beams. */}
    {[-(f.half - .245), f.half - .245].map(x => <Box key={x} at={[x, f.pierY, .72]} size={[.5, f.pierHeight, .6]}/>)}
    {f.mids.map(x => <group key={x}>
      <Box at={[x, f.pierY, .72]} size={[1.75, f.pierHeight, .6]}/>
      {[-.5, 0, .5].map(dx => <Box key={dx} at={[x + dx, f.pierY, 1.04]} size={[.07, f.pierHeight - .2, .05]} color={theme.trim} cast={false}/>)}
    </group>)}
    {f.beams.map(y => <Box key={y} at={[0, y, .72]} size={[f.width - .05, .42, .6]}/>)}
    {/* Parapet, roof deck and a sawtooth of skylights along the back. */}
    <Box at={[0, f.yTop + 1.29, .12]} size={[f.width + .05, .12, 2.18]} color={theme.trim}/>
    <Box at={[0, f.yTop + 1.46, .02]} size={[f.width + .2, .2, 2.0]} color={theme.trim}/>
    <Box at={[0, f.yTop + 1.52, -.15]} size={[f.width, .1, 1.65]} color={theme.roof}/>
    {Array.from({ length: teeth }, (_, i) => {
      const x0 = -f.half + i * tooth
      return <group key={i}>
        <Box at={[x0 + tooth / 2, f.yTop + 1.57 + rise / 2, -.6]} size={[Math.hypot(tooth, rise), .08, .72]} rotation={[0, 0, Math.atan2(rise, tooth)]} color={theme.roof}/>
        <Box at={[x0 + tooth - .03, f.yTop + 1.57 + rise / 2, -.6]} size={[.05, rise, .68]} color="#8fd3e8" cast={false}/>
      </group>
    })}
    <Box at={[f.half + .03, f.shellTop / 2, .9]} size={[.09, f.shellTop, .09]} color={theme.dark}/>
    {/* Ground floor: loading bay on the left, showroom on the right, entrance between (or beside). */}
    <SignBand {...props}/>
    {f.posts.map(x => <Box key={x} at={[x, 1.13, .94]} size={[.13, 1.83, .16]} color={theme.dark}/>)}
    <LoadingBay x={first.x} width={first.width}/>
    {rest.map(bay => <Entrance key={bay.x} x={bay.x}/>)}
    {last && (rest.length ? <Showroom x={last.x} width={last.width}/> : <>
      <Entrance x={last.x - last.width / 4}/>
      <Showroom x={last.x + last.width * .3} width={last.width * .42}/>
    </>)}
  </group>
}
