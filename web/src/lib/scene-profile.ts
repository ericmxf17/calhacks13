import type { BusinessInput } from './business-input'
import type { SceneSource } from './scene-spec'

/**
 * What Scene Designer reads about a company: names and descriptions only, no prices or units.
 * It must come out the same for the same details, because a saved request is matched by its inputs.
 */
export type SceneProfile = {
  company: string; website: string; offering: string; channels: string
  products: string[]; parts: string[]; suppliers: string[]; supplier_data: 'uploaded' | 'demo'
}

function site(value: string) {
  const text = value.trim()
  try { return new URL(text.includes('://') ? text : `https://${text}`).toString() } catch { return text }
}
const unique = (values: string[], max: number) => [...new Set(values.map(v => v.trim()).filter(Boolean))].slice(0, max)

export function sceneProfile(b: BusinessInput): SceneProfile {
  return {
    company: b.company.trim(), website: site(b.website), offering: b.offering.trim(), channels: b.channels.trim(),
    products: unique(b.products.map(p => p.name), 20), parts: unique(b.parts.map(p => p.part), 20),
    suppliers: unique(b.parts.map(p => p.supplier), 12), supplier_data: b.demo ? 'demo' : 'uploaded',
  }
}

/** The design checks and fallback need these details in the SceneSource shape. */
export function profileSource(p: SceneProfile): SceneSource {
  return {
    company: p.company, website: p.website, offering: p.offering, channels: p.channels, demo: p.supplier_data === 'demo',
    products: p.products.map(name => ({ name })),
    parts: [...p.parts.map(part => ({ part, supplier: '' })), ...p.suppliers.map(supplier => ({ part: '', supplier }))],
  }
}

/** A short key for a profile, used to remember its design in this browser. */
export function profileKey(b: BusinessInput) {
  const text = JSON.stringify(sceneProfile(b))
  // cyrb53: a small, fast string hash; collisions only cost a redesign.
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}
