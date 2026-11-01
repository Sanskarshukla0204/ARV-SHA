import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/JsonLd';
import { formatDate } from '@/lib/format';
import { legalContent } from '@/lib/legal-content';
import { breadcrumbLd, pageMeta } from '@/lib/seo';
import { getSettings } from '@/lib/settings';
import { LegalNav } from '@/components/LegalNav';
import { LEGAL_PAGES, LEGAL_UPDATED, legalMeta } from '@/lib/site';

export const revalidate = 300;
export const dynamicParams = false;

export function generateStaticParams() {
  return LEGAL_PAGES.filter((p) => p.slug !== 'cookie-preferences').map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = legalMeta(slug);
  if (!m) return {};
  return pageMeta({ title: m.title, description: m.summary, path: `/legal/${m.slug}` });
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const meta = legalMeta(slug);
  if (!meta) notFound();
  const settings = await getSettings();
  const blocks = legalContent(slug, settings);
  if (!blocks) notFound();
  return (
    <div className="container section">
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Legal', path: '/legal' }, { name: meta.title, path: `/legal/${slug}` }])} />
      <div className="legal-layout">
        <LegalNav current={slug} />
        <article className="prose stack stack--lg">
          <header className="stack stack--sm">
            <p className="crumbs"><Link href="/legal">Legal and policies</Link></p>
            <h1>{meta.title}</h1>
            <p className="muted small">Last updated {formatDate(LEGAL_UPDATED)}</p>
          </header>
          {blocks.map((b) => (
            <section key={b.h} className="stack stack--sm">
              <h2 style={{ fontSize: '1.5rem' }}>{b.h}</h2>
              {b.p?.map((t, i) => <p key={i}>{t}</p>)}
              {b.ul ? <ul>{b.ul.map((t, i) => <li key={i}>{t}</li>)}</ul> : null}
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
