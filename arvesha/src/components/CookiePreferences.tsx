'use client';

import { useEffect, useState } from 'react';
import { CheckField, Notice } from './forms';
import { readConsent, writeConsent } from './ConsentNotice';

export function CookiePreferences() {
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const c = readConsent();
    if (c) {
      setAnalytics(c.analytics);
      setMarketing(c.marketing);
    }
  }, []);
  return (
    <form
      className="stack panel glass"
      onSubmit={(e) => {
        e.preventDefault();
        writeConsent(analytics, marketing);
        setSaved(true);
      }}
    >
      {saved ? <Notice tone="ok">Your choice is saved.</Notice> : null}
      <CheckField name="necessary" checked onChange={() => undefined}>Necessary cookies (always on)</CheckField>
      <CheckField name="analytics" checked={analytics} onChange={(v) => { setSaved(false); setAnalytics(v); }}>Analytics cookies</CheckField>
      <CheckField name="marketing" checked={marketing} onChange={(v) => { setSaved(false); setMarketing(v); }}>Marketing cookies</CheckField>
      <p className="small muted">We do not use analytics or marketing cookies today. Your choice is recorded so that nothing optional is switched on without your permission if that changes.</p>
      <div>
        <button type="submit" className="btn btn--primary">Save my choice</button>
      </div>
    </form>
  );
}
