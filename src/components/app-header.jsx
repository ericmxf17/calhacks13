'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelsTopLeft } from 'lucide-react';

export default function AppHeader() {
  const pathname = usePathname();
  return <header className="app-header"><div className="header-inner">
    <Link href="/" className="brand" aria-label="Policy desk home"><span className="brand-icon"><PanelsTopLeft size={19} aria-hidden="true" /></span><span className="brand-name">Policy desk</span></Link>
    <nav className="header-nav" aria-label="Main navigation">
      {[['/', 'Overview'], ['/strategies', 'Strategies']].map(([href, label]) => <Link key={href} href={href} className={`nav-link${pathname === href ? ' is-active' : ''}`} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>)}
    </nav>
    <span className="company-label"><span className="company-avatar" aria-hidden="true">V</span>VoltRide</span>
  </div></header>;
}
