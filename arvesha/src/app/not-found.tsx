import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/Logo';

export const metadata: Metadata = { title: 'Page not found', robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <main className="brand-page" id="main">
      <div>
        <div className="logo-large">
          <Logo href={null} priority />
        </div>
        <h1>This page could not be found</h1>
        <p>The link may be old, or the address may have a typo. Try the shop or head back to the home page.</p>
        <div className="row" style={{ justifyContent: 'center', marginTop: '1.75rem' }}>
          <Link href="/" className="btn btn--primary">
            Back to home
          </Link>
          <Link href="/shop" className="btn">
            Browse the shop
          </Link>
        </div>
      </div>
    </main>
  );
}
