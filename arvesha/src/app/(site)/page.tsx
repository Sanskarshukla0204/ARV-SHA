import Link from 'next/link';
import { ProductCard } from '@/components/ProductCard';
import { getCategoryTree, listProducts } from '@/lib/catalog';
import { safe } from '@/lib/safe';
import { getSettings } from '@/lib/settings';
import { pageMeta } from '@/lib/seo';
import { SITE } from '@/lib/site';

export const metadata = pageMeta({
  title: `${SITE.name} | Online clothing store in India`,
  description: 'Shop clothing online at Arvésha Clothing. Browse by category, choose your size and colour, and pay securely with Razorpay. Delivery across India.',
  path: '/',
});

export default async function HomePage() {
  const [tree, latest, settings] = await Promise.all([
    safe(getCategoryTree(), [], 'categories'),
    safe(listProducts({ pageSize: 8, sort: 'new' }), { items: [], total: 0, page: 1, pageSize: 8, pages: 1 }, 'latest products'),
    getSettings(),
  ]);
  const s = settings.shipping;
  const p = settings.policies;

  return (
    <div className="container">
      <div className="page-head">
        <div className="stack stack--sm">
          <h1>New arrivals</h1>
          <p className="lead muted">The latest clothing in the store. Browse by category, or open the whole shop.</p>
        </div>
        <Link href="/shop" className="btn btn--primary">
          Shop all
        </Link>
      </div>

      <div className="home-split section--tight">
        <nav aria-label="Categories">
          <ul className="index-list">
            {tree.length === 0 ? (
              <li>
                <Link href="/categories">
                  All categories
                </Link>
              </li>
            ) : (
              tree.map((c) => (
                <li key={c.id}>
                  <Link href={`/categories/${c.slug}`}>
                    <span>{c.name}</span>
                    <span className="count">{c.productCount}</span>
                  </Link>
                  {c.children.length > 0 ? (
                    <ul>
                      {c.children.map((k) => (
                        <li key={k.id}>
                          <Link href={`/categories/${k.slug}`}>{k.name}</Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </nav>

        <section aria-label="New arrivals">
          {latest.items.length === 0 ? (
            <div className="empty raised">
              <h2 style={{ fontSize: '1.75rem' }}>New pieces are on the way</h2>
              <p>The first collection is being added. You can create an account now and your bag will be waiting.</p>
              <Link href="/register" className="btn">
                Create an account
              </Link>
            </div>
          ) : (
            <div className="grid-products" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              {latest.items.map((item, i) => (
                <ProductCard key={item.id} p={item} priority={i < 4} />
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="section facts" aria-label="Delivery, returns and payment">
        <div className="glass">
          <h2 style={{ fontSize: '1.375rem' }}>Delivery</h2>
          <p className="small">
            Orders are handed to the courier within {s.dispatchDays} business days and arrive in {s.deliveryMinDays} to {s.deliveryMaxDays} days across India.
          </p>
        </div>
        <div className="glass">
          <h2 style={{ fontSize: '1.375rem' }}>Returns</h2>
          <p className="small">
            {p.returnWindowDays > 0 ? `Request a return or exchange within ${p.returnWindowDays} days of delivery.` : 'Read our return and exchange policy before you order.'} <Link href="/legal/return-exchange-policy">See the policy</Link>.
          </p>
        </div>
        <div className="glass">
          <h2 style={{ fontSize: '1.375rem' }}>Payment</h2>
          <p className="small">You pay online through Razorpay. Card and bank details are entered on their secure window and never reach this store.</p>
        </div>
      </section>
    </div>
  );
}
