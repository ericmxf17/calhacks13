import type { Furniture, RoomKind } from '@/lib/scene-spec'

export type DepartmentId = string
/** The four rooms of the original sample building. */
export type LegacyRoomId = 'finance' | 'hiring' | 'supply' | 'marketing'
export type Department = {
  id: DepartmentId; name: string; shortName: string; floor: string; number: string; position: [number, number, number]; color: string;
  description: string; metrics: { label: string; value: string; change: string }[];
  // A room can skip the chart or the list when there is no data for it yet.
  chartTitle?: string; chartNote?: string; chartLabels?: string[]; chartValues?: number[]; unit?: string;
  listTitle?: string; rows?: { initial: string; title: string; subtitle: string; value: string }[]
  // Optional: the time period the room's figures cover, and a highlighted note shown above the metrics.
  period?: string; callout?: { title: string; body: string }
  // From the building design: what the room is for, its furniture, which side its label sits on,
  // and the darker and lighter tints of its color used by the info panel.
  kind?: RoomKind; furniture?: Furniture; side?: 'left' | 'right' | 'center'; ink?: string; soft?: string
  // What the room will show once data is connected, and where its numbers come from.
  tracks?: string[]; source?: 'illustrative' | 'setup' | 'placeholder'
}
export const departments: (Department & { id: LegacyRoomId })[] = [
  { id: 'finance', name: 'Finance', shortName: 'Finance', floor: 'SECOND FLOOR', number: '01', position: [-1.57, 5.7, 1.04], color: '#ffd447', kind: 'finance', furniture: 'desk', ink: '#a56906', soft: '#fff3c2', source: 'illustrative',
    description: 'Fictional sample revenue, expenses and cash flow. These figures are not connected to an accounting system.',
    metrics: [{ label: 'Revenue', value: '$486k', change: '+16.2% vs last month' }, { label: 'Operating expenses', value: '$202k', change: '+4.8% vs last month' }, { label: 'Net cash flow', value: '$284k', change: '+12.8% vs last month' }],
    chartTitle: 'Sample monthly net cash flow', chartNote: 'NET CASH FLOW · $ THOUSANDS', chartLabels: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'], chartValues: [154, 188, 171, 224, 252, 284], unit: 'k',
    listTitle: 'Recent transactions', rows: [{ initial: 'S', title: 'Shopify payouts', subtitle: 'May 26 · Sales revenue', value: '+$24,680' }, { initial: 'A', title: 'Atelier Studio', subtitle: 'May 24 · Creative production', value: '−$4,200' }, { initial: 'L', title: 'Linen Collective', subtitle: 'May 23 · Materials', value: '−$8,750' }] },
  { id: 'hiring', name: 'People & hiring', shortName: 'Hiring', floor: 'SECOND FLOOR', number: '02', position: [1.57, 5.7, 1.04], color: '#b9a0ff', kind: 'people', furniture: 'desk', ink: '#754ac7', soft: '#eee5ff', source: 'illustrative',
    description: 'Fictional sample headcount, open roles and candidate stages.',
    metrics: [{ label: 'Team members', value: '42', change: '+4 this quarter' }, { label: 'Open roles', value: '3', change: 'Across 3 departments' }, { label: 'Active candidates', value: '86', change: '3 offers in progress' }],
    chartTitle: 'Sample candidate pipeline', chartNote: 'CANDIDATE PIPELINE', chartLabels: ['Applied', 'Screening', 'Interview', 'Final', 'Offer'], chartValues: [48, 20, 10, 5, 3], unit: '',
    listTitle: 'Sample open roles', rows: [{ initial: 'D', title: 'Brand Designer', subtitle: 'Marketing · Full time', value: '32 candidates' }, { initial: 'O', title: 'Operations Lead', subtitle: 'Supply chain · Full time', value: '28 candidates' }, { initial: 'F', title: 'Finance Associate', subtitle: 'Finance · Full time', value: '26 candidates' }] },
  { id: 'supply', name: 'Supply chain', shortName: 'Supply', floor: 'FIRST FLOOR', number: '03', position: [-1.57, 3.65, 1.04], color: '#57d7ab', kind: 'supply', furniture: 'desk', ink: '#158265', soft: '#d7f6e8', source: 'illustrative',
    description: 'Fictional sample deliveries, inventory coverage and incoming purchase orders.',
    metrics: [{ label: 'On-time delivery', value: '94%', change: '+1.6 pts vs last month' }, { label: 'Inventory coverage', value: '38 days', change: 'Within target range' }, { label: 'Incoming orders', value: '12', change: '4 arriving this week' }],
    chartTitle: 'Sample on-time delivery rate', chartNote: 'DELIVERY PERFORMANCE · %', chartLabels: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'], chartValues: [85, 88, 87, 91, 92.4, 94], unit: '%',
    listTitle: 'Sample incoming orders', rows: [{ initial: 'L', title: 'Linen Collective', subtitle: 'PO-1048 · 840 units', value: 'Arrives May 28' }, { initial: 'P', title: 'Papier & Co.', subtitle: 'PO-1051 · 2,000 boxes', value: 'In transit' }, { initial: 'M', title: 'Maison Textile', subtitle: 'PO-1054 · 620 units', value: 'Arrives Jun 02' }] },
  { id: 'marketing', name: 'Marketing', shortName: 'Marketing', floor: 'FIRST FLOOR', number: '04', position: [1.57, 3.65, 1.04], color: '#ff8a72', kind: 'marketing', furniture: 'desk', ink: '#bd4e38', soft: '#ffebe0', source: 'illustrative',
    description: 'Fictional sample campaign spend, attributed revenue and return on ad spend.',
    metrics: [{ label: 'Return on ad spend', value: '4.7×', change: '+18.4% vs last month' }, { label: 'Campaign spend', value: '$24k', change: 'Within monthly budget' }, { label: 'Attributed revenue', value: '$112.8k', change: '+24% vs last month' }],
    chartTitle: 'Sample monthly return on ad spend', chartNote: 'MONTHLY RETURN ON AD SPEND', chartLabels: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'], chartValues: [2.8, 3.1, 3.5, 3.3, 3.97, 4.7], unit: '×',
    listTitle: 'Sample campaigns', rows: [{ initial: 'S', title: 'The Spring Edit', subtitle: 'Paid social · Active', value: '5.2× ROAS' }, { initial: 'E', title: 'Everyday Essentials', subtitle: 'Search · Active', value: '4.6× ROAS' }, { initial: 'A', title: 'A Letter from Consul', subtitle: 'Email · Weekly', value: '42% open rate' }] },
]
