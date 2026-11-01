import { pool } from '../src/lib/db';

// Creates an empty category structure only. No products, no sample customers, no fake data.
// Edit names freely afterwards in the admin panel. Safe to run more than once.
const TREE: { name: string; slug: string; children: [string, string][] }[] = [
  { name: 'Women', slug: 'women', children: [['Tops', 'women-tops'], ['Dresses', 'women-dresses'], ['Bottoms', 'women-bottoms'], ['Outerwear', 'women-outerwear']] },
  { name: 'Men', slug: 'men', children: [['Shirts', 'men-shirts'], ['T-shirts', 'men-t-shirts'], ['Trousers', 'men-trousers'], ['Outerwear', 'men-outerwear']] },
  { name: 'Accessories', slug: 'accessories', children: [['Scarves', 'accessories-scarves'], ['Bags', 'accessories-bags']] },
];

async function main() {
  const p = pool();
  let order = 0;
  for (const top of TREE) {
    const r = await p.query<{ id: string }>(
      `INSERT INTO categories (slug, name, sort_order) VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug RETURNING id`,
      [top.slug, top.name, order++ * 10],
    );
    let sub = 0;
    for (const [name, slug] of top.children) {
      await p.query(
        `INSERT INTO categories (slug, name, parent_id, sort_order) VALUES ($1, $2, $3, $4) ON CONFLICT (slug) DO NOTHING`,
        [slug, name, r.rows[0].id, sub++ * 10],
      );
    }
  }
  console.log('Starter categories are in place.');
  await p.end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
