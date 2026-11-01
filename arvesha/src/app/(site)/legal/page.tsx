import Link from 'next/link';
import { pageMeta } from '@/lib/seo';
import { LEGAL_GROUPS, LEGAL_PAGES, LEGAL_UPDATED } from '@/lib/site';
import { formatDate } from '@/lib/format';

export const metadata = pageMeta({
  title: 'Legal and policies',
  description: 'Privacy, terms, shipping, returns, refunds, cookies, security and every other policy of Arvésha Clothing in one place.',
  path: '/legal',
});

export default function LegalHub() {
  return (
    <div className="container section">
      <div className="page-head">
        <h1>Legal and policies</h1>
        <p className="lead">Everything that governs how we handle your data and your orders. Last updated {formatDate(LEGAL_UPDATED)}.</p>
      </div>
      <div className="legal-grid">
        {LEGAL_GROUPS.map((g) => (
          <section key={g} className="stack stack--sm" aria-labelledby={`g-${g.replace(/\W+/g, '-')}`}>
            <h2 id={`g-${g.replace(/\W+/g, '-')}`} style={{ fontSize: '1.5rem' }}>{g}</h2>
            <ul className="stack stack--sm" style={{ listStyle: 'none', padding: 0 }}>
              {LEGAL_PAGES.filter((p) => p.group === g).map((p) => (
                <li key={p.slug} className="panel glass stack stack--sm">
                  <h3 style={{ fontSize: '1.125rem' }}><Link href={`/legal/${p.slug}`}>{p.title}</Link></h3>
                  <p className="small muted">{p.summary}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
