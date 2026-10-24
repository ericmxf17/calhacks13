import type { Ground, GroundProp, RoofProp } from '@/lib/scene-spec'
import type { BuildingLayout, Vec3 } from './layout'
import { Box, Plant, material, useTheme } from './parts'

const groundColors: Record<Ground, { base: string; top: string; plaza: string; lines: string }> = {
  lawn: { base: '#529d58', top: '#8cda68', plaza: '#ffe5b2', lines: '#e3b97b' },
  plaza: { base: '#9d9688', top: '#d6cebe', plaza: '#f1e8d6', lines: '#cdbf9f' },
  gravel: { base: '#8a8579', top: '#b5ae9f', plaza: '#ddd4c3', lines: '#c2b79f' },
}

/** The ground the building stands on, the paved front, and the road. */
export function Lot({ layout, ground }: { layout: BuildingLayout; ground: Ground }) {
  const c = groundColors[ground], w = layout.lotWidth, plaza = w - 1.7, road = Math.max(12, w + 3.7)
  const lanes: number[] = [], paving: number[] = []
  for (let x = -road / 2 + 1; x <= road / 2 - 1 + 1e-9; x += 2) lanes.push(x)
  const n = Math.floor(plaza / 2 - 1.3 + 1e-9)
  for (let x = -n; x <= n; x++) paving.push(x)
  return <>
    <Box at={[0, -.16, 0]} size={[w, .3, 5.2]} color={c.base}/>
    <Box at={[0, .005, -.2]} size={[w, .08, 4.8]} color={c.top}/>
    <Box at={[0, .06, .3]} size={[plaza, .12, 3.7]} color={c.plaza}/>
    <Box at={[0, -.06, 3.1]} size={[road, .12, 1.3]} color="#718ba2"/>
    {lanes.map(x => <Box key={`lane-${x}`} at={[x, .01, 3.1]} size={[.75, .012, .07]} color="#fff6d9"/>)}
    {paving.map(x => <Box key={x} at={[x, .003, 1.9]} size={[.008, .003, .45]} color={c.lines}/>)}
  </>
}

// Ground props claim named spots around the building in the order the design lists them.
type Spot = 'sideLeft' | 'sideRight' | 'frontLeft' | 'frontRight' | 'road' | 'roadEdge'
const wants: Record<GroundProp, Spot[][]> = {
  planters: [['sideLeft', 'sideRight']],
  pallets: [['sideLeft'], ['sideRight']],
  bike_rack: [['frontLeft'], ['frontRight']],
  benches: [['frontRight'], ['frontLeft']],
  cafe_tables: [['frontLeft', 'frontRight'], ['frontLeft'], ['frontRight']],
  delivery_van: [['road']],
  street_lamps: [['roadEdge']],
}
function spots(layout: BuildingLayout): Record<Spot, Vec3> {
  const edge = layout.facadeWidth / 2
  return {
    sideLeft: [-(edge + .285), 0, 1.22], sideRight: [edge + .285, 0, 1.22],
    frontLeft: [-(edge - .9), 0, 1.95], frontRight: [edge - .9, 0, 1.95],
    road: [edge + .2, 0, 3.1], roadEdge: [0, 0, 2.3],
  }
}

const wood = '#c98a55', metal = '#9aa6b2', glow = '#fff3b8'

function Bike({ x, z, color }: { x: number; z: number; color: string }) {
  const { dark } = useTheme()
  return <group position={[x, .12, z]}>
    {[-.24, .24].map(dx => <mesh key={dx} position={[dx, .2, 0]} material={material(dark)} castShadow><torusGeometry args={[.17, .025, 6, 18]}/></mesh>)}
    <Box at={[0, .3, 0]} size={[.48, .04, .04]} color={color} cast={false}/>
    <Box at={[-.06, .42, 0]} size={[.04, .26, .04]} color={color} cast={false}/>
    <Box at={[.2, .46, 0]} size={[.04, .3, .04]} color={dark} cast={false}/>
  </group>
}

function Prop({ type, at, edge }: { type: GroundProp; at: Vec3; edge: number }) {
  const theme = useTheme()
  const [x, , z] = at
  switch (type) {
    case 'planters': return <Plant x={x} z={z} scale={1.25}/>
    case 'pallets': return <group position={[x, .12, z - .1]}>
      <Box at={[0, .05, 0]} size={[.75, .1, .6]} color={wood}/>
      <Box at={[-.15, .3, 0]} size={[.36, .4, .5]} color="#d9a066"/>
      <Box at={[.2, .25, .05]} size={[.3, .3, .4]} color="#c48a52"/>
      <Box at={[-.1, .62, 0]} size={[.3, .24, .36]} color={theme.accent}/>
    </group>
    case 'bike_rack': return <group>
      <Box at={[x, .3, z - .18]} size={[.95, .05, .05]} color={metal}/>
      {[-.45, .45].map(dx => <Box key={dx} at={[x + dx, .22, z - .18]} size={[.05, .2, .05]} color={metal} cast={false}/>)}
      <Bike x={x - .2} z={z} color={theme.accent}/>
      <Bike x={x + .3} z={z + .1} color="#ff8a72"/>
    </group>
    case 'benches': return <group position={[x, .12, z]}>
      <Box at={[0, .22, 0]} size={[.9, .06, .28]} color={wood}/>
      <Box at={[0, .42, -.13]} size={[.9, .22, .05]} color={wood}/>
      {[-.38, .38].map(dx => <Box key={dx} at={[dx, .1, 0]} size={[.06, .2, .26]} color={theme.dark} cast={false}/>)}
    </group>
    case 'cafe_tables': return <group position={[x, .12, z]}>
      <Box at={[0, .32, 0]} size={[.42, .04, .42]} color={theme.trim}/>
      <Box at={[0, .16, 0]} size={[.05, .3, .05]} color={theme.dark} cast={false}/>
      {[-.33, .33].map(dx => <Box key={dx} at={[dx, .14, 0]} size={[.18, .26, .18]} color={theme.accent} cast={false}/>)}
      <Box at={[0, .75, 0]} size={[.03, .85, .03]} color={theme.dark} cast={false}/>
      <Box at={[0, 1.17, 0]} size={[.9, .06, .9]} color={theme.accent}/>
    </group>
    case 'delivery_van': return <group position={[x + .6, .02, z]}>
      <Box at={[-.15, .5, 0]} size={[1.25, .78, .78]} color="#f7f4ec"/>
      <Box at={[.68, .38, 0]} size={[.45, .54, .76]} color="#f7f4ec"/>
      <Box at={[.84, .5, 0]} size={[.08, .26, .66]} color="#8fd3e8" cast={false}/>
      <Box at={[-.15, .5, .395]} size={[1.0, .14, .01]} color={theme.accent} cast={false}/>
      {[-.55, .55].flatMap(dx => [-.36, .36].map(dz => <Box key={`${dx}${dz}`} at={[dx, .12, dz]} size={[.26, .26, .1]} color="#2b2f36" cast={false}/>))}
    </group>
    case 'street_lamps': return <>{[-(edge + 1.25), edge + 1.25].map(lx => <group key={lx} position={[lx, .12, z]}>
      <Box at={[0, .8, 0]} size={[.06, 1.6, .06]} color={theme.dark}/>
      <Box at={[0, 1.62, 0]} size={[.26, .1, .26]} color={theme.dark} cast={false}/>
      <Box at={[0, 1.54, 0]} size={[.2, .06, .2]} color={glow} cast={false}/>
    </group>)}</>
    default: return null
  }
}

export function GroundProps({ layout, props }: { layout: BuildingLayout; props: GroundProp[] }) {
  const at = spots(layout), taken = new Set<Spot>(), placed: { type: GroundProp; spot: Spot }[] = []
  for (const type of props) {
    const choice = wants[type].find(option => option.every(spot => !taken.has(spot)))
    if (!choice) continue
    for (const spot of choice) { taken.add(spot); placed.push({ type, spot }) }
  }
  return <>{placed.map(({ type, spot }) => <Prop key={`${type}-${spot}`} type={type} at={at[spot]} edge={layout.facadeWidth / 2}/>)}</>
}

function RoofItem({ type, at }: { type: RoofProp; at: Vec3 }) {
  const theme = useTheme()
  switch (type) {
    case 'solar_panels': return <group position={at}>
      {[-.6, .6].map(dx => <group key={dx}>
        <Box at={[dx, .12, 0]} size={[.08, .24, .08]} color={metal} cast={false}/>
        <Box at={[dx, .3, 0]} size={[1.05, .05, .7]} rotation={[-.4, 0, 0]} color="#2d4f8a"/>
        <Box at={[dx, .33, -.01]} size={[1.0, .01, .02]} rotation={[-.4, 0, 0]} color="#7fa4d9" cast={false}/>
      </group>)}
    </group>
    case 'water_tower': return <group position={at}>
      {[-.25, .25].flatMap(dx => [-.2, .2].map(dz => <Box key={`${dx}${dz}`} at={[dx, .25, dz]} size={[.06, .5, .06]} color={theme.dark} cast={false}/>))}
      <Box at={[0, .85, 0]} size={[.7, .7, .6]} color="#9c663d"/>
      <Box at={[0, 1.27, 0]} size={[.5, .14, .44]} color="#7d5132"/>
    </group>
    case 'rooftop_garden': return <group position={at}>
      <Box at={[0, .12, 0]} size={[1.5, .24, .55]} color={wood}/>
      {[-.5, 0, .5].map((dx, i) => <Box key={dx} at={[dx, .38 + (i % 2) * .08, 0]} size={[.4, .3 + (i % 2) * .16, .4]} color={i % 2 ? '#88d65f' : '#49b968'}/>)}
    </group>
    case 'vents': return <group position={at}>
      {[-.35, .35].map(dx => <group key={dx}>
        <Box at={[dx, .2, 0]} size={[.32, .4, .32]} color={metal}/>
        <Box at={[dx, .44, 0]} size={[.42, .06, .42]} color="#c7d0d9" cast={false}/>
      </group>)}
    </group>
    case 'antenna': return <group position={at}>
      <Box at={[0, .75, 0]} size={[.05, 1.5, .05]} color={metal}/>
      {[.7, 1.05].map(y => <Box key={y} at={[0, y, 0]} size={[.5, .03, .03]} color={metal} cast={false}/>)}
      <Box at={[0, 1.52, 0]} size={[.08, .08, .08]} color="#ff5a4e" cast={false}/>
    </group>
    case 'chimney': return <group position={at}>
      <Box at={[0, .6, 0]} size={[.45, 1.2, .45]} color="#b5533c"/>
      <Box at={[0, 1.24, 0]} size={[.55, .08, .55]} color={theme.trim} cast={false}/>
    </group>
    default: return null
  }
}

/** Roof props stand on the roof deck, spread left, center and right in the order the design lists them. */
export function RoofProps({ layout, props }: { layout: BuildingLayout; props: RoofProp[] }) {
  const third = layout.facadeWidth / 3, order = [0, -third, third]
  const spots = props.length === 2 ? [-third * .75, third * .75] : order
  // The café's stepped roof is taller and narrower at the top than the flat roofs.
  const [y, z] = layout.archetype === 'cafe' ? [layout.top + .56, -.3] : [layout.top + .02, .15]
  return <>{props.slice(0, 3).map((type, i) => <RoofItem key={type} type={type} at={[spots[i], y, z]}/>)}</>
}
