import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/JsonLd';
import { ProductCard } from '@/components/ProductCard';
import { ProductView } from '@/components/ProductView';
import { getProductBySlug, getRelatedProducts } from '@/lib/catalog';
import { getSettings } from '@/lib/settings';
import { breadcrumbLd, pageMeta } from '@/lib/seo';
import { absoluteUrl, SITE } from '@/lib/site';
import { safe } from '@/lib/safe';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const p = await getProductBySlug(slug).catch(() => null);
  if (!p) return { title: 'Product not found', robots: { index: false } };
  const desc = p.seoDescription || p.shortDesc || p.description?.slice(0, 160) || `${p.name} at ${SITE.name}.`;
  return pageMeta({ title: p.seoTitle || p.name, description: desc, path: `/products/${p.slug}`, image: p.images[0]?.lg ?? p.images[0]?.md ?? null, type: 'article' });
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const p = await getProductBySlug(slug).catch(() => null);
  if (!p) notFound();
  const [related, settings] = await Promise.all([safe(getRelatedProducts(p.id, p.categoryId, 4), [], 'related products'), getSettings()]);

  const inStock = p.variants.some((v) => v.stock > 0);
  const prices = p.variants.map((v) => v.pricePaise);
  const low = Math.min(...(prices.length ? prices : [p.pricePaise]));
  const high = Math.max(...(prices.length ? prices : [p.pricePaise]));
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description ?? p.shortDesc ?? undefined,
    image: p.images.map((i) => i.lg ?? i.md),
    sku: p.variants[0]?.sku,
    brand: { '@type': 'Brand', name: SITE.name },
    category: p.categoryName ?? undefined,
    material: p.fabric ?? undefined,
    url: absoluteUrl(`/products/${p.slug}`),
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'INR',
      lowPrice: (low / 100).toFixed(2),
      highPrice: (high / 100).toFixed(2),
      offerCount: p.variants.length,
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: absoluteUrl(`/products/${p.slug}`),
    },
  };

  const specs = [
    p.fabric ? { label: 'Fabric', value: p.fabric } : null,
    p.fit ? { label: 'Fit', value: p.fit } : null,
    p.origin ? { label: 'Made in', value: p.origin } : null,
    ...p.details,
  ].filter((x): x is { label: string; value: string } => !!x);

  return (
    <div className="container">
      <JsonLd data={ld} />
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, ...p.breadcrumb.map((b) => ({ name: b.name, path: `/categories/${b.slug}` })), { name: p.name, path: `/products/${p.slug}` }])} />
      <ol className="crumbs" aria-label="Breadcrumb" style={{ marginTop: '1.5rem' }}>
        <li>
          <Link href="/shop">Shop</Link>
        </li>
        {p.breadcrumb.map((b) => (
          <li key={b.slug}>
            <Link href={`/categories/${b.slug}`}>{b.name}</Link>
          </li>
        ))}
        <li aria-current="page">{p.name}</li>
      </ol>

      <ProductView name={p.name} shortDesc={p.shortDesc} pricePaise={p.pricePaise} comparePaise={p.comparePaise} images={p.images} variants={p.variants}>
        <div style={{ marginTop: '0.5rem' }}>
          {p.description ? (
            <details className="disclosure" open>
              <summary>Description</summary>
              <div>
                <p style={{ whiteSpace: 'pre-line' }}>{p.description}</p>
              </div>
            </details>
          ) : null}
          {specs.length > 0 ? (
            <details className="disclosure">
              <summary>Details</summary>
              <div>
                <dl className="spec">
                  {specs.map((s) => (
                    <div key={s.label} style={{ display: 'contents' }}>
                      <dt>{s.label}</dt>
                      <dd>{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </details>
          ) : null}
          {p.care ? (
            <details className="disclosure">
              <summary>Care</summary>
              <div>
                <p style={{ whiteSpace: 'pre-line' }}>{p.care}</p>
              </div>
            </details>
          ) : null}
          <details className="disclosure">
            <summary>Delivery and returns</summary>
            <div>
              <p>
                We ship within {settings.shipping.dispatchDays} business days and delivery takes {settings.shipping.deliveryMinDays} to {settings.shipping.deliveryMaxDays} days.
                {settings.policies.returnWindowDays > 0 ? ` You can request a return or exchange within ${settings.policies.returnWindowDays} days of delivery.` : ''} Read the{' '}
                <Link href="/legal/shipping-policy">shipping policy</Link> and the <Link href="/legal/return-exchange-policy">return and exchange policy</Link>.
              </p>
            </div>
          </details>
        </div>
      </ProductView>

      {related.length > 0 ? (
        <section className="section" aria-labelledby="related">
          <h2 id="related" style={{ marginBottom: '1.5rem' }}>
            More to look at
          </h2>
          <div className="grid-products">
            {related.map((r) => (
              <ProductCard key={r.id} p={r} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
