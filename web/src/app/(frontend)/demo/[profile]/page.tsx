import { notFound } from 'next/navigation'
import Workspace from '@/components/Workspace'
import { findDemoCompany } from '@/lib/demo-companies'

export default async function DemoCompanyPage({ params }: { params: Promise<{ profile: string }> }) {
  const { profile: id } = await params
  const profile = findDemoCompany(id)
  if (!profile) notFound()
  return <Workspace key={profile.id} initialView="demo" preset={profile} />
}
