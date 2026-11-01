import Link from 'next/link';
import { CookiePreferences } from '@/components/CookiePreferences';
import { formatDate } from '@/lib/format';
import { pageMeta } from '@/lib/seo';
import { LEGAL_UPDATED } from '@/lib/site';
import { LegalNav } from '@/components/LegalNav';

export const metadata = pageMeta({
  title: 'Cookie Preferences',
  description: 'Choose which optional cookies you allow on Arvésha Clothing. Change your choice at any time.',
  path: '/legal/cookie-preferences',
});

export default function CookiePreferencesPage() {
  return (
    <div className="container section">
      <div className="legal-layout">
        <LegalNav current="cookie-preferences" />
        <article className="prose stack stack--lg">
          <header className="stack stack--sm">
            <p className="crumbs"><Link href="/legal">Legal and policies</Link></p>
            <h1>Cookie Preferences</h1>
            <p className="muted small">Last updated {formatDate(LEGAL_UPDATED)}</p>
          </header>
          <p>Necessary cookies keep you logged in and keep your bag. They are always on. Optional cookies stay off unless you allow them. See the <Link href="/legal/cookie-policy">Cookie Policy</Link> for each cookie.</p>
          <CookiePreferences />
        </article>
      </div>
    </div>
  );
}
