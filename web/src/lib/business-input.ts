export type BusinessInput = {
  company: string
  website: string
  offering: string
  channels: string
  demo: boolean
  products: { name: string; price: number; units: number }[]
  parts: { supplier: string; part: string; cost: number }[]
}

function text(value: unknown, max: number) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new Error('Please complete all fields with valid values.')
  return value.trim()
}
function amount(value: unknown, integer = false) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    (integer && !Number.isInteger(value))
  )
    throw new Error('Prices must be positive numbers and units must be whole numbers.')
  return value
}
export function validateBusiness(raw: unknown): BusinessInput {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid business details.')
  const b = raw as Record<string, unknown>
  const website = text(b.website, 300)
  const url = new URL(website.includes('://') ? website : `https://${website}`)
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.'))
    throw new Error('Please enter a valid website.')
  if (!Array.isArray(b.products) || !b.products.length || b.products.length > 50)
    throw new Error('Add between 1 and 50 products.')
  if (!Array.isArray(b.parts) || b.parts.length > 1000 || (!b.demo && !b.parts.length))
    throw new Error('Upload a supplier spreadsheet or choose demo data.')
  return {
    company: text(b.company, 120),
    website: url.toString(),
    offering: text(b.offering, 500),
    channels: text(b.channels, 500),
    demo: b.demo === true,
    products: b.products.map((p) => ({
      name: text(p.name, 120),
      price: amount(p.price),
      units: amount(p.units, true),
    })),
    parts: b.parts.map((p) => ({
      supplier: text(p.supplier, 200),
      part: text(p.part, 200),
      cost: amount(p.cost),
    })),
  }
}
