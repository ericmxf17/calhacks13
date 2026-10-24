'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { demoCompanies } from '@/lib/demo-companies'
import { ARCHETYPES, KIND_DEFAULTS, ROOM_KINDS, defaultSceneSpec, validateSceneSpec, type Archetype } from '@/lib/scene-spec'
import { starterDepartments } from '@/lib/starter-rooms'
import type { DesignState } from './business/useSceneDesign'

const Scene = dynamic(() => import('./business/App'), { ssr: false })

/**
 * Development preview of one building type with a chosen number of rooms.
 * With `build` (seconds), the construction site shows first, as if Scene Designer were working,
 * then the building assembles. Infinity keeps the site up.
 */
export default function ScenePreview({ archetype, rooms, props, build }: { archetype: string; rooms: number; props?: string; build?: number }) {
  const [state, setState] = useState<DesignState>('designing')
  useEffect(() => {
    if (build === undefined || !Number.isFinite(build)) return
    const timer = window.setTimeout(() => setState(s => s === 'designing' ? 'agent' : s), build * 1000)
    return () => window.clearTimeout(timer)
  }, [build])
  const design = build === undefined ? undefined
    : { state, message: '', ready: false, chooseQuickDesign: () => setState('quick'), showDesign: () => {} }
  const business = demoCompanies[0].business
  const scene = useMemo(() => {
    const type: Archetype = (ARCHETYPES as readonly string[]).includes(archetype) ? archetype as Archetype : 'storefront'
    const spec = defaultSceneSpec(type)
    const used = new Set(spec.rooms.map(r => r.kind))
    for (const kind of ROOM_KINDS) {
      if (spec.rooms.length >= rooms) break
      if (used.has(kind) && kind !== 'custom') continue
      const base = KIND_DEFAULTS[kind]
      spec.rooms.push({ id: `${kind}-room`, kind, name: base.name, shortName: base.shortName, furniture: base.furniture, color: base.color, description: base.description, tracks: base.tracks })
    }
    spec.rooms = spec.rooms.slice(0, rooms)
    if (props !== undefined) {
      const [roof = '', ground = ''] = props.split(';')
      Object.assign(spec, { roofProps: roof.split(',').filter(Boolean), groundProps: ground.split(',').filter(Boolean) })
    }
    // Run the same checks an agent's design goes through.
    return validateSceneSpec({ ...spec, roof_props: spec.roofProps, ground_props: spec.groundProps, rooms: spec.rooms.map(r => ({ ...r, short_name: r.shortName })) }, business).spec
  }, [archetype, rooms, props, business])
  const departments = useMemo(() => starterDepartments(scene, business), [scene, business])
  return <Scene company={business.company} scene={scene} departments={departments} design={design}/>
}
