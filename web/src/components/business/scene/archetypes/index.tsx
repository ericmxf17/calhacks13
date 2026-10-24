import type { ComponentType } from 'react'
import type { Archetype, SceneSpec } from '@/lib/scene-spec'
import type { BuildingLayout } from '../layout'
import Cafe from './Cafe'
import Storefront from './Storefront'
import Studio from './Studio'
import Warehouse from './Warehouse'
import Workshop from './Workshop'

export type ArchetypeProps = { layout: BuildingLayout; company: string; sign: SceneSpec['sign'] }

const buildings: Partial<Record<Archetype, ComponentType<ArchetypeProps>>> = { storefront: Storefront, workshop: Workshop, studio: Studio, cafe: Cafe, warehouse: Warehouse }

/** The building type actually drawn: one that isn't built yet shows as the storefront. */
export const drawnArchetype = (archetype: Archetype): Archetype => buildings[archetype] ? archetype : 'storefront'

export default function Building(props: ArchetypeProps) {
  const Shell = buildings[props.layout.archetype] ?? Storefront
  return <Shell {...props}/>
}
