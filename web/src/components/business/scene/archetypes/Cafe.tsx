import { Box, useTheme } from '../parts'
import type { ArchetypeProps } from '.'
import { Entrance, GlassPane, Shell, SignBand, frame } from './shared'

function CafeWindow({ x, width }: { x: number; width: number }) {
  const theme = useTheme(), w = width - .2
  return <>
    <Box at={[x, 1.1, .39]} size={[w, 1.7, .2]} color="#ffe9c7"/>
    <Box at={[x, .32, .98]} size={[w + .05, .17, .18]} color={theme.dark}/>
    <Box at={[x, .62, .72]} size={[w * .8, .42, .32]} color="#c98a55" cast={false}/>
    <Box at={[x, .85, .72]} size={[w * .82, .05, .36]} color={theme.trim} cast={false}/>
    <Box at={[x - w * .22, 1.02, .68]} size={[.26, .3, .22]} color={theme.dark} cast={false}/>
    <Box at={[x + w * .18, .98, .74]} size={[.5, .22, .26]} color="#bfe6f2" cast={false}/>
    {[-.3, .3].map(dx => <Box key={dx} at={[x + dx * w, 1.6, .7]} size={[.14, .1, .14]} color="#fff3b8" cast={false}/>)}
    <GlassPane at={[x, 1.16, 1.025]} width={w} height={1.56}/>
  </>
}

// A neighborhood café: flower boxes under the windows, a striped awning, and a stepped roof.
export default function Cafe(props: ArchetypeProps) {
  const { layout } = props
  const theme = useTheme(), f = frame(layout)
  const stripes = Math.max(8, Math.round((f.width - .2) / .42)), stripe = (f.width - .2) / stripes
  const [first, ...rest] = f.bays, last = rest.pop()
  return <group>
    <Shell layout={layout}/>
    {[-(f.half - .245), f.half - .245].map(x => <Box key={x} at={[x, f.pierY, .72]} size={[.5, f.pierHeight, .6]}/>)}
    {f.mids.map(x => <Box key={x} at={[x, f.pierY, .72]} size={[1.75, f.pierHeight, .6]}/>)}
    {f.beams.map(y => <Box key={y} at={[0, y, .74]} size={[f.width - .05, .42, .6]} color={theme.trim}/>)}
    {/* Flower boxes under every window in the room grid. */}
    {[...layout.cells.map(c => c.position), ...layout.blanks].map(([x, y]) => <group key={`${x},${y}`}>
      <Box at={[x, y - .98, 1.16]} size={[1.1, .14, .26]} color="#a8643e"/>
      {[-.35, 0, .35].map((dx, i) => <Box key={dx} at={[x + dx, y - .86, 1.16]} size={[.26, .12, .2]} color={['#ff6488', '#ffd447', '#49b968'][i]} cast={false}/>)}
    </group>)}
    {/* A stepped roof that narrows toward its ridge. */}
    {[0, 1, 2, 3].map(i => <Box key={i} at={[0, f.yTop + 1.38 + i * .18, .02 - i * .12]} size={[f.width + .3 - i * .1, .18, 2.1 - i * .42]} color={theme.roof}/>)}
    {/* Ground floor: café windows, a door, the awning and a chalkboard. */}
    <SignBand {...props}/>
    {f.posts.map(x => <Box key={x} at={[x, 1.13, .94]} size={[.13, 1.83, .16]} color={theme.dark}/>)}
    <CafeWindow x={first.x} width={first.width}/>
    {rest.map(bay => <Entrance key={bay.x} x={bay.x}/>)}
    {last && (rest.length ? <CafeWindow x={last.x} width={last.width}/> : <>
      <Entrance x={last.x - last.width / 4}/>
      <CafeWindow x={last.x + last.width * .3} width={last.width * .42}/>
    </>)}
    {Array.from({ length: stripes }, (_, i) => <Box key={i} at={[-f.half + .1 + stripe * (i + .5), 1.8, 1.4]} size={[stripe, .06, .9]} rotation={[.32, 0, 0]} color={i % 2 ? '#fffaf0' : theme.accent}/>)}
    <Box at={[f.posts[1] + .55, .35, 1.75]} size={[.36, .5, .06]} rotation={[-.2, 0, 0]} color="#2f3a33" cast={false}/>
  </group>
}
