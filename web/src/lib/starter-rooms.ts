import type { BusinessInput } from './business-input'
import type { RoomKind, SceneRoom, SceneSpec } from './scene-spec'
import { departments as illustrative, type Department } from '@/components/business/departments'

// Room content for a company's own building. Every number here is calculated from the
// setup details (products and supplier parts), never written by the design agent.

const usd = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e8 ? 0 : 2)}M` : n >= 1e4 ? `$${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}k` : `$${n.toLocaleString('en-US', { maximumFractionDigits: n < 100 ? 2 : 0 })}`
const count = (n: number) => Math.round(n).toLocaleString('en-US')
const plural = (n: number, word: string) => `${count(n)} ${word}${n === 1 ? '' : 's'}`
const short = (label: string) => label.length > 13 ? `${label.slice(0, 12).trimEnd()}…` : label
const initial = (text: string) => text.trim().charAt(0).toUpperCase() || '•'

/** Top six by value, with the rest summed into "Other", for a chart. */
function chart(items: { label: string; value: number }[], round: (n: number) => number) {
  const sorted = [...items].sort((a, b) => b.value - a.value)
  const shown = sorted.length > 6 ? [...sorted.slice(0, 5), { label: 'Other', value: sorted.slice(5).reduce((s, i) => s + i.value, 0) }] : sorted
  return { chartLabels: shown.map(i => short(i.label)), chartValues: shown.map(i => round(i.value)) }
}
const thousands = (n: number) => Math.round(n / 100) / 10
const millions = (n: number) => Math.round(n / 1e5) / 10

type Content = Pick<Department, 'metrics' | 'chartTitle' | 'chartNote' | 'chartLabels' | 'chartValues' | 'unit' | 'listTitle' | 'rows' | 'period'>

function fromSetup(kind: RoomKind, b: BusinessInput): Content | null {
  // Chart labels drop a leading company name ("VoltRide City e-bike" becomes "City e-bike").
  const label = (name: string) => name.toLowerCase().startsWith(`${b.company.toLowerCase()} `) ? name.slice(b.company.length + 1) : name
  const products = b.products.map(p => ({ ...p, label: label(p.name), revenue: p.price * p.units }))
  const revenue = products.reduce((s, p) => s + p.revenue, 0), units = products.reduce((s, p) => s + p.units, 0)
  const byRevenue = [...products].sort((a, z) => z.revenue - a.revenue), byUnits = [...products].sort((a, z) => z.units - a.units)
  const period = 'Annual estimate · from your setup'
  if (!products.length) return null
  switch (kind) {
    case 'finance': return {
      period,
      metrics: [
        { label: 'Revenue estimate', value: usd(revenue), change: 'Price × annual units, all products' },
        { label: 'Products', value: count(products.length), change: 'Listed in your setup' },
        { label: 'Best seller', value: revenue ? `${Math.round(byRevenue[0].revenue / revenue * 100)}%` : '—', change: `${byRevenue[0].name} · share of revenue` },
      ],
      // Large companies chart in millions so the bar labels stay short.
      chartTitle: 'Where revenue comes from', unit: revenue >= 1e6 ? 'M' : 'k',
      chartNote: `ESTIMATED ANNUAL REVENUE · $ ${revenue >= 1e6 ? 'MILLIONS' : 'THOUSANDS'}`,
      ...chart(products.map(p => ({ label: p.label, value: p.revenue })), revenue >= 1e6 ? millions : thousands),
      listTitle: 'Your products', rows: byRevenue.slice(0, 8).map(p => ({ initial: initial(p.name), title: p.name, subtitle: `${count(p.units)} units × ${usd(p.price)}`, value: usd(p.revenue) })),
    }
    case 'sales': {
      const channels = b.channels.split(/,|;|\/|\band\b/i).map(c => c.trim()).filter(Boolean).slice(0, 8)
      return {
        period,
        metrics: [
          { label: 'Units a year', value: count(units), change: plural(products.length, 'product') },
          { label: 'Average price', value: units ? usd(revenue / units) : '—', change: 'Revenue estimate / annual units' },
          { label: 'Sales channels', value: count(channels.length), change: 'From your setup' },
        ],
        chartTitle: 'Units by product', chartNote: 'ESTIMATED ANNUAL UNITS', unit: '', ...chart(products.map(p => ({ label: p.label, value: p.units })), Math.round),
        listTitle: 'Where you sell', rows: channels.map(c => ({ initial: initial(c), title: c, subtitle: 'Sales channel', value: 'Not connected yet' })),
      }
    }
    case 'product': return {
      period,
      metrics: [
        { label: 'Products', value: count(products.length), change: 'Listed in your setup' },
        { label: 'Highest price', value: usd(Math.max(...products.map(p => p.price))), change: [...products].sort((a, z) => z.price - a.price)[0].name },
        { label: 'Most units', value: count(byUnits[0].units), change: byUnits[0].name },
      ],
      chartTitle: 'Price by product', chartNote: 'PRICE PER UNIT · $', unit: '', ...chart(products.map(p => ({ label: p.label, value: p.price })), Math.round),
      listTitle: 'Your products', rows: products.slice(0, 8).map(p => ({ initial: initial(p.name), title: p.name, subtitle: `${count(p.units)} units a year`, value: usd(p.price) })),
    }
    case 'operations': return {
      period: 'Monthly average · from your setup',
      metrics: [
        { label: 'Monthly output', value: count(units / 12), change: 'Units a month, all products' },
        { label: 'Busiest line', value: count(byUnits[0].units / 12), change: `${byUnits[0].name} · units a month` },
        { label: 'Product lines', value: count(products.length), change: 'In production' },
      ],
      chartTitle: 'Monthly output by product', chartNote: 'UNITS PER MONTH', unit: '', ...chart(products.map(p => ({ label: p.label, value: p.units / 12 })), Math.round),
    }
    case 'supply': {
      if (!b.parts.length) return null
      const suppliers = new Map<string, number>()
      for (const p of b.parts) suppliers.set(p.supplier, (suppliers.get(p.supplier) ?? 0) + 1)
      const priciest = [...b.parts].sort((a, z) => z.cost - a.cost)
      return {
        period: 'From your supplier upload',
        metrics: [
          { label: 'Suppliers', value: count(suppliers.size), change: 'In your upload' },
          { label: 'Parts tracked', value: count(b.parts.length), change: plural(suppliers.size, 'supplier') },
          { label: 'Priciest part', value: usd(priciest[0].cost), change: `${priciest[0].part} · ${priciest[0].supplier}` },
        ],
        chartTitle: 'Parts per supplier', chartNote: 'PARTS TRACKED', unit: '', ...chart([...suppliers].map(([label, value]) => ({ label, value })), Math.round),
        listTitle: 'Your most expensive parts', rows: priciest.slice(0, 8).map(p => ({ initial: initial(p.supplier), title: p.part, subtitle: p.supplier, value: `${usd(p.cost)} each` })),
      }
    }
    default: return null
  }
}

// Sample content shown when the owner chose demo data and a room has nothing from setup yet.
const samples: Partial<Record<RoomKind, Department>> = {
  finance: illustrative.find(d => d.id === 'finance'), people: illustrative.find(d => d.id === 'hiring'),
  supply: illustrative.find(d => d.id === 'supply'), marketing: illustrative.find(d => d.id === 'marketing'),
}

function room(r: SceneRoom, b: BusinessInput): Department {
  const base = { id: r.id, name: r.name, shortName: r.shortName, description: r.description, color: r.color, kind: r.kind,
    furniture: r.furniture, tracks: r.tracks, floor: '', number: '', position: [0, 0, 0] as [number, number, number] }
  const setup = fromSetup(r.kind, b)
  if (setup) return { ...base, ...setup, source: 'setup' }
  const sample = b.demo ? samples[r.kind] : undefined
  if (sample) {
    const { metrics, chartTitle, chartNote, chartLabels, chartValues, unit, listTitle, rows } = sample
    return { ...base, metrics, chartTitle, chartNote, chartLabels, chartValues, unit, listTitle, rows, source: 'illustrative' }
  }
  return { ...base, metrics: [], source: 'placeholder' }
}

/**
 * The rooms for a building design, in the design's order. A room a demo company already has
 * (matched by id) keeps its detailed content; any other room is filled from the setup details.
 */
export function starterDepartments(spec: SceneSpec, business: BusinessInput, preset: Department[] = []): Department[] {
  return spec.rooms.map(r => {
    const known = preset.find(d => d.id === r.id)
    return known ? { ...known, furniture: r.furniture } : room(r, business)
  })
}
