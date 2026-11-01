'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// The store sets only the cookies it needs to work (sign-in, bag, this choice). It loads no analytics or
// advertising tools today. This notice records the visitor's choice for optional categories so that if any are
// added later they stay off until the visitor opts in. The choice is stored in a first-party cookie for 12 months.

export const CONSENT_COOKIE = 'arv_consent';

export interface Consent {
  v: 1;
  analytics: boolean;
  marketing: boolean;
  at: string;
}

export function readConsent(): Consent | null {
  try {
    const m = document.cookie.split('; ').find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
    if (!m) return null;
    const parsed = JSON.parse(decodeURIComponent(m.slice(CONSENT_COOKIE.length + 1)));
    if (parsed && parsed.v === 1 && typeof parsed.analytics === 'boolean' && typeof parsed.marketing === 'boolean') return parsed;
  } catch {
    /* ignore a damaged cookie */
  }
  return null;
}

export function writeConsent(analytics: boolean, marketing: boolean): void {
  const value: Consent = { v: 1, analytics, marketing, at: new Date().toISOString() };
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${365 * 24 * 3600}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event('arv-consent'));
}

export function ConsentNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const update = () => setShow(readConsent() === null);
    update();
    window.addEventListener('arv-consent', update);
    return () => window.removeEventListener('arv-consent', update);
  }, []);

  if (!show) return null;
  return (
    <section className="consent glass" aria-label="Cookies">
      <p className="small" style={{ color: 'var(--ink-strong)' }}>
        This store uses only the cookies it needs to keep you signed in and remember your bag. Optional cookies stay off unless you turn them on.
      </p>
      <div className="row" style={{ marginTop: '0.8rem' }}>
        <button type="button" className="btn btn--sm btn--primary" onClick={() => writeConsent(false, false)}>
          Essential only
        </button>
        <Link href="/legal/cookie-preferences" className="btn btn--sm">
          Preferences
        </Link>
      </div>
    </section>
  );
}
