import type { BusinessInput } from './business-input'
import { departments as roomLayout, type Department, type DepartmentId } from '@/components/business/departments'

export type DemoCompany = {
  id: string
  industry: string
  summary: string
  business: BusinessInput
  departments: Department[]
}

type RoomContent = Omit<Department, 'id' | 'floor' | 'number' | 'position' | 'color'>

// Keep the established building geometry; every company supplies all of its room content.
function rooms(content: Record<DepartmentId, RoomContent>): Department[] {
  return roomLayout.map(({ id, floor, number, position, color }) => ({
    id, floor, number, position, color, ...content[id],
  }))
}

export const demoCompanies: DemoCompany[] = [
  {
    id: 'voltride', industry: 'E-bike manufacturing',
    summary: 'Follow assembly, component deliveries, and dealer growth.',
    business: {
      company: 'VoltRide', website: 'https://voltride.example',
      offering: 'City e-bikes and commuter replacement batteries', channels: 'Independent bike dealers and direct online sales', demo: true,
      products: [{ name: 'City e-bike', price: 1800, units: 2400 }, { name: 'Commuter battery', price: 400, units: 1200 }],
      parts: [{ supplier: 'Torque Works', part: 'Hub motor', cost: 210 }, { supplier: 'Cell Harbor', part: 'Battery pack', cost: 260 }],
    },
    departments: rooms({
      finance: {
        name: 'Finance', shortName: 'Finance', description: 'Assembly economics in focus: dealer receipts, component costs, and the cash funding the next production run.',
        metrics: [{ label: 'Revenue', value: '$400k', change: '+11% vs last month' }, { label: 'Gross margin', value: '32%', change: '+2 pts vs last month' }, { label: 'Net cash flow', value: '$48k', change: 'After production expenses' }],
        chartTitle: 'Cash powering the next run', chartNote: 'NET CASH FLOW · $ THOUSANDS', chartLabels: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'], chartValues: [18, 24, 21, 33, 41, 48], unit: 'k',
        listTitle: 'Production cash movements', rows: [{ initial: 'R', title: 'Ridgeway Cycles', subtitle: 'May 26 · Dealer invoice VR-208', value: '+$72,000' }, { initial: 'T', title: 'Torque Works', subtitle: 'May 24 · 200 hub motors', value: '−$42,000' }, { initial: 'C', title: 'Cell Harbor', subtitle: 'May 22 · 100 battery packs', value: '−$26,000' }],
      },
      hiring: {
        name: 'People & hiring', shortName: 'Hiring', description: 'Build a dependable assembly team and support the dealers putting VoltRide bikes on city streets.',
        metrics: [{ label: 'Team members', value: '28', change: '18 in production' }, { label: 'Open roles', value: '3', change: 'Assembly, quality, dealer support' }, { label: 'Active candidates', value: '36', change: '2 offers in progress' }],
        chartTitle: 'The next production team', chartNote: 'CANDIDATE PIPELINE', chartLabels: ['Applied', 'Screening', 'Interview', 'Final', 'Offer'], chartValues: [18, 9, 5, 2, 2], unit: '',
        listTitle: 'Seats on the team', rows: [{ initial: 'A', title: 'Assembly Technician', subtitle: 'Production · Full time', value: '18 candidates' }, { initial: 'Q', title: 'Quality Engineer', subtitle: 'Manufacturing · Full time', value: '10 candidates' }, { initial: 'D', title: 'Dealer Support Specialist', subtitle: 'Sales · Full time', value: '8 candidates' }],
      },
      supply: {
        name: 'Components & supply', shortName: 'Components', description: 'Track motors, batteries, and frames from supplier dispatch to the assembly line. Keep the next run covered.',
        metrics: [{ label: 'On-time components', value: '96%', change: '+3 pts vs last month' }, { label: 'Assembly coverage', value: '24 days', change: 'Target: 21–28 days' }, { label: 'Incoming shipments', value: '6', change: '2 arriving this week' }],
        chartTitle: 'Components arriving on schedule', chartNote: 'ON-TIME DELIVERY · %', chartLabels: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'], chartValues: [86, 89, 88, 92, 93, 96], unit: '%',
        listTitle: 'Bound for assembly', rows: [{ initial: 'T', title: 'Torque Works', subtitle: 'PO-620 · 200 hub motors', value: 'Arrives May 28' }, { initial: 'C', title: 'Cell Harbor', subtitle: 'PO-622 · 100 battery packs', value: 'In transit' }, { initial: 'F', title: 'Frame Foundry', subtitle: 'PO-625 · 180 city frames', value: 'Arrives Jun 02' }],
      },
      marketing: {
        name: 'Dealer growth', shortName: 'Growth', description: 'Connect new riders with local dealers through test rides, commuter stories, and useful product education.',
        metrics: [{ label: 'Qualified dealer leads', value: '42', change: '+12 vs last month' }, { label: 'Campaign spend', value: '$12k', change: 'Within monthly budget' }, { label: 'Test rides booked', value: '186', change: '+24% vs last month' }],
        chartTitle: 'More riders taking the first spin', chartNote: 'MONTHLY TEST RIDE BOOKINGS', chartLabels: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'], chartValues: [70, 83, 98, 126, 150, 186], unit: '',
        listTitle: 'Campaigns on the road', rows: [{ initial: 'C', title: 'City Commute Week', subtitle: 'Dealer events · Active', value: '96 test rides' }, { initial: 'R', title: 'Ride to Work', subtitle: 'Search · Active', value: '62 bookings' }, { initial: 'B', title: 'Battery Know-how', subtitle: 'Email · Education', value: '38% open rate' }],
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

export function findDemoCompany(id: string): DemoCompany | undefined {
  return demoCompanies.find((company) => company.id === id)
}
