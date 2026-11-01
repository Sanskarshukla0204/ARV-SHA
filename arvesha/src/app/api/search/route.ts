import { searchSuggestions } from '@/lib/catalog';
import { route } from '@/lib/http';

export const GET = route({ limits: [{ name: 'search', max: 90, windowSec: 60 }] }, async ({ query }) => {
  const r = await searchSuggestions(query.get('q') ?? '', 6);
  return { products: r.products.map((p) => ({ name: p.name, slug: p.slug, pricePaise: p.pricePaise })), categories: r.categories };
});

export const dynamic = 'force-dynamic';
