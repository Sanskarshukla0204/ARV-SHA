import { CartProvider, type ClientCart } from '@/components/CartProvider';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { JsonLd } from '@/components/JsonLd';
import { getCartView } from '@/lib/cart';
import { absoluteUrl, SITE } from '@/lib/site';
import { getSessionUser } from '@/lib/session';

// Everything a shopper sees: header, bag, footer. The 404 and error pages sit outside this group on purpose.
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser().catch(() => null);
  const cart = await getCartView(user);
  const initial: ClientCart = {
    count: cart.count,
    subtotalPaise: cart.subtotalPaise,
    hasIssues: cart.hasIssues,
    lines: cart.lines.map((l) => ({
      variantId: l.variantId,
      slug: l.slug,
      name: l.name,
      size: l.size,
      color: l.color,
      imageUrl: l.imageUrl,
      unitPaise: l.unitPaise,
      qty: l.qty,
      stock: l.stock,
      lineTotalPaise: l.lineTotalPaise,
      available: l.available,
      issue: l.issue,
    })),
  };

  return (
    <CartProvider initial={initial}>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            { '@type': 'Organization', '@id': absoluteUrl('/#org'), name: SITE.name, url: absoluteUrl('/'), logo: absoluteUrl('/brand/icon-512.png'), sameAs: [SITE.studioUrl] },
            {
              '@type': 'WebSite',
              '@id': absoluteUrl('/#site'),
              url: absoluteUrl('/'),
              name: SITE.name,
              publisher: { '@id': absoluteUrl('/#org') },
              potentialAction: { '@type': 'SearchAction', target: `${absoluteUrl('/shop')}?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
            },
          ],
        }}
      />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header signedIn={!!user} />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </CartProvider>
  );
}
