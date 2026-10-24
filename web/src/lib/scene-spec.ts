// The building design Scene Designer (a CREAO agent) writes for each company.
// The agent only picks from fixed lists. Code builds the 3D scene and calculates every number.
// Keep these lists in sync with agents/scene-spec-schema.json and tests/check_scene_spec.py.

export const ARCHETYPES = ['storefront', 'workshop', 'cafe', 'studio', 'warehouse'] as const
export const GROUNDS = ['lawn', 'plaza', 'gravel'] as const
export const ROOF_PROPS = ['solar_panels', 'water_tower', 'rooftop_garden', 'vents', 'antenna', 'chimney'] as const
export const GROUND_PROPS = ['planters', 'benches', 'bike_rack', 'delivery_van', 'pallets', 'cafe_tables', 'street_lamps'] as const
export const ROOM_KINDS = ['finance', 'sales', 'marketing', 'supply', 'product', 'operations', 'people', 'custom'] as const
export const FURNITURE = ['desk', 'shelves', 'workbench', 'counter', 'meeting_table', 'drafting_table', 'lounge', 'crates'] as const
export const MIN_ROOMS = 3
export const MAX_ROOMS = 6

export type Archetype = (typeof ARCHETYPES)[number]
export type Ground = (typeof GROUNDS)[number]
export type RoofProp = (typeof ROOF_PROPS)[number]
export type GroundProp = (typeof GROUND_PROPS)[number]
export type RoomKind = (typeof ROOM_KINDS)[number]
export type Furniture = (typeof FURNITURE)[number]

export type ScenePalette = { body: string; trim: string; accent: string; roof: string }
export type SceneRoom = {
  id: string; name: string; shortName: string; kind: RoomKind; furniture: Furniture
  color: string; description: string; tracks: string[]
}
export type SceneSpec = {
  version: 1
  archetype: Archetype
  palette: ScenePalette
  sign: { background: string; color: string; tagline: string }
  ground: Ground
  roofProps: RoofProp[]
  groundProps: GroundProp[]
  rooms: SceneRoom[]
  reasoning: string
}
/** The company details a design is checked against and built from (a subset of BusinessInput). */
export type SceneSource = {
  company: string; website?: string; offering: string; channels: string; demo?: boolean
  products: { name: string }[]; parts: { supplier: string; part: string }[]
}
export type SceneCheck = { spec: SceneSpec; repairs: string[]; fallback: boolean }

type RoomDefaults = { name: string; shortName: string; furniture: Furniture; color: string; description: string; tracks: string[] }
export const KIND_DEFAULTS: Record<RoomKind, RoomDefaults> = {
  finance: { name: 'Finance', shortName: 'Finance', furniture: 'desk', color: '#ffd447', description: 'Where the money coming in and going out adds up.', tracks: ['Revenue by product', 'Costs', 'Cash on hand'] },
  sales: { name: 'Sales', shortName: 'Sales', furniture: 'counter', color: '#ff8a72', description: 'Who buys, through which channels, and how often.', tracks: ['Units sold', 'Sales by channel', 'Average price'] },
  marketing: { name: 'Marketing', shortName: 'Marketing', furniture: 'drafting_table', color: '#ff8a72', description: 'The campaigns and stories that bring new customers in.', tracks: ['Campaign spend', 'New customers', 'Return on ad spend'] },
  supply: { name: 'Supply chain', shortName: 'Supply', furniture: 'shelves', color: '#57d7ab', description: 'The suppliers and parts behind everything you sell.', tracks: ['Suppliers', 'Part costs', 'On-time deliveries'] },
  product: { name: 'Product', shortName: 'Product', furniture: 'workbench', color: '#58cde3', description: 'What you make and sell, and how each product is doing.', tracks: ['Products', 'Prices', 'Best sellers'] },
  operations: { name: 'Operations', shortName: 'Operations', furniture: 'crates', color: '#8fb3ff', description: 'The day-to-day work that turns orders into finished goods.', tracks: ['Monthly output', 'Capacity', 'Turnaround time'] },
  people: { name: 'People & hiring', shortName: 'People', furniture: 'meeting_table', color: '#b9a0ff', description: 'The team behind the business and the people joining next.', tracks: ['Team size', 'Open roles', 'Candidates'] },
  custom: { name: 'Workspace', shortName: 'Workspace', furniture: 'desk', color: '#9ad0ec', description: 'A space for the work that makes this business its own.', tracks: ['Key tasks', 'Progress', 'Next steps'] },
}

type DefaultRoom = { id: string; kind: RoomKind; name?: string; shortName?: string; furniture?: Furniture }
type ArchetypeDefaults = {
  label: string; palette: ScenePalette; sign: { background: string; color: string }; ground: Ground
  roofProps: RoofProp[]; groundProps: GroundProp[]; rooms: DefaultRoom[]
}
export const ARCHETYPE_DEFAULTS: Record<Archetype, ArchetypeDefaults> = {
  storefront: {
    label: 'shop', palette: { body: '#ffb16d', trim: '#fff4d4', accent: '#253b64', roof: '#eb7b55' },
    sign: { background: '#3475dc', color: '#ffffff' }, ground: 'lawn', roofProps: [], groundProps: ['planters'],
    // The original building: every room has the desk set.
    rooms: [{ id: 'finance', kind: 'finance', furniture: 'desk' }, { id: 'hiring', kind: 'people', shortName: 'Hiring', furniture: 'desk' }, { id: 'supply', kind: 'supply', furniture: 'desk' }, { id: 'marketing', kind: 'marketing', furniture: 'desk' }],
  },
  workshop: {
    label: 'maker', palette: { body: '#d98a52', trim: '#f4ead6', accent: '#2f5d8a', roof: '#56677d' },
    sign: { background: '#253b64', color: '#ffffff' }, ground: 'plaza', roofProps: ['solar_panels', 'vents'], groundProps: ['pallets', 'delivery_van'],
    rooms: [{ id: 'finance', kind: 'finance' }, { id: 'hiring', kind: 'people', shortName: 'Hiring' }, { id: 'supply', kind: 'supply', name: 'Parts & suppliers', shortName: 'Parts' }, { id: 'assembly', kind: 'operations', name: 'Assembly floor', shortName: 'Assembly' }, { id: 'sales', kind: 'sales', name: 'Sales & dealers', shortName: 'Sales' }],
  },
  cafe: {
    label: 'café or restaurant', palette: { body: '#f3c99b', trim: '#fff8ec', accent: '#2f8f6b', roof: '#8a5a44' },
    sign: { background: '#2f6b4f', color: '#ffffff' }, ground: 'plaza', roofProps: ['chimney'], groundProps: ['cafe_tables', 'planters'],
    rooms: [{ id: 'finance', kind: 'finance' }, { id: 'kitchen', kind: 'operations', name: 'Kitchen & service', shortName: 'Kitchen' }, { id: 'supply', kind: 'supply', name: 'Pantry & suppliers', shortName: 'Pantry' }, { id: 'team', kind: 'people', name: 'Team & shifts', shortName: 'Team' }],
  },
  studio: {
    label: 'service or software business', palette: { body: '#a9c8e6', trim: '#eaf2fa', accent: '#2b3f63', roof: '#3c4f6b' },
    sign: { background: '#14213d', color: '#ffffff' }, ground: 'lawn', roofProps: ['rooftop_garden', 'antenna'], groundProps: ['benches', 'street_lamps'],
    rooms: [{ id: 'finance', kind: 'finance' }, { id: 'hiring', kind: 'people', name: 'Team & hiring', shortName: 'Team' }, { id: 'projects', kind: 'operations', name: 'Projects & capacity', shortName: 'Projects' }, { id: 'sales', kind: 'sales', name: 'New business', shortName: 'New business' }],
  },
  warehouse: {
    label: 'distributor', palette: { body: '#c3cad2', trim: '#eef1f4', accent: '#e0832f', roof: '#55606e' },
    sign: { background: '#1f3b63', color: '#ffffff' }, ground: 'gravel', roofProps: ['vents'], groundProps: ['pallets', 'delivery_van'],
    rooms: [{ id: 'finance', kind: 'finance' }, { id: 'supply', kind: 'supply', name: 'Inbound & suppliers', shortName: 'Inbound' }, { id: 'fulfillment', kind: 'operations', name: 'Fulfillment', shortName: 'Fulfillment' }, { id: 'sales', kind: 'sales', name: 'Customers & orders', shortName: 'Orders' }, { id: 'hiring', kind: 'people', name: 'Crew & hiring', shortName: 'Crew' }],
  },
}

// Wider bounds than the agent is told to use, so the app only repairs colors that would look broken.
const LIGHTNESS: Record<keyof ScenePalette, [number, number]> = { body: [.45, .85], trim: [.8, .97], roof: [.15, .7], accent: [.1, .75] }
const SIGN_CONTRAST = 3 // the sign text is large and bold

// ---- Colors ----

type RGB = [number, number, number]
export function hex(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(v)) return v
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
  return null
}
const rgb = (h: string): RGB => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as RGB
const toHex = ([r, g, b]: RGB) => `#${[r, g, b].map(c => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`
function toHsl([r, g, b]: RGB): RGB {
  const [R, G, B] = [r / 255, g / 255, b / 255]
  const max = Math.max(R, G, B), min = Math.min(R, G, B), l = (max + min) / 2, d = max - min
  if (!d) return [0, 0, l]
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4
  return [(h * 60 + 360) % 360, s, l]
}
function fromHsl([h, s, l]: RGB): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}
export const lightness = (h: string) => toHsl(rgb(h))[2]
function withLightness(h: string, l: number) { const [hue, s] = toHsl(rgb(h)); return toHex(fromHsl([hue, s, l])) }
function luminance(h: string) {
  const [r, g, b] = rgb(h).map(c => { const v = c / 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 })
  return .2126 * r + .7152 * g + .0722 * b
}
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + .05) / (y + .05)
}
export function mix(a: string, b: string, amount: number) {
  const [p, q] = [rgb(a), rgb(b)]
  return toHex(p.map((c, i) => c + (q[i] - c) * amount) as RGB)
}
/** Text and tint colors for a room's info panel, readable on the panel background. */
export function roomInk(color: string) {
  let ink = color
  for (let i = 0; i < 12 && contrast(ink, '#f8fcff') < 4.5; i++) ink = withLightness(ink, Math.max(0, lightness(ink) - .06))
  return { ink, soft: mix(color, '#ffffff', .82) }
}

// ---- Text ----

function clean(value: unknown, max: number) {
  if (typeof value !== 'string') return ''
  // eslint-disable-next-line no-control-regex
  const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  const cut = text.slice(0, max + 1), space = cut.lastIndexOf(' ')
  return (space > max * .6 ? cut.slice(0, space) : text.slice(0, max)).replace(/[\s,;:–-]+$/, '')
}
const slug = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^[^a-z]+|-+$/g, '').slice(0, 24).replace(/-+$/, '')
const pick = <T extends string>(value: unknown, list: readonly T[]): T | null => (list as readonly unknown[]).includes(value) ? value as T : null
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

export function profileText(source: SceneSource) {
  return [source.company, source.website ?? '', source.offering, source.channels, ...source.products.map(p => p.name),
    ...source.parts.flatMap(p => [p.part, p.supplier])].join(' ')
}

// ---- Fallback design from keywords ----

const KEYWORDS: [Archetype, RegExp][] = [
  ['workshop', /bike|manufactur|assembl|factory|hardware|fabricat|workshop|machin|handmade|furniture maker|brewer/i],
  ['cafe', /caf[eé]|coffee|bakery|restaurant|bistro|espresso|diner|\bbar\b|food truck|\bmeals?\b|catering/i],
  ['warehouse', /wholesal|distribut|logistic|fulfil|warehouse|freight|industrial suppl/i],
  ['studio', /agency|studio|design|consult|software|saas|\bapps?\b|services?\b|bookkeep|accounting|legal|law firm|freelanc/i],
]
export function pickArchetype(source: SceneSource): Archetype {
  for (const text of [source.offering, profileText(source)])
    for (const [archetype, words] of KEYWORDS) if (words.test(text)) return archetype
  return 'storefront'
}

function defaultRoom(room: DefaultRoom): SceneRoom {
  const base = KIND_DEFAULTS[room.kind]
  return { id: room.id, kind: room.kind, name: room.name ?? base.name, shortName: room.shortName ?? room.name ?? base.shortName,
    furniture: room.furniture ?? base.furniture, color: base.color, description: base.description, tracks: [...base.tracks] }
}
export function defaultSceneSpec(archetype: Archetype = 'storefront'): SceneSpec {
  const d = ARCHETYPE_DEFAULTS[archetype]
  return { version: 1, archetype, palette: { ...d.palette }, sign: { ...d.sign, tagline: '' }, ground: d.ground,
    roofProps: [...d.roofProps], groundProps: [...d.groundProps], rooms: d.rooms.map(defaultRoom),
    reasoning: `A quick design picked from your business description: it reads like a ${d.label}.` }
}
export function fallbackSceneSpec(source: SceneSource): SceneSpec {
  const spec = defaultSceneSpec(pickArchetype(source))
  if (!source.parts.length && !source.demo) spec.rooms = padRooms(spec.rooms.filter(r => r.kind !== 'supply'), spec.archetype)
  return spec
}
function padRooms(rooms: SceneRoom[], archetype: Archetype) {
  const used = new Set(rooms.map(r => r.kind)), ids = new Set(rooms.map(r => r.id))
  const extra = [...ARCHETYPE_DEFAULTS[archetype].rooms, ...ROOM_KINDS.map(kind => ({ id: kind, kind }))]
  for (const room of extra) {
    if (rooms.length >= MIN_ROOMS) break
    if (used.has(room.kind) || ids.has(room.id)) continue
    rooms.push(defaultRoom(room)); used.add(room.kind); ids.add(room.id)
  }
  return rooms
}

// ---- Validation ----

/**
 * Turns an agent reply (snake_case) or a saved design into a safe SceneSpec.
 * It repairs instead of rejecting, and falls back to a keyword-picked design when nothing is usable.
 */
export function validateSceneSpec(raw: unknown, source: SceneSource): SceneCheck {
  const repairs: string[] = []
  const fallback = (why: string): SceneCheck => ({ spec: fallbackSceneSpec(source), repairs: [...repairs, why], fallback: true })
  if (!isRecord(raw)) return fallback('The design was not a JSON object.')
  if (raw.version !== undefined && raw.version !== 1) return fallback(`Unknown design version ${String(raw.version)}.`)

  const allowed = new Set(profileText(source).match(/\d+/g) ?? [])
  const invented = (text: string) => (text.match(/\d+/g) ?? []).some(d => !allowed.has(d))
  const text = (value: unknown, max: number, field: string) => {
    const result = clean(value, max)
    if (typeof value === 'string' && value.trim().length > max) repairs.push(`${field} was shortened.`)
    if (result && invented(result)) { repairs.push(`${field} had a number that isn't in the company profile.`); return '' }
    return result
  }

  let archetype = pick(raw.archetype, ARCHETYPES)
  if (!archetype) { archetype = pickArchetype(source); repairs.push(`Unknown building type ${JSON.stringify(raw.archetype)}; picked ${archetype}.`) }
  const d = ARCHETYPE_DEFAULTS[archetype]

  const rawPalette = isRecord(raw.palette) ? raw.palette : {}
  const palette = { ...d.palette }
  for (const key of Object.keys(LIGHTNESS) as (keyof ScenePalette)[]) {
    const color = hex(rawPalette[key])
    if (!color) { if (rawPalette[key] !== undefined) repairs.push(`palette.${key} was not a hex color.`); continue }
    const [low, high] = LIGHTNESS[key], l = lightness(color)
    palette[key] = l < low || l > high ? withLightness(color, Math.min(high, Math.max(low, l))) : color
    if (palette[key] !== color) repairs.push(`palette.${key} was too light or dark.`)
  }

  const rawSign = isRecord(raw.sign) ? raw.sign : {}
  let background = hex(rawSign.background) ?? d.sign.background
  let ink = hex(rawSign.color) ?? d.sign.color
  if (contrast(ink, background) < SIGN_CONTRAST) {
    repairs.push('The sign text was hard to read.')
    ink = contrast('#ffffff', background) >= contrast('#1b2a44', background) ? '#ffffff' : '#1b2a44'
    for (let i = 0; i < 8 && contrast(ink, background) < SIGN_CONTRAST; i++)
      background = withLightness(background, ink === '#ffffff' ? lightness(background) * .8 : Math.min(1, lightness(background) + .08))
  }
  const sign = { background, color: ink, tagline: text(rawSign.tagline, 28, 'sign.tagline') }

  const ground = pick(raw.ground, GROUNDS) ?? d.ground
  const list = <T extends string>(value: unknown, options: readonly T[], max: number, fallbackList: T[], field: string): T[] => {
    if (!Array.isArray(value)) return [...fallbackList]
    const kept = [...new Set(value.map(v => pick(v, options)).filter((v): v is T => !!v))]
    if (kept.length !== value.length || kept.length > max) repairs.push(`${field} had unknown, repeated or extra items.`)
    return kept.slice(0, max)
  }
  const roofProps = list(raw.roof_props ?? raw.roofProps, ROOF_PROPS, 3, d.roofProps, 'roof_props')
  const groundProps = list(raw.ground_props ?? raw.groundProps, GROUND_PROPS, 4, d.groundProps, 'ground_props')

  let rooms: SceneRoom[] = []
  if (Array.isArray(raw.rooms)) {
    if (raw.rooms.length > MAX_ROOMS) repairs.push(`Only the first ${MAX_ROOMS} rooms were kept.`)
    const ids = new Set<string>(), kinds = new Set<RoomKind>()
    raw.rooms.slice(0, MAX_ROOMS).forEach((value, index) => {
      if (!isRecord(value)) { repairs.push(`rooms[${index}] was not an object.`); return }
      let kind = pick(value.kind, ROOM_KINDS)
      if (!kind) { kind = 'custom'; repairs.push(`rooms[${index}].kind was unknown.`) }
      if (kind !== 'custom' && kinds.has(kind)) { repairs.push(`rooms[${index}] repeated the ${kind} kind.`); kind = 'custom' }
      kinds.add(kind)
      const defaults = KIND_DEFAULTS[kind]
      const name = text(value.name, 26, `rooms[${index}].name`) || defaults.name
      const short = text(value.short_name ?? value.shortName, 14, `rooms[${index}].short_name`)
      const shortName = short || (name.length <= 14 ? name : name.split(' ')[0].slice(0, 14))
      const base = typeof value.id === 'string' && /^[a-z][a-z0-9-]{0,23}$/.test(value.id) ? value.id : slug(name) || `room-${index + 1}`
      if (base !== value.id) repairs.push(`rooms[${index}].id was not a valid id.`)
      let id = base
      for (let n = 2; ids.has(id); n++) id = `${base.slice(0, 21)}-${n}`
      ids.add(id)
      const tracks = Array.isArray(value.tracks) ? value.tracks.map((t, i) => text(t, 40, `rooms[${index}].tracks[${i}]`)).filter(Boolean).slice(0, 3) : []
      rooms.push({
        id, kind, name, shortName,
        furniture: pick(value.furniture, FURNITURE) ?? defaults.furniture,
        color: hex(value.color) ?? defaults.color,
        description: text(value.description, 180, `rooms[${index}].description`) || defaults.description,
        tracks: tracks.length ? tracks : [...defaults.tracks],
      })
    })
  }
  if (!rooms.length && !Array.isArray(raw.rooms) && !raw.archetype) return fallback('The design had no rooms and no building type.')
  if (!rooms.length) rooms = d.rooms.map(defaultRoom)
  if (rooms.length < MIN_ROOMS) { repairs.push(`Added rooms to reach ${MIN_ROOMS}.`); rooms = padRooms(rooms, archetype) }

  const reasoning = text(raw.reasoning, 280, 'reasoning') || defaultSceneSpec(archetype).reasoning
  return { spec: { version: 1, archetype, palette, sign, ground, roofProps, groundProps, rooms, reasoning }, repairs, fallback: false }
}

/** The snake_case form that agents write and that the app stores. */
export function sceneToWire(spec: SceneSpec) {
  return {
    version: spec.version, archetype: spec.archetype, palette: spec.palette, sign: spec.sign, ground: spec.ground,
    roof_props: spec.roofProps, ground_props: spec.groundProps,
    rooms: spec.rooms.map(({ shortName, ...room }) => ({ ...room, short_name: shortName })),
    reasoning: spec.reasoning,
  }
}
