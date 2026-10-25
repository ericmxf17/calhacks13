import { Box, useTheme } from '../parts'
import type { ArchetypeProps } from '.'
import { GlassPane, Shell, SignBand, frame } from './shared'

// A modern studio: a slim frame, a full-height glass strip, a glass lobby with a canopy and a roof terrace.
export default function Studio(props: ArchetypeProps) {
  const { layout } = props
  const theme = useTheme(), f = frame(layout)
  const glassHeight = f.pierHeight, glassY = f.pierY
  const mullions = Math.round(glassHeight / .5)
  return <group>
    <Shell layout={layout}/>
    {[-(f.half - .245), f.half - .245].map(x => <group key={x}>
      <Box at={[x, f.pierY, .72]} size={[.5, f.pierHeight, .6]} color={theme.trim}/>
      <Box at={[x + Math.sign(x) * .2, f.pierY, 1.05]} size={[.08, f.pierHeight, .1]} color={theme.accent} cast={false}/>
    </group>)}
    {f.beams.map(y => <Box key={y} at={[0, y, .74]} size={[f.width - .05, .3, .6]} color={theme.trim}/>)}
    {/* The glass strip between the room columns. */}
    {f.mids.map(x => <group key={x}>
      <Box at={[x, glassY, .62]} size={[1.75, glassHeight, .4]} color="#7fc6e0"/>
      {Array.from({ length: mullions + 1 }, (_, i) => <Box key={i} at={[x, glassY - glassHeight / 2 + i * glassHeight / mullions, .84]} size={[1.75, .04, .05]} color={theme.trim} cast={false}/>)}
      <Box at={[x, glassY, .84]} size={[.04, glassHeight, .05]} color={theme.trim} cast={false}/>
    </group>)}
    {/* Roof slab with a glass terrace railing. */}
    <Box at={[0, f.yTop + 1.36, .02]} size={[f.width + .2, .3, 2.0]} color={theme.roof}/>
    <Box at={[0, f.yTop + 1.52, -.15]} size={[f.width, .04, 1.65]} color={theme.trim}/>
    <Box at={[0, f.yTop + 1.75, .95]} size={[f.width + .2, .4, .03]} color="#bfe6f2" cast={false}/>
    <Box at={[0, f.yTop + 1.96, .95]} size={[f.width + .2, .05, .06]} color={theme.trim} cast={false}/>
    {/* Glass lobby with a reception desk behind it, and a canopy over the door. */}
    <SignBand {...props} width={Math.min(3.6, f.width - .6)}/>
    <Box at={[0, 1.1, .4]} size={[f.width - .3, 1.8, .1]} color="#eef3f7"/>
    <Box at={[-f.half * .45, .55, .75]} size={[1.1, .45, .35]} color={theme.accent} cast={false}/>
    <Box at={[-f.half * .45, .8, .75]} size={[1.16, .05, .4]} color={theme.trim} cast={false}/>
    <Box at={[f.half * .55, .45, .7]} size={[.3, .3, .3]} color="#ee7758" cast={false}/>
    <Box at={[f.half * .55, .8, .7]} size={[.45, .45, .45]} color="#49b968" cast={false}/>
    {Array.from({ length: 7 }, (_, i) => -f.half + .15 + i * (f.width - .3) / 6).map(x => <Box key={x} at={[x, 1.1, 1]} size={[.07, 1.85, .08]} color={theme.dark}/>)}
    <GlassPane at={[0, 1.15, 1.02]} width={f.width - .3} height={1.75}/>
    <Box at={[0, 1.06, 1.06]} size={[1.0, 1.75, .05]} color={theme.trim}/>
    <Box at={[0, 1.08, 1.09]} size={[.8, 1.6, .03]} color="#59cee2"/>
    <Box at={[0, 1.86, 1.4]} size={[2.2, .1, .9]} color={theme.accent}/>
    <Box at={[0, .11, 1.25]} size={[1.6, .18, .6]}/>
  </group>
}
