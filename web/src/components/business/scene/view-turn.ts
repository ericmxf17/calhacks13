export type BusinessView = 'home' | 'agents' | 'council'

/** The camera and rooftop birds share the same turn convention. */
export const viewTurn = (view: BusinessView) => view === 'agents' ? -Math.PI / 2 : view === 'council' ? Math.PI / 2 : 0
