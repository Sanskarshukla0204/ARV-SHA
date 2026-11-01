'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Logo } from '@/components/Logo';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[ui] page error', error.digest ?? '');
  }, [error]);
  return (
    <main className="brand-page" id="main">
      <div>
        <div className="logo-large">
          <Logo href={null} />
        </div>
        <h1>Something went wrong on our side</h1>
        <p>Your bag and account are safe. Try again, and if the problem stays, contact support{error.digest ? ` and quote reference ${error.digest}` : ''}.</p>
        <div className="row" style={{ justifyContent: 'center', marginTop: '1.75rem' }}>
          <button type="button" className="btn btn--primary" onClick={reset}>
            Try again
          </button>
          <Link href="/support" className="btn">
            Contact support
          </Link>
        </div>
      </div>
    </main>
  );
}
