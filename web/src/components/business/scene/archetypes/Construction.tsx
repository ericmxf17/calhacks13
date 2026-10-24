import { Box, Sign, useTheme } from '../parts'

const concrete = '#cfcac0', slab = '#e2ddd2', steel = '#f2b134', wood = '#c98a55'

/** The building site shown while Scene Designer works: a concrete frame, scaffolding and a crane. */
export default function Construction({ company }: { company: string }) {
  const { dark, accent } = useTheme()
  const floors = [2.5, 4.55, 6.6]
  return <group>
    <Box at={[0, 2.4, -.5]} size={[4.4, 4.8, .9]} color={concrete}/>
    {floors.map(y => <Box key={y} at={[0, y, .1]} size={[5.0, .16, 1.9]} color={slab}/>)}
    {[-2.3, -.8, .8, 2.3].flatMap(x => [-.75, .85].map(z => <Box key={`${x}${z}`} at={[x, 3.3, z]} size={[.2, 6.6, .2]} color={concrete}/>))}
    {/* Scaffolding across the front. */}
    {[-2.6, -1.3, 0, 1.3, 2.6].map(x => <Box key={x} at={[x, 3.6, 1.35]} size={[.05, 7.2, .05]} color={steel} cast={false}/>)}
    {[1.2, 2.5, 3.8, 5.1, 6.4].map(y => <Box key={y} at={[0, y, 1.35]} size={[5.3, .05, .05]} color={steel} cast={false}/>)}
    {floors.map(y => <Box key={y} at={[0, y + .05, 1.35]} size={[5.3, .05, .4]} color={wood} cast={false}/>)}
    {/* A tower crane beside the building, holding a load over the roof. */}
    <Box at={[3.6, 4.8, -1.2]} size={[.4, 9.6, .4]} color={steel}/>
    <Box at={[3.6, 9.2, -1.2]} size={[.7, .6, .6]} color={dark}/>
    <Box at={[1.4, 9.75, -1.2]} size={[6.4, .25, .25]} color={steel}/>
    <Box at={[5.3, 9.75, -1.2]} size={[1.6, .25, .25]} color={steel}/>
    <Box at={[5.8, 9.45, -1.2]} size={[.6, .5, .5]} color={concrete}/>
    <Box at={[-.6, 8.55, -1.2]} size={[.03, 2.2, .03]} color={dark} cast={false}/>
    <Box at={[-.6, 7.3, -1.2]} size={[.8, .35, .5]} color={accent}/>
    {/* Site hoarding with the company name. */}
    <Box at={[0, .6, 2.05]} size={[5.6, 1.0, .08]} color={accent}/>
    <Sign text={company} tagline="Designing your building" background="#fffdf4" color="#243957" at={[0, .62, 2.1]} width={4.2} height={.62}/>
    {[-1.9, 2.1].map(x => <group key={x}>
      <Box at={[x, .3, 2.45]} size={[.22, .45, .22]} color="#ff7a45" cast={false}/>
      <Box at={[x, .36, 2.45]} size={[.24, .06, .24]} color="#ffffff" cast={false}/>
    </group>)}
  </group>
}
