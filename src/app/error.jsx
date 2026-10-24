'use client';

import { CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AnalysisError({ reset }) {
  return <section role="alert" className="load-state">
    <CircleAlert />
    <h1>We couldn’t load the analysis.</h1>
    <p>The saved analysis is unavailable. Try again or check the server logs for the failing input.</p>
    <Button onClick={reset}>Try again</Button>
  </section>;
}
