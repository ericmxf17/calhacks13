import Link from 'next/link';
import { Leaf } from 'lucide-react';
import './globals.css';

export const metadata = {
  title: { default: 'H.R. 973 · VoltRide · Policy desk', template: '%s · VoltRide · Policy desk' },
  description: 'A saved policy impact analysis for the fictional VoltRide company.',
};

export default function RootLayout({ children }) {
  return <html lang="en"><body><div className="app">
    <a href="#main" className="skip-link">Skip to analysis</a>
    <header className="app-header"><div className="header-inner">
      <Link href="/" className="brand"><span className="brand-icon"><Leaf size={19} /></span>policy desk<span className="brand-dot">.</span></Link>
      <span className="header-description">Policy into perspective</span>
      <span className="company-label"><span>V</span>VoltRide</span>
    </div></header>
    <main id="main" tabIndex={-1}>{children}</main>
    <footer><span>Fictional company · Saved sample, not live bill data</span><span>Strategic analysis, not legal advice.</span></footer>
  </div></body></html>;
}
