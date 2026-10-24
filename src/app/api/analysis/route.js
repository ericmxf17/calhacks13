import { getSnapshot } from '@/lib/snapshot';

export function GET() {
  return Response.json(getSnapshot());
}
