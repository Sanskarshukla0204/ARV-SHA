import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CatalogView } from '@/components/CatalogView';
import { JsonLd } from '@/components/JsonLd';
import { descendantIds, getCategoryBySlug } from '@/lib/catalog';
import { breadcrumbLd, pageMeta } from '@/lib/seo';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const found = await getCategoryBySlug(slug).catch(() => null);
  if (!found) return { title: 'Category not found', robots: { index: false } };
  const n = found.node;
  return pageMeta({
    title: `${n.name} clothing`,
    description: n.description || `Shop ${n.name.toLowerCase()} at Arvésha Clothing. Filter by size, colour and price and pay securely online.`,
    path: `/categories/${n.slug}`,
    noindex: Object.keys(sp).length > 0,
  });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const found = await getCategoryBySlug(slug).catch(() => null);
  if (!found) notFound();
  const { node, trail } = found;

  return (
    <div className="container">
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Categories', path: '/categories' }, ...trail.map((t) => ({ name: t.name, path: `/categories/${t.slug}` }))])} />
      <div className="page-head">
        <div>
          <ol className="crumbs" aria-label="Breadcrumb">
            <li>
              <Link href="/categories">Categories</Link>
            </li>
            {trail.slice(0, -1).map((t) => (
              <li key={t.id}>
                <Link href={`/categories/${t.slug}`}>{t.name}</Link>
              </li>
            ))}
            <li aria-current="page">{node.name}</li>
          </ol>
          <h1>{node.name}</h1>
          {node.description ? <p className="lead muted" style={{ marginTop: '0.75rem' }}>{node.description}</p> : null}
        </div>
      </div>
      {node.children.length > 0 ? (
        <nav aria-label={`Subcategories of ${node.name}`} className="chips" style={{ marginBottom: '2rem' }}>
          {node.children.map((c) => (
            <Link key={c.id} href={`/categories/${c.slug}`} className="btn btn--sm">
              {c.name} ({c.productCount})
            </Link>
          ))}
        </nav>
      ) : null}
      <CatalogView basePath={`/categories/${node.slug}`} categoryIds={descendantIds(node)} searchParams={sp} emptyText={`There is nothing in ${node.name} yet.`} />
    </div>
  );
}
