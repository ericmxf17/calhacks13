import Dashboard from '@/components/dashboard';
import { getSnapshot } from '@/lib/snapshot';

export const metadata = { title: 'Strategies' };

export default async function StrategiesPage({ searchParams }) {
  const params = await searchParams;
  return <Dashboard snapshot={getSnapshot()} page="strategies" selection={{
    option: typeof params.option === 'string' ? params.option : undefined,
    scenario: typeof params.scenario === 'string' ? params.scenario : undefined,
  }} />;
}
