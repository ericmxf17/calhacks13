'use client'

import dynamic from 'next/dynamic'

const Dashboard = dynamic(() => import('@/components/business/App'), {
  ssr: false,
  loading: () => (
    <div className="grid h-dvh place-items-center bg-paper text-muted" role="status">
      Opening the demo dashboard…
    </div>
  ),
})

export default function DemoPage() {
  return (
    <>
      <Dashboard company="Consul Goods · Demo" />
      <a className="demo-exit" href="/">Back to sign in</a>
    </>
  )
}
