// Saved building designs for the demo companies, in the same format Scene Designer writes.
// Demo pages load these instantly instead of waiting for the agent. Room ids match each
// company's prepared rooms in demo-companies.ts; extra rooms are filled from the setup details.

export const demoSceneDesigns: Record<string, unknown> = {
  voltride: {
    version: 1,
    archetype: 'workshop',
    palette: { body: '#d98a52', trim: '#f4ead6', accent: '#2bb673', roof: '#4a5d75' },
    sign: { background: '#123c69', color: '#ffffff', tagline: 'E-bikes built in Oakland' },
    ground: 'plaza',
    roof_props: ['solar_panels', 'vents'],
    ground_props: ['bike_rack', 'delivery_van', 'pallets'],
    rooms: [
      { id: 'finance', name: 'Finance', short_name: 'Finance', kind: 'finance', furniture: 'desk', color: '#ffd447', description: 'Revenue from bikes and batteries, and what it costs to build them.', tracks: ['Revenue by product', 'Gross margin', 'Cash on hand'] },
      { id: 'hiring', name: 'People & hiring', short_name: 'Hiring', kind: 'people', furniture: 'meeting_table', color: '#b9a0ff', description: 'The team that designs and assembles every bike.', tracks: ['Team size', 'Open roles', 'Candidates'] },
      { id: 'supply', name: 'Components & supply', short_name: 'Components', kind: 'supply', furniture: 'shelves', color: '#57d7ab', description: 'Battery packs, motors and frames, and the suppliers behind them.', tracks: ['Suppliers', 'Part costs', 'Certifications'] },
      { id: 'assembly', name: 'Assembly floor', short_name: 'Assembly', kind: 'operations', furniture: 'workbench', color: '#8fb3ff', description: 'Where parts become finished e-bikes, month by month.', tracks: ['Monthly output', 'Busiest line', 'Capacity'] },
      { id: 'marketing', name: 'Dealers & markets', short_name: 'Growth', kind: 'sales', furniture: 'counter', color: '#ff8a72', description: 'Online orders, bike shops, and the markets that matter most.', tracks: ['Units by channel', 'Dealers', 'Key markets'] },
      { id: 'product', name: 'Product line', short_name: 'Products', kind: 'product', furniture: 'drafting_table', color: '#58cde3', description: 'The bikes and batteries VoltRide sells, and what each one costs.', tracks: ['Products', 'Prices', 'Best sellers'] },
    ],
    reasoning: 'VoltRide assembles e-bikes in Oakland, so it gets a workshop with a loading bay, a showroom and solar panels, plus rooms for the assembly floor and the product line.',
  },
  'harbor-goods': {
    version: 1,
    archetype: 'storefront',
    palette: { body: '#ffb16d', trim: '#fff4d4', accent: '#1f4e6b', roof: '#e06a42' },
    sign: { background: '#1f6f8b', color: '#ffffff', tagline: 'Kitchen and home goods' },
    ground: 'lawn',
    roof_props: ['water_tower'],
    ground_props: ['planters', 'benches'],
    rooms: [
      { id: 'finance', name: 'Finance', short_name: 'Finance', kind: 'finance', furniture: 'desk', color: '#ffd447', description: 'Store and online sales, and what stock costs.', tracks: ['Revenue', 'Gross margin', 'Cash flow'] },
      { id: 'hiring', name: 'People & hiring', short_name: 'Hiring', kind: 'people', furniture: 'meeting_table', color: '#b9a0ff', description: 'The store and fulfillment team.', tracks: ['Team size', 'Open roles', 'Candidates'] },
      { id: 'supply', name: 'Inventory & supply', short_name: 'Inventory', kind: 'supply', furniture: 'shelves', color: '#57d7ab', description: 'Stock on the shelves and orders on the way.', tracks: ['In-stock rate', 'Inventory coverage', 'Incoming orders'] },
      { id: 'marketing', name: 'Marketing', short_name: 'Marketing', kind: 'marketing', furniture: 'drafting_table', color: '#ff8a72', description: 'Seasonal campaigns and neighborhood events.', tracks: ['Return on ad spend', 'Campaign spend', 'Loyal customers'] },
    ],
    reasoning: 'Harbor Goods sells homewares online and in neighborhood stores, so it gets a classic shopfront with display windows and a bench out front.',
  },
  'beacon-studio': {
    version: 1,
    archetype: 'studio',
    palette: { body: '#a9c8e6', trim: '#eaf2fa', accent: '#f2b134', roof: '#3c4f6b' },
    sign: { background: '#14213d', color: '#ffd166', tagline: 'Brand and web design' },
    ground: 'lawn',
    roof_props: ['rooftop_garden', 'antenna'],
    ground_props: ['benches', 'street_lamps', 'planters'],
    rooms: [
      { id: 'finance', name: 'Finance', short_name: 'Finance', kind: 'finance', furniture: 'desk', color: '#ffd447', description: 'Project fees, retainers and the studio’s cash.', tracks: ['Revenue', 'Billable utilization', 'Cash flow'] },
      { id: 'hiring', name: 'People & hiring', short_name: 'Hiring', kind: 'people', furniture: 'lounge', color: '#b9a0ff', description: 'A small senior team and the skills it needs next.', tracks: ['Team size', 'Open roles', 'Candidates'] },
      { id: 'supply', name: 'Capacity & partners', short_name: 'Capacity', kind: 'operations', furniture: 'drafting_table', color: '#57d7ab', description: 'Specialist time, contractors and software.', tracks: ['Booked capacity', 'Partner hours', 'Renewals'] },
      { id: 'marketing', name: 'New business', short_name: 'New business', kind: 'sales', furniture: 'meeting_table', color: '#ff8a72', description: 'Referrals, case studies and discovery calls.', tracks: ['Qualified leads', 'Proposals', 'Discovery calls'] },
    ],
    reasoning: 'Beacon Studio sells design services, so it gets a glass studio with a roof terrace and a lobby for client meetings.',
  },
}
