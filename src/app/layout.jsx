import localFont from 'next/font/local';
import AppHeader from '@/components/app-header';
import './globals.css';

const inter = localFont({ src: './fonts/InterVariable.woff2', weight: '100 900', variable: '--font-inter', display: 'swap' });

export const metadata = {
  title: { default: 'H.R. 973 · VoltRide · Policy desk', template: '%s · VoltRide · Policy desk' },
  description: 'A saved policy impact analysis for the fictional VoltRide company.',
};

export default function RootLayout({ children }) {
  return <html lang="en" className={`${inter.variable} dark`}><body><div className="app">
    <a href="#main" className="skip-link">Skip to analysis</a>
    <AppHeader />
    <main id="main" tabIndex={-1}>{children}</main>
    <footer><span>Fictional company · Saved sample, not live bill data</span><span>Strategic analysis, not legal advice.</span></footer>
  </div></body></html>;
}
