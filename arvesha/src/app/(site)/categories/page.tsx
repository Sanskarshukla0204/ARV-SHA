import Link from 'next/link';
import { getCategoryTree, type CategoryNode } from '@/lib/catalog';
import { safe } from '@/lib/safe';
import { pageMeta, breadcrumbLd } from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';

export const metadata = pageMeta({
  title: 'Categories',
  description: 'Browse Arvésha Clothing by category and subcategory, and find the clothing you are looking for.',
  path: '/categories',
});

function Sub({ nodes }: { nodes: CategoryNode[] }) {
  return (
    <ul>
      {nodes.map((n) => (
        <li key={n.id}>
          <Link href={`/categories/${n.slug}`}>
            <span>{n.name}</span>
            <span className="muted">{n.productCount}</span>
          </Link>
          {n.children.length > 0 ? <Sub nodes={n.children} /> : null}
        </li>
      ))}
    </ul>
  );
}

export default async function CategoriesPage() {
  const tree = await safe(getCategoryTree(), [], 'categories');
  return (
    <div className="container">
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Categories', path: '/categories' }])} />
      <div className="page-head">
        <h1>Categories</h1>
        <Link href="/shop" className="btn">
          See everything
        </Link>
      </div>
      {tree.length === 0 ? (
        <div className="empty raised">
          <h2 style={{ fontSize: '1.75rem' }}>Categories are being set up</h2>
          <p>Check back soon, or browse the shop.</p>
          <Link href="/shop" className="btn">
            Browse the shop
          </Link>
        </div>
      ) : (
        <div className="cat-grid section--tight">
          {tree.map((c) => (
            <section key={c.id} className="cat-card raised" aria-labelledby={`cat-${c.id}`}>
              <h3 id={`cat-${c.id}`}>
                <Link href={`/categories/${c.slug}`}>{c.name}</Link>
              </h3>
              {c.description ? <p className="small muted">{c.description}</p> : null}
              <Link href={`/categories/${c.slug}`} className="small">
                All {c.name.toLowerCase()} ({c.productCount})
              </Link>
              {c.children.length > 0 ? <Sub nodes={c.children} /> : null}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
