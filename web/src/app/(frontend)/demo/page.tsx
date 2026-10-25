import Link from 'next/link'
import Workspace from '@/components/Workspace'
import { demoCompanies } from '@/lib/demo-companies'

export default function DemoPage() {
  if (process.env.CONSUL_JUDGE_DEMO === 'true') {
    return (
      <main className="min-h-dvh bg-paper px-6 py-12 text-ink">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-4xl">Explore Consul</h1>
          <p className="mt-4 text-base text-muted">Saved company demos. No account needed. Changes stay in this visit.</p>
          <nav className="mt-8 grid gap-4" aria-label="Saved company demos">
            {demoCompanies.map(profile => (
              <Link className="rounded-xl border border-line p-6 transition hover:bg-white/40" key={profile.id} href={`/demo/${profile.id}`}>
                <strong className="text-lg">{profile.business.company} →</strong>
                <p className="mt-2 text-sm text-muted">{profile.summary}</p>
              </Link>
            ))}
          </nav>
        </div>
      </main>
    )
  }
  return <Workspace initialView="demo" />
}
