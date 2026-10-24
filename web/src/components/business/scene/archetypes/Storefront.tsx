import { Box, Plant, Sign, useTheme } from '../parts'
import type { ArchetypeProps } from '.'

/** The central door, balcony and railing between two room rows; drawn at the original height when y is 3.65. */
function Bay({ y }: { y: number }) {
  const { dark, trim } = useTheme()
  return <group position={[0, y - 3.65, 0]}>
    <Box at={[0, 4.37, 1.08]} size={[1.21, 2.8, .2]}/>
    <Box at={[0, 4.7, 1.2]} size={[.78, 1.55, .06]} color={dark}/>
    {[-.2, .2].map(x => <Box key={x} at={[x, 4.7, 1.24]} size={[.32, 1.4, .035]} color="#5bc9e8"/>)}
    <Box at={[0, 3.91, 1.4]} size={[1.45, .13, .76]} color={trim}/>
    <Box at={[0, 4.35, 1.76]} size={[1.45, .055, .045]} color={dark}/>
    <Box at={[0, 3.99, 1.76]} size={[1.45, .04, .045]} color={dark}/>
    {Array.from({ length: 9 }, (_, i) => <Box key={i} at={[-.65 + i * .163, 4.17, 1.76]} size={[.025, .4, .025]} color={dark}/>)}
  </group>
}

// The original Consul storefront: shop windows on the ground floor, two columns of rooms above.
export default function Storefront({ layout, company, sign }: ArchetypeProps) {
  const theme = useTheme()
  const { rowY } = layout
  const yTop = rowY[0], y0 = rowY[rowY.length - 1]
  const beams = [y0 - 1.1, ...rowY.slice(1).map((y, i) => (y + rowY[i]) / 2 - .005), yTop + 1.17]
  const studs = Math.floor((yTop - y0 + 1.8) / .35 + 1e-6) + 1
  return <group>
    {/* A solid rear shell, with an open facade around the recessed rooms. */}
    <Box at={[0, (.04 + yTop + 1.44) / 2, -.4]} size={[5.25, yTop + 1.4, 1.3]}/>
    <Box at={[0, (yTop + 1.48) / 2, -.97]} size={[5.3, yTop + 1.48, .13]} color={theme.wall}/>
    {[-2.38, 0, 2.38].map((x, i) => <Box key={x} at={[x, (y0 - 1.33 + yTop + 1.32) / 2, .72]} size={[i === 1 ? 1.75 : .5, yTop - y0 + 2.65, .6]}/>)}
    {beams.map(y => <Box key={y} at={[0, y, .72]} size={[5.2, .42, .6]}/>)}
    {[0.16, 2.51, yTop + 1.29, yTop + 1.42, yTop + 1.56].map((y, i) => <Box key={y} at={[0, y, .12]} size={[5.3 + (i > 2 ? .22 : 0), .12, 2.18 + (i > 2 ? .2 : 0)]} color={theme.trim}/>)}
    <Box at={[0, yTop + 1.53, -.15]} size={[5.2, .13, 1.65]} color={theme.roof}/>
    {/* Taller storefronts skip the studs' tiny shadows to keep the extra floor cheap to draw. */}
    {[-2.55, 2.55].map(x => <group key={x}>{Array.from({ length: studs }, (_, i) => <Box key={i} at={[x, y0 - .85 + i * .35, 1.04]} size={[.28, .28, .07]} color={theme.trim} cast={rowY.length <= 2}/>)}</group>)}
    {rowY.slice(1).map(y => <Bay key={y} y={y}/>)}
    <Box at={[0, 2.16, 1]} size={[5.18, .57, .22]}/>
    <Sign text={company} tagline={sign.tagline} background={sign.background} color={sign.color} at={[0, 2.16, 1.125]} width={4.75}/>
    {[-2.52, -.68, .68, 2.52].map(x => <Box key={x} at={[x, 1.13, .94]} size={[.13, 1.83, .16]} color={theme.dark}/>)}
    {[-1.6, 1.6].map(x => <group key={x}>
      <Box at={[x, 1.1, .39]} size={[1.65, 1.7, .2]} color="#ffd473"/>
      <Box at={[x, .32, .98]} size={[1.7, .17, .18]} color={theme.dark}/>
      <mesh position={[x, 1.16, 1.025]}><planeGeometry args={[1.64, 1.56]}/><meshStandardMaterial color="#53bdd4" transparent opacity={.34} roughness={.22} metalness={.1}/></mesh>
      {[-.43, .1, .5].map((s, i) => <group position={[x + s, .45, .76]} key={s}>
        <mesh position={[0, .62, 0]} castShadow><boxGeometry args={[.15, .15, .15]}/><meshStandardMaterial color="#ffd9ad"/></mesh>
        <mesh position={[0, .34, 0]} castShadow><boxGeometry args={[.28, .48, .22]}/><meshStandardMaterial color={['#ff6488', '#6d8aef', '#ffd447'][i]}/></mesh>
        <Box at={[0, -.02, 0]} size={[.025, .25, .025]} color={theme.gold}/>
      </group>)}
    </group>)}
    <Box at={[0, 1.06, 1]} size={[1.15, 1.8, .07]} color={theme.accent}/>
    <Box at={[0, 1.15, 1.05]} size={[.93, 1.4, .035]} color="#59cee2"/>
    <Box at={[.3, .97, 1.11]} size={[.035, .24, .04]} color={theme.gold}/>
    <Box at={[0, .11, 1.15]} size={[1.5, .18, .7]}/><Box at={[0, .035, 1.36]} size={[1.8, .1, .85]}/>
    <Plant x={-1.01} z={1.55} scale={.65}/><Plant x={1.02} z={1.55} scale={.65}/>
  </group>
}
