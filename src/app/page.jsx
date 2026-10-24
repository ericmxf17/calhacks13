import Dashboard from '@/components/dashboard';
import { getSnapshot } from '@/lib/snapshot';

export default function OverviewPage() {
  return <Dashboard snapshot={getSnapshot()} page="overview" />;
}
