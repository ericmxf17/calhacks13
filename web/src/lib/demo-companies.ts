import type { BusinessInput } from './business-input'
import { validateSceneSpec, type SceneSpec } from './scene-spec'
import { demoSceneDesigns } from './demo-scenes'
import { departments as roomLayout, type Department, type LegacyRoomId } from '@/components/business/departments'

export type DemoCompany = {
  id: string
  industry: string
  summary: string
  business: BusinessInput
  departments: Department[]
  /** The saved building design, so demo pages don't wait for Scene Designer. */
  scene: SceneSpec
}

type RoomContent = Omit<Department, 'id' | 'floor' | 'number' | 'position' | 'color'>

// Keep the four original rooms and their colors; every company supplies all of its room content.
// The building design places the rooms, so floor, number and position here are only defaults.
function rooms(content: Record<LegacyRoomId, RoomContent>): Department[] {
  return roomLayout.map(({ id, floor, number, position, color, kind, furniture, ink, soft, source }) => ({
    id, floor, number, position, color, kind, furniture, ink, soft, source, ...content[id],
  }))
}

const companies: Omit<DemoCompany, 'scene'>[] = [
  {
    // Matches company.json and the live H.R. 973 analysis (run 2026-10-24) in the Python pipeline.
    id: 'voltride', industry: 'E-bike manufacturing',
    summary: 'Follow battery certification, supplier risk, and dealer growth.',
    business: {
      company: 'VoltRide', website: 'https://voltride.example',
      offering: 'City and cargo e-bikes, plus replacement batteries, assembled in Oakland', channels: 'Direct online (60% of units) and 85 independent bike shops (40%)', demo: true,
      products: [{ name: 'VoltRide City e-bike', price: 1699, units: 5500 }, { name: 'VoltRide Cargo e-bike', price: 2499, units: 2000 }, { name: 'Replacement battery pack', price: 449, units: 1500 }],
      parts: [
        { supplier: 'Shenzhen PowerCell', part: 'Battery pack, standard 672Wh', cost: 205 },
        { supplier: 'Hanbit Energy', part: 'Battery pack, standard 672Wh', cost: 285 },
        { supplier: 'Dongguan SafeCell', part: 'Battery pack, standard 672Wh', cost: 245 },
        { supplier: 'Changzhou Drive Systems', part: 'Hub motor', cost: 95 },
        { supplier: 'Changzhou Drive Systems', part: 'Mid-drive motor', cost: 280 },
        { supplier: 'Taichung Alloy Works', part: 'City frame', cost: 110 },
        { supplier: 'Taichung Alloy Works', part: 'Cargo frame', cost: 185 },
        { supplier: 'Shenzhen Logic Electronics', part: 'Controller and display', cost: 55 },
        { supplier: 'Kaneda Components', part: 'Drivetrain and brakes', cost: 95 },
        { supplier: 'Saigon Wheelworks', part: 'Wheels and tires', cost: 60 },
        { supplier: 'Ningbo Parts Co.', part: 'Lights, wiring, fenders', cost: 40 },
      ],
    },
    departments: rooms({
      finance: {
        name: 'Finance', shortName: 'Finance', period: 'Fiscal 2026 · full year',
        description: 'Three products, one assembly line in Oakland. See where the profit comes from, and what a federal battery rule could put at risk.',
        metrics: [{ label: 'Revenue', value: '$13.47M', change: 'About $1.12M a month' }, { label: 'Gross margin', value: '41.5%', change: 'Target: 40% or higher' }, { label: 'Cash on hand', value: '$2.1M', change: 'Operating profit about $1.69M a year' }],
        chartTitle: 'Where the profit comes from', chartNote: 'GROSS PROFIT BY PRODUCT · $ THOUSANDS', chartLabels: ['City', 'Cargo', 'Batteries'], chartValues: [3603, 1740, 249], unit: 'k',
        listTitle: 'Money to watch', rows: [
          { initial: 'S', title: 'Uncertified battery stock', subtitle: '2,800 Shenzhen PowerCell packs · EN 15194 only', value: '$574,000 at cost' },
          { initial: 'C', title: 'VoltRide Cargo certification', subtitle: 'UL 2849 · 16 weeks · needed under any federal rule', value: '$60,000' },
          { initial: 'P', title: 'PowerCell contract exit penalty', subtitle: 'If volume drops below 5,000 packs a year before Mar 31, 2027', value: '$75,000' },
          { initial: 'R', title: 'Doing nothing if a battery rule applies', subtitle: 'First-year impact, worst case · live analysis', value: '−$5.69M' },
        ],
      },
      hiring: {
        name: 'People & hiring', shortName: 'Hiring', period: 'As of Oct 24, 2026',
        description: 'A 62-person team designing and assembling e-bikes in Oakland. The next hire owns battery and e-bike safety certification.',
        metrics: [{ label: 'Team members', value: '62', change: 'Oakland HQ and assembly site' }, { label: 'Open roles', value: '4', change: 'Assembly, compliance, quality, dealer support' }, { label: 'Active candidates', value: '42', change: '2 offers in progress' }],
        chartTitle: 'The next production team', chartNote: 'CANDIDATE PIPELINE', chartLabels: ['Applied', 'Screening', 'Interview', 'Final', 'Offer'], chartValues: [21, 10, 6, 3, 2], unit: '',
        listTitle: 'Seats on the team', rows: [
          { initial: 'C', title: 'Product Compliance Lead', subtitle: 'Compliance · Full time · Owns UL 2271 and UL 2849 certification', value: '6 candidates' },
          { initial: 'A', title: 'Assembly Technician', subtitle: 'Production · Full time', value: '18 candidates' },
          { initial: 'Q', title: 'Quality Engineer', subtitle: 'Manufacturing · Full time', value: '10 candidates' },
          { initial: 'D', title: 'Dealer Support Specialist', subtitle: 'Sales · Full time', value: '8 candidates' },
        ],
      },
      supply: {
        name: 'Components & supply', shortName: 'Components', period: 'As of Oct 24, 2026',
        description: 'Every e-bike and replacement battery depends on lithium-ion packs from three suppliers. Only two hold the UL 2271 certification a federal rule would require.',
        callout: {
          title: 'Policy watch · H.R. 973',
          body: 'The battery safety bill has a 24.1% chance of becoming law this Congress, but there is a 69.6% chance a federal battery rule reaches VoltRide anyway, because the CPSC is finishing its own rule. Recommended: wait for a Senate vote or a CPSC final rule, then certify Shenzhen PowerCell and the Cargo bike. Expected first-year impact: −$84.6K, versus −$3.96M for doing nothing.',
        },
        metrics: [{ label: 'Batteries certified to UL 2271', value: '30%', change: 'Hanbit 20% + SafeCell 10%' }, { label: 'Uncertified packs in stock', value: '2,800', change: 'Shenzhen PowerCell · $574k at cost' }, { label: 'PowerCell contract ends', value: 'Mar 31, 2027', change: '5,000 packs a year minimum · $75k exit' }],
        chartTitle: 'Where the batteries come from', chartNote: 'SHARE OF BATTERY VOLUME · %', chartLabels: ['PowerCell', 'Hanbit', 'SafeCell'], chartValues: [70, 20, 10], unit: '%',
        listTitle: 'Certification status', rows: [
          { initial: 'S', title: 'Shenzhen PowerCell', subtitle: 'China · Battery packs · EN 15194 only, not UL 2271 · 26 weeks to certify', value: '70% · $205 a pack' },
          { initial: 'H', title: 'Hanbit Energy', subtitle: 'South Korea · Battery packs · UL 2271 · 4,000 a year spare capacity', value: '20% · $285 a pack' },
          { initial: 'D', title: 'Dongguan SafeCell', subtitle: 'China · Battery packs · UL 2271 · 6,000 a year spare capacity', value: '10% · $245 a pack' },
          { initial: 'C', title: 'VoltRide City', subtitle: 'Product · UL 2849 certified', value: 'Certified' },
          { initial: 'V', title: 'VoltRide Cargo', subtitle: 'Product · no UL 2849 yet · $60k and 16 weeks to certify', value: 'Not certified' },
        ],
      },
      marketing: {
        name: 'Dealers & markets', shortName: 'Growth', period: 'Fiscal 2026 · full year',
        description: 'Grow from 85 to 150 bike shops. 60% of units already sell where battery rules are in force, and uncertified rivals are the most exposed to a federal rule.',
        metrics: [{ label: 'Bike shops', value: '85', change: 'Goal: 150 in fiscal 2027' }, { label: 'Sold online', value: '60%', change: '40% through bike shops' }, { label: 'Units under state battery rules', value: '60%', change: 'California 40% · New York City 20%' }],
        chartTitle: 'Where VoltRide sells', chartNote: 'SHARE OF UNITS BY REGION · %', chartLabels: ['California', 'New York City', 'Rest of US'], chartValues: [40, 20, 40], unit: '%',
        listTitle: 'Rules and rivals', rows: [
          { initial: 'C', title: 'California', subtitle: 'SB 1271 since Jan 1, 2026 · accepts UL 2849 or EN 15194', value: '40% of units' },
          { initial: 'N', title: 'New York City', subtitle: 'Local Law 39 since 2023 · certified batteries only', value: '20% of units' },
          { initial: 'R', title: 'Rest of US', subtitle: 'No state rule · the federal bill or CPSC rule would apply', value: '40% of units' },
          { initial: 'Z', title: 'Zoomly (competitor)', subtitle: 'Low-cost · mostly uncertified batteries · hit hardest by a federal rule', value: '$899–$1,199' },
          { initial: 'P', title: 'Pedalux (competitor)', subtitle: 'Premium · fully certified', value: '$2,800–$4,200' },
        ],
      },
    }),
  },
  {
    id: 'harbor-goods', industry: 'Retail', summary: 'Explore store sales, inventory arrivals, and seasonal campaigns.',
    business: {
      company: 'Harbor Goods', website: 'https://harborgoods.example', offering: 'Reusable kitchenware and thoughtful home storage', channels: 'Online shop and two neighborhood stores', demo: true,
      products: [{ name: 'Glass storage set', price: 48, units: 12000 }, { name: 'Reusable kitchen wrap', price: 24, units: 18000 }],
      parts: [{ supplier: 'Clear Coast', part: 'Glass storage set', cost: 19 }, { supplier: 'Paper Pier', part: 'Shipping box', cost: 1.8 }],
    },
    departments: rooms({
      finance: {
        name: 'Finance', shortName: 'Finance', description: 'See how neighborhood stores and the online shop contribute to a healthy, growing homewares business.',
        metrics: [{ label: 'Revenue', value: '$84k', change: '+8% vs last month' }, { label: 'Gross margin', value: '54%', change: '+1 pt vs last month' }, { label: 'Net cash flow', value: '$14k', change: 'After stock and store expenses' }],
        chartTitle: 'A steady retail rhythm', chartNote: 'NET CASH FLOW · $ THOUSANDS', chartLabels: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'], chartValues: [19, 6, 8, 10, 12, 14], unit: 'k',
        listTitle: 'Recent shop transactions', rows: [{ initial: 'O', title: 'Online shop payouts', subtitle: 'May 26 · Weekly sales', value: '+$12,400' }, { initial: 'C', title: 'Clear Coast', subtitle: 'May 24 · 300 storage sets', value: '−$5,700' }, { initial: 'N', title: 'North Pier Store', subtitle: 'May 23 · Daily sales', value: '+$3,280' }],
      },
      hiring: {
        name: 'People & hiring', shortName: 'Hiring', description: 'Welcome the store and fulfillment teammates who make thoughtful service part of every order.',
        metrics: [{ label: 'Team members', value: '16', change: 'Across 2 stores and fulfillment' }, { label: 'Open roles', value: '2', change: 'Store and fulfillment' }, { label: 'Active candidates', value: '24', change: '1 offer in progress' }],
        chartTitle: 'Welcoming the next teammates', chartNote: 'CANDIDATE PIPELINE', chartLabels: ['Applied', 'Screening', 'Interview', 'Final', 'Offer'], chartValues: [12, 6, 3, 2, 1], unit: '',
        listTitle: 'The seats we’re filling', rows: [{ initial: 'S', title: 'Store Associate', subtitle: 'North Pier · Part time', value: '14 candidates' }, { initial: 'F', title: 'Fulfillment Lead', subtitle: 'Warehouse · Full time', value: '10 candidates' }],
      },
      supply: {
        name: 'Inventory & supply', shortName: 'Inventory', description: 'Keep popular home essentials on shelves and packaging ready for the next wave of online orders.',
        metrics: [{ label: 'In-stock rate', value: '97%', change: '+2 pts vs last month' }, { label: 'Inventory coverage', value: '35 days', change: 'Target: 30–40 days' }, { label: 'Incoming orders', value: '8', change: '3 arriving this week' }],
        chartTitle: 'Keeping shelves ready', chartNote: 'IN-STOCK AVAILABILITY · %', chartLabels: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'], chartValues: [89, 91, 90, 94, 95, 97], unit: '%',
        listTitle: 'On their way to the shelves', rows: [{ initial: 'C', title: 'Clear Coast', subtitle: 'PO-310 · 300 storage sets', value: 'Arrives May 29' }, { initial: 'W', title: 'Wrap Workshop', subtitle: 'PO-312 · 500 kitchen wraps', value: 'In transit' }, { initial: 'P', title: 'Paper Pier', subtitle: 'PO-314 · 1,500 shipping boxes', value: 'Arrives Jun 03' }],
      },
      marketing: {
        name: 'Marketing', shortName: 'Marketing', description: 'Bring everyday home rituals to life through seasonal collections, neighborhood events, and loyal customers.',
        metrics: [{ label: 'Return on ad spend', value: '3.8×', change: '+12% vs last month' }, { label: 'Campaign spend', value: '$6k', change: 'Within monthly budget' }, { label: 'Attributed revenue', value: '$22.8k', change: '+18% vs last month' }],
        chartTitle: 'Stories finding their audience', chartNote: 'MONTHLY RETURN ON AD SPEND', chartLabels: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'], chartValues: [3.2, 2.5, 2.8, 3.1, 3.4, 3.8], unit: '×',
        listTitle: 'Around the neighborhood', rows: [{ initial: 'S', title: 'Summer Pantry Reset', subtitle: 'Paid social · Active', value: '4.2× ROAS' }, { initial: 'L', title: 'Harbor Rewards', subtitle: 'Loyalty email · Weekly', value: '46% open rate' }, { initial: 'N', title: 'North Pier Weekend', subtitle: 'In-store event · May 31', value: '84 RSVPs' }],
      },
    }),
  },
  {
    id: 'beacon-studio', industry: 'Agency & services', summary: 'See project revenue, team capacity, and the new-business pipeline.',
    business: {
      company: 'Beacon Studio', website: 'https://beaconstudio.example', offering: 'Brand identity and website design services', channels: 'Client referrals, partnerships, and inbound inquiries', demo: true,
      products: [{ name: 'Brand identity package', price: 18000, units: 18 }, { name: 'Website project', price: 32000, units: 12 }], parts: [],
    },
    departments: rooms({
      finance: {
        name: 'Finance', shortName: 'Finance', description: 'Connect project milestones and retainers to the studio’s cash position, with a clear view of billable work.',
        metrics: [{ label: 'Revenue', value: '$59k', change: '+9% vs last month' }, { label: 'Billable utilization', value: '76%', change: 'Target: 70–80%' }, { label: 'Net cash flow', value: '$11k', change: 'After team and contractor costs' }],
        chartTitle: 'Cash behind the creative work', chartNote: 'NET CASH FLOW · $ THOUSANDS', chartLabels: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'], chartValues: [5, 7, 4, 8, 9, 11], unit: 'k',
        listTitle: 'Project cash movements', rows: [{ initial: 'A', title: 'Arbor Health', subtitle: 'May 26 · Website milestone 2', value: '+$16,000' }, { initial: 'L', title: 'Lumen Coffee', subtitle: 'May 24 · Brand project deposit', value: '+$9,000' }, { initial: 'M', title: 'Mira Chen', subtitle: 'May 23 · Motion design contract', value: '−$3,200' }],
      },
      hiring: {
        name: 'People & hiring', shortName: 'Hiring', description: 'Balance a small senior team with the design and production skills needed for the next client engagements.',
        metrics: [{ label: 'Team members', value: '9', change: '6 designers, 3 strategy & production' }, { label: 'Open roles', value: '2', change: 'Design and production' }, { label: 'Active candidates', value: '18', change: '1 offer in progress' }],
        chartTitle: 'Finding the next creative partners', chartNote: 'CANDIDATE PIPELINE', chartLabels: ['Applied', 'Screening', 'Interview', 'Final', 'Offer'], chartValues: [8, 5, 3, 1, 1], unit: '',
        listTitle: 'New studio seats', rows: [{ initial: 'D', title: 'Senior Brand Designer', subtitle: 'Creative · Full time', value: '11 candidates' }, { initial: 'P', title: 'Project Producer', subtitle: 'Delivery · Full time', value: '7 candidates' }],
      },
      supply: {
        name: 'Capacity & partners', shortName: 'Capacity', description: 'Plan specialist time, contractor bookings, and software renewals so every project has what it needs to ship.',
        metrics: [{ label: 'Booked capacity', value: '82%', change: 'Next four weeks' }, { label: 'Partner hours available', value: '64h', change: 'Motion and development' }, { label: 'Upcoming renewals', value: '3', change: 'Within the next 30 days' }],
        chartTitle: 'Room for the next engagement', chartNote: 'MONTHLY BOOKED CAPACITY · %', chartLabels: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'], chartValues: [62, 68, 74, 71, 78, 82], unit: '%',
        listTitle: 'Partners and renewals', rows: [{ initial: 'M', title: 'Mira Chen · Motion', subtitle: 'Arbor launch · Reserved Jun 02–06', value: '24h booked' }, { initial: 'W', title: 'Webcraft Partners', subtitle: 'Development · June availability', value: '40h available' }, { initial: 'C', title: 'Creative software seats', subtitle: '9 licenses · Renews Jun 01', value: '$540 / month' }],
      },
      marketing: {
        name: 'New business', shortName: 'New business', description: 'Turn useful case studies, trusted referrals, and discovery calls into the studio’s next client relationships.',
        metrics: [{ label: 'Qualified leads', value: '14', change: '+4 vs last month' }, { label: 'Proposal pipeline', value: '$126k', change: '6 active proposals' }, { label: 'Discovery calls', value: '9', change: 'This month' }],
        chartTitle: 'The next client conversations', chartNote: 'MONTHLY QUALIFIED LEADS', chartLabels: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'], chartValues: [5, 7, 6, 9, 10, 14], unit: '',
        listTitle: 'Work opening new doors', rows: [{ initial: 'A', title: 'Arbor Health case study', subtitle: 'Website · Published May 12', value: '5 inquiries' }, { initial: 'F', title: 'Founder referral circle', subtitle: 'Partnerships · Ongoing', value: '6 introductions' }, { initial: 'S', title: 'Studio Notes', subtitle: 'Email · Monthly', value: '51% open rate' }],
      },
    }),
  },
]

export const demoCompanies: DemoCompany[] = companies.map(company => ({
  ...company, scene: validateSceneSpec(demoSceneDesigns[company.id], company.business).spec,
}))

export function findDemoCompany(id: string): DemoCompany | undefined {
  return demoCompanies.find((company) => company.id === id)
}
