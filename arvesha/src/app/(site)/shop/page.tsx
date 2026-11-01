import { CatalogView } from '@/components/CatalogView';
import { pageMeta } from '@/lib/seo';
import { first } from '@/lib/safe';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props) {
  const sp = await searchParams;
  const q = first(sp.q)?.trim().slice(0, 60);
  const filtered = Object.keys(sp).some((k) => k !== 'page');
  return pageMeta({
    title: q ? `Search results for ${q}` : 'Shop all clothing',
    description: q ? `Clothing matching ${q} at Arvésha Clothing.` : 'Browse all clothing at Arvésha Clothing. Filter by size, colour and price, and pay securely online.',
    path: '/shop',
    noindex: filtered,
  });
}

export default async function ShopPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = first(sp.q)?.trim().slice(0, 80);
  return (
    <div className="container">
      <div className="page-head">
        <h1>{q ? `Results for "${q}"` : 'Shop'}</h1>
      </div>
      <CatalogView basePath="/shop" searchParams={sp} />
    </div>
  );
}
