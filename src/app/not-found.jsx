import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return <section className="load-state">
    <h1>This page doesn’t exist.</h1>
    <p>Open the saved bill analysis to continue.</p>
    <Button asChild><Link href="/">Back to overview</Link></Button>
  </section>;
}
