import { Box, useTheme } from '../parts'
import type { ArchetypeProps } from '.'
import { GroundFloorPosts, Shell, SignBand, frame } from './shared'

function Dock({ x, width }: { x: number; width: number }) {
  const theme = useTheme(), door = Math.min(1.9, width - .5)
  return <>
    <Box at={[x, 1.0, .95]} size={[door + .16, 1.9, .1]} color={theme.dark}/>
    <Box at={[x, .98, 1.01]} size={[door, 1.7, .05]} color={theme.accent}/>
    {[.4, .7, 1.0, 1.3, 1.6].map(y => <Box key={y} at={[x, y, 1.04]} size={[door, .03, .02]} color={theme.dark} cast={false}/>)}
    <Box at={[x, .24, 1.32]} size={[door + .4, .48, .64]} color="#b9b3a7"/>
    {[-1, 1].map(side => <Box key={side} at={[x + side * door * .42, .3, 1.66]} size={[.16, .3, .06]} color="#2b2f36" cast={false}/>)}
    {[-1, 1].map(side => <Box key={side} at={[x + side * (door / 2 + .35), .45, 1.85]} size={[.1, .7, .1]} color="#ffd447"/>)}
  </>
}

// A distribution warehouse: steel columns, ribbed walls, a row of loading docks and a small office door.
export default function Warehouse(props: ArchetypeProps) {
  const { layout } = props
  const theme = useTheme(), f = frame(layout)
  const office = f.bays[f.bays.length - 1]
  return <group>
    <Shell layout={layout}/>
    {[-(f.half - .2), ...f.mids, f.half - .2].map(x => <Box key={x} at={[x, f.pierY, .72]} size={[x === f.half - .2 || x === -(f.half - .2) ? .4 : 1.75, f.pierHeight, .6]}/>)}
    {f.mids.map(x => <Box key={x} at={[x, f.pierY, 1.03]} size={[.16, f.pierHeight, .06]} color={theme.dark} cast={false}/>)}
    {f.beams.map(y => <group key={y}>
      <Box at={[0, y, .74]} size={[f.width - .05, .42, .6]}/>
      {[-.1, .1].map(dy => <Box key={dy} at={[0, y + dy, 1.03]} size={[f.width - .05, .025, .02]} color={theme.trim} cast={false}/>)}
    </group>)}
    {/* A low parapet and flat roof. */}
    <Box at={[0, f.yTop + 1.29, .12]} size={[f.width + .05, .12, 2.18]} color={theme.trim}/>
    <Box at={[0, f.yTop + 1.44, .02]} size={[f.width + .15, .18, 2.0]} color={theme.roof}/>
    {/* Loading docks in every bay but the last, which holds the office entrance. */}
    <SignBand {...props}/>
    <GroundFloorPosts layout={layout}/>
    {f.bays.slice(0, -1).map(bay => <Dock key={bay.x} x={bay.x} width={bay.width}/>)}
    <Box at={[office.x, 1.1, .39]} size={[office.width - .2, 1.7, .2]} color="#eef1f4"/>
    <Box at={[office.x - office.width * .2, 1.0, .98]} size={[.9, 1.75, .07]} color={theme.dark}/>
    <Box at={[office.x - office.width * .2, 1.05, 1.03]} size={[.72, 1.45, .035]} color="#59cee2"/>
    <Box at={[office.x + office.width * .25, 1.2, .98]} size={[.8, .7, .05]} color="#8fd3e8"/>
    <Box at={[office.x - office.width * .2, 1.98, 1.3]} size={[1.3, .08, .7]} color={theme.accent}/>
    <Box at={[office.x - office.width * .2, .08, 1.25]} size={[1.2, .16, .5]}/>
  </group>
}
