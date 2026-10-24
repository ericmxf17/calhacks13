import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return <div className="load-state" role="status" aria-label="Loading saved analysis">
    <Skeleton className="h-6 w-48 mb-8" />
    <Skeleton className="h-24 w-3/4 mb-8" />
    <Skeleton className="h-48 w-full" />
    <p>Loading the saved VoltRide analysis…</p>
  </div>;
}
