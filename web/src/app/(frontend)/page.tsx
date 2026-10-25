import Workspace from '@/components/Workspace'
import { findDemoCompany } from '@/lib/demo-companies'

export default function HomePage() {
  if (process.env.CONSUL_JUDGE_DEMO === 'true') {
    return <Workspace initialView="demo" preset={findDemoCompany('voltride')} judgeDemo />
  }
  return <Workspace />
}
