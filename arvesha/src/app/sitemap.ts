import type { MetadataRoute } from 'next';
import { getSitemapEntries } from '@/lib/catalog';
import { absoluteUrl, LEGAL_PAGES } from '@/lib/site';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { products, categories } = await getSitemapEntries();
  const now = new Date();
  return [
    { url: absoluteUrl('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/shop'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/categories'), lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    ...categories.map((c) => ({ url: absoluteUrl(`/categories/${c.slug}`), lastModified: now, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...products.map((p) => ({ url: absoluteUrl(`/products/${p.slug}`), lastModified: p.updatedAt, changeFrequency: 'weekly' as const, priority: 0.8 })),
    { url: absoluteUrl('/support'), changeFrequency: 'yearly', priority: 0.4 },
    { url: absoluteUrl('/help'), changeFrequency: 'monthly', priority: 0.5 },
    { url: absoluteUrl('/legal'), changeFrequency: 'yearly', priority: 0.3 },
    ...LEGAL_PAGES.map((l) => ({ url: absoluteUrl(`/legal/${l.slug}`), changeFrequency: 'yearly' as const, priority: 0.3 })),
  ];
}
