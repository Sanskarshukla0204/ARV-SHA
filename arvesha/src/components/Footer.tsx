import Link from 'next/link';
import { FOOTER_HELP, FOOTER_PRIMARY, SITE } from '@/lib/site';

// Footer link labels are one or two words. The legal links appear on every page, as requested.
const LEGAL_LINKS = [
  { label: 'Privacy', href: '/legal/privacy-policy' },
  { label: 'Terms', href: '/legal/terms-of-service' },
  { label: 'Shipping', href: '/legal/shipping-policy' },
  { label: 'Returns', href: '/legal/return-exchange-policy' },
  { label: 'Refunds', href: '/legal/refund-policy' },
  { label: 'Cookies', href: '/legal/cookie-policy' },
  { label: 'Security', href: '/legal/security-policy' },
  { label: 'All policies', href: '/legal' },
];

export function Footer() {
  // Year in India time, so the notice never lags on 1 January.
  const year = new Intl.DateTimeFormat('en-IN', { year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date());
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', lineHeight: 1.1 }}>{SITE.name}</p>
          </div>
          <nav aria-label="Store">
            <h2>Store</h2>
            <ul>
              {FOOTER_PRIMARY.map((l) => (
                <li key={l.href}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Help">
            <h2>Help</h2>
            <ul>
              {FOOTER_HELP.map((l) => (
                <li key={l.href}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
              <li>
                <Link href="/legal/cookie-preferences">Cookie preferences</Link>
              </li>
            </ul>
          </nav>
          <nav aria-label="Policies">
            <h2>Policies</h2>
            <ul>
              {LEGAL_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="footer-base">
          <p>
            &copy; {year} {SITE.name}
          </p>
          <p>
            By{' '}
            <a href={SITE.studioUrl} target="_blank" rel="noopener noreferrer">
              {SITE.studio}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
