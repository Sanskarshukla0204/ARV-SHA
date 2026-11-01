import type { Metadata } from 'next';
import { absoluteUrl, SITE } from './site';

/** Consistent per-page metadata: title, description, canonical URL, Open Graph and Twitter cards. */
export function pageMeta(opts: {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  noindex?: boolean;
  type?: 'website' | 'article';
}): Metadata {
  const url = absoluteUrl(opts.path);
  const image = opts.image ? (opts.image.startsWith('http') ? opts.image : absoluteUrl(opts.image)) : absoluteUrl('/brand/og.png');
  const description = opts.description.length > 160 ? `${opts.description.slice(0, 157).trimEnd()}...` : opts.description;
  return {
    title: opts.title,
    description,
    alternates: { canonical: url },
    robots: opts.noindex ? { index: false, follow: false, nocache: true } : { index: true, follow: true },
    openGraph: {
      title: opts.title,
      description,
      url,
      siteName: SITE.name,
      locale: SITE.locale,
      type: opts.type ?? 'website',
      images: [{ url: image, width: 1200, height: 630, alt: opts.title }],
    },
    twitter: { card: 'summary_large_image', title: opts.title, description, images: [image] },
  };
}

export const NOINDEX: Metadata = { robots: { index: false, follow: false, nocache: true } };

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
  };
}

/** Escapes the characters that could end the script block early, so structured data can never break out of its tag. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
