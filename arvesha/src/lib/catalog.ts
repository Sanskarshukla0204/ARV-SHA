import { cache } from 'react';
import { db, likePattern } from './db';

// Read-side queries for the storefront. Only active products and active categories are ever returned here.
// Admin screens use their own queries so drafts and archived items never leak to customers.

export interface ImageRef {
  sm: string;
  md: string;
  lg?: string;
  width: number;
  height: number;
  alt: string;
  color?: string | null;
}

export interface CategoryNode {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  /** Active products in this category and everything below it. */
  productCount: number;
  children: CategoryNode[];
}

export interface ProductCard {
  id: string;
  slug: string;
  name: string;
  pricePaise: number;
  comparePaise: number | null;
  image: ImageRef | null;
  image2: ImageRef | null;
  colors: { name: string; hex: string | null }[];
  inStock: boolean;
  categorySlug: string | null;
  categoryName: string | null;
}

export interface VariantRef {
  id: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string | null;
  pricePaise: number;
  stock: number;
}

export interface ProductDetail extends ProductCard {
  shortDesc: string | null;
  description: string | null;
  fabric: string | null;
  fit: string | null;
  care: string | null;
  origin: string | null;
  details: { label: string; value: string }[];
  images: ImageRef[];
  variants: VariantRef[];
  tags: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  categoryId: string | null;
  breadcrumb: { name: string; slug: string }[];
  publishedAt: Date | null;
  updatedAt: Date;
}

// ------------------------------------------------------------------ categories

interface CategoryRow {
  id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  direct_count: number;
}

/** The full active category tree with rolled-up product counts. Cached per request. */
export const getCategoryTree = cache(async (): Promise<CategoryNode[]> => {
  let rows: CategoryRow[] = [];
  try {
    rows = await db.query<CategoryRow>(
      `SELECT c.id, c.parent_id, c.slug, c.name, c.description, c.image_url,
              (SELECT count(*) FROM products p WHERE p.category_id = c.id AND p.status = 'active')::int AS direct_count
         FROM categories c
        WHERE c.active
        ORDER BY c.sort_order, c.name`,
    );
  } catch (err) {
    console.error('[catalog] categories unavailable', (err as Error).message);
    return [];
  }
  const byId = new Map<string, CategoryNode & { direct: number }>();
  for (const r of rows) {
    byId.set(r.id, {
      id: r.id,
      parentId: r.parent_id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      imageUrl: r.image_url,
      productCount: 0,
      children: [],
      direct: r.direct_count,
    });
  }
  const roots: CategoryNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else if (!node.parentId) roots.push(node);
    // A child whose parent is inactive is hidden along with it.
  }
  const roll = (n: CategoryNode & { direct?: number }): number => {
    const total = (n.direct ?? 0) + n.children.reduce((s, c) => s + roll(c), 0);
    n.productCount = total;
    return total;
  };
  roots.forEach(roll);
  return roots;
});

export function flattenCategories(tree: CategoryNode[]): CategoryNode[] {
  const out: CategoryNode[] = [];
  const walk = (n: CategoryNode) => {
    out.push(n);
    n.children.forEach(walk);
  };
  tree.forEach(walk);
  return out;
}

export function descendantIds(node: CategoryNode): string[] {
  const ids = [node.id];
  for (const c of node.children) ids.push(...descendantIds(c));
  return ids;
}

export async function getCategoryBySlug(slug: string): Promise<{ node: CategoryNode; trail: CategoryNode[] } | null> {
  const tree = await getCategoryTree();
  const flat = flattenCategories(tree);
  const node = flat.find((c) => c.slug === slug);
  if (!node) return null;
  const trail: CategoryNode[] = [];
  let cur: CategoryNode | undefined = node;
  while (cur) {
    trail.unshift(cur);
    cur = cur.parentId ? flat.find((c) => c.id === cur!.parentId) : undefined;
  }
  return { node, trail };
}

// -------------------------------------------------------------------- products

interface CardRow {
  id: string;
  slug: string;
  name: string;
  price_paise: number;
  compare_at_paise: number | null;
  category_slug: string | null;
  category_name: string | null;
  image: { url_sm: string; url_md: string; width: number; height: number; alt: string } | null;
  image2: { url_sm: string; url_md: string; width: number; height: number; alt: string } | null;
  colors: { name: string; hex: string | null }[] | null;
  in_stock: boolean;
}

const CARD_SELECT = `
  SELECT p.id, p.slug, p.name, p.price_paise, p.compare_at_paise,
         c.slug AS category_slug, c.name AS category_name,
         (SELECT row_to_json(i) FROM (SELECT url_sm, url_md, width, height, alt FROM product_images
            WHERE product_id = p.id ORDER BY sort_order, created_at LIMIT 1) i) AS image,
         (SELECT row_to_json(i) FROM (SELECT url_sm, url_md, width, height, alt FROM product_images
            WHERE product_id = p.id ORDER BY sort_order, created_at OFFSET 1 LIMIT 1) i) AS image2,
         COALESCE((SELECT json_agg(json_build_object('name', cv.color, 'hex', cv.color_hex) ORDER BY cv.color)
                     FROM (SELECT DISTINCT ON (color) color, color_hex FROM product_variants
                            WHERE product_id = p.id AND active AND color <> '' ORDER BY color) cv), '[]'::json) AS colors,
         EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.active AND v.stock > 0) AS in_stock
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id`;

function toCard(r: CardRow): ProductCard {
  const img = (i: CardRow['image']): ImageRef | null =>
    i ? { sm: i.url_sm, md: i.url_md, width: i.width, height: i.height, alt: i.alt } : null;
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    pricePaise: r.price_paise,
    comparePaise: r.compare_at_paise,
    image: img(r.image),
    image2: img(r.image2),
    colors: r.colors ?? [],
    inStock: r.in_stock,
    categorySlug: r.category_slug,
    categoryName: r.category_name,
  };
}

export type SortKey = 'new' | 'price-asc' | 'price-desc' | 'name';

export interface ProductFilters {
  categoryIds?: string[];
  q?: string;
  minPaise?: number;
  maxPaise?: number;
  sizes?: string[];
  colors?: string[];
  inStockOnly?: boolean;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
  ids?: string[];
}

export interface ProductPage {
  items: ProductCard[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

const ORDER: Record<SortKey, string> = {
  new: 'p.published_at DESC NULLS LAST, p.created_at DESC',
  'price-asc': 'p.price_paise ASC, p.name ASC',
  'price-desc': 'p.price_paise DESC, p.name ASC',
  name: 'p.name ASC',
};

export async function listProducts(f: ProductFilters = {}): Promise<ProductPage> {
  const where: string[] = [`p.status = 'active'`];
  const params: unknown[] = [];
  const add = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  if (f.ids?.length) where.push(`p.id = ANY(${add(f.ids)}::uuid[])`);
  if (f.categoryIds?.length) where.push(`p.category_id = ANY(${add(f.categoryIds)}::uuid[])`);
  if (f.q) {
    const pat = add(likePattern(f.q.slice(0, 80)));
    where.push(
      `(p.name ILIKE ${pat} OR p.short_desc ILIKE ${pat} OR c.name ILIKE ${pat} OR EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE t ILIKE ${pat}))`,
    );
  }
  if (typeof f.minPaise === 'number') where.push(`p.price_paise >= ${add(f.minPaise)}`);
  if (typeof f.maxPaise === 'number') where.push(`p.price_paise <= ${add(f.maxPaise)}`);
  if (f.sizes?.length) {
    where.push(`EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.active AND v.size = ANY(${add(f.sizes)}::text[]))`);
  }
  if (f.colors?.length) {
    where.push(`EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.active AND v.color = ANY(${add(f.colors)}::text[]))`);
  }
  if (f.inStockOnly) {
    where.push(`EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.active AND v.stock > 0)`);
  }

  const pageSize = Math.min(Math.max(f.pageSize ?? 24, 1), 60);
  const page = Math.max(f.page ?? 1, 1);
  const whereSql = where.join(' AND ');

  const countRow = await db.one<{ n: number }>(
    `SELECT count(*)::int AS n FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE ${whereSql}`,
    params,
  );
  const total = countRow?.n ?? 0;

  const limitParam = add(pageSize);
  const offsetParam = add((page - 1) * pageSize);
  const rows = await db.query<CardRow>(
    `${CARD_SELECT} WHERE ${whereSql} ORDER BY ${ORDER[f.sort ?? 'new']} LIMIT ${limitParam} OFFSET ${offsetParam}`,
    params,
  );
  return { items: rows.map(toCard), total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export interface Facets {
  sizes: string[];
  colors: { name: string; hex: string | null }[];
  minPaise: number;
  maxPaise: number;
}

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL', 'Free size', 'One size'];

export async function getFacets(categoryIds?: string[]): Promise<Facets> {
  const params: unknown[] = [];
  let cat = '';
  if (categoryIds?.length) {
    params.push(categoryIds);
    cat = `AND p.category_id = ANY($1::uuid[])`;
  }
  const variants = await db.query<{ size: string; color: string; color_hex: string | null }>(
    `SELECT DISTINCT v.size, v.color, v.color_hex
       FROM product_variants v JOIN products p ON p.id = v.product_id
      WHERE p.status = 'active' AND v.active ${cat}`,
    params,
  );
  const price = await db.one<{ lo: number | null; hi: number | null }>(
    `SELECT min(p.price_paise)::int AS lo, max(p.price_paise)::int AS hi FROM products p WHERE p.status = 'active' ${cat}`,
    params,
  );
  const sizes = [...new Set(variants.map((v) => v.size))].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a);
    const ib = SIZE_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b, 'en', { numeric: true });
  });
  const seen = new Map<string, string | null>();
  for (const v of variants) if (v.color && !seen.has(v.color)) seen.set(v.color, v.color_hex);
  const colors = [...seen.entries()].map(([name, hex]) => ({ name, hex })).sort((a, b) => a.name.localeCompare(b.name));
  return { sizes, colors, minPaise: price?.lo ?? 0, maxPaise: price?.hi ?? 0 };
}

interface DetailRow {
  id: string;
  slug: string;
  name: string;
  short_desc: string | null;
  description: string | null;
  fabric: string | null;
  fit: string | null;
  care: string | null;
  origin: string | null;
  details: { label: string; value: string }[] | null;
  price_paise: number;
  compare_at_paise: number | null;
  category_id: string | null;
  tags: string[] | null;
  seo_title: string | null;
  seo_description: string | null;
  published_at: Date | null;
  updated_at: Date;
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const p = await db.one<DetailRow>(
    `SELECT id, slug, name, short_desc, description, fabric, fit, care, origin, details, price_paise, compare_at_paise,
            category_id, tags, seo_title, seo_description, published_at, updated_at
       FROM products WHERE slug = $1 AND status = 'active'`,
    [slug],
  );
  if (!p) return null;

  const [images, variants, card] = await Promise.all([
    db.query<{ url: string; url_md: string; url_sm: string; width: number; height: number; alt: string; color: string | null }>(
      `SELECT url, url_md, url_sm, width, height, alt, color FROM product_images WHERE product_id = $1 ORDER BY sort_order, created_at`,
      [p.id],
    ),
    db.query<{ id: string; sku: string; size: string; color: string; color_hex: string | null; price_paise: number | null; stock: number }>(
      `SELECT id, sku, size, color, color_hex, price_paise, stock FROM product_variants
        WHERE product_id = $1 AND active ORDER BY sort_order, color, size`,
      [p.id],
    ),
    db.one<CardRow>(`${CARD_SELECT} WHERE p.id = $1`, [p.id]),
  ]);

  const tree = await getCategoryTree();
  const flat = flattenCategories(tree);
  const breadcrumb: { name: string; slug: string }[] = [];
  let cur = p.category_id ? flat.find((c) => c.id === p.category_id) : undefined;
  while (cur) {
    breadcrumb.unshift({ name: cur.name, slug: cur.slug });
    const parentId: string | null = cur.parentId;
    cur = parentId ? flat.find((c) => c.id === parentId) : undefined;
  }

  const base = card ? toCard(card) : null;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    pricePaise: p.price_paise,
    comparePaise: p.compare_at_paise,
    image: base?.image ?? null,
    image2: base?.image2 ?? null,
    colors: base?.colors ?? [],
    inStock: base?.inStock ?? false,
    categorySlug: base?.categorySlug ?? null,
    categoryName: base?.categoryName ?? null,
    shortDesc: p.short_desc,
    description: p.description,
    fabric: p.fabric,
    fit: p.fit,
    care: p.care,
    origin: p.origin,
    details: Array.isArray(p.details) ? p.details : [],
    images: images.map((i) => ({ sm: i.url_sm, md: i.url_md, lg: i.url, width: i.width, height: i.height, alt: i.alt, color: i.color })),
    variants: variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      size: v.size,
      color: v.color,
      colorHex: v.color_hex,
      pricePaise: v.price_paise ?? p.price_paise,
      stock: v.stock,
    })),
    tags: p.tags ?? [],
    seoTitle: p.seo_title,
    seoDescription: p.seo_description,
    categoryId: p.category_id,
    breadcrumb,
    publishedAt: p.published_at,
    updatedAt: p.updated_at,
  };
}

export async function getRelatedProducts(productId: string, categoryId: string | null, limit = 4): Promise<ProductCard[]> {
  if (!categoryId) {
    const page = await listProducts({ pageSize: limit + 1 });
    return page.items.filter((p) => p.id !== productId).slice(0, limit);
  }
  const rows = await db.query<CardRow>(
    `${CARD_SELECT} WHERE p.status = 'active' AND p.category_id = $1 AND p.id <> $2
      ORDER BY p.published_at DESC NULLS LAST LIMIT $3`,
    [categoryId, productId, limit],
  );
  return rows.map(toCard);
}

export async function searchSuggestions(q: string, limit = 6): Promise<{ products: ProductCard[]; categories: { name: string; slug: string }[] }> {
  const term = q.trim().slice(0, 60);
  if (term.length < 2) return { products: [], categories: [] };
  const [page, tree] = await Promise.all([listProducts({ q: term, pageSize: limit }), getCategoryTree()]);
  const lc = term.toLowerCase();
  const categories = flattenCategories(tree)
    .filter((c) => c.name.toLowerCase().includes(lc))
    .slice(0, 4)
    .map((c) => ({ name: c.name, slug: c.slug }));
  return { products: page.items, categories };
}

export async function getSitemapEntries(): Promise<{ products: { slug: string; updatedAt: Date }[]; categories: { slug: string }[] }> {
  try {
    const [products, categories] = await Promise.all([
      db.query<{ slug: string; updated_at: Date }>(`SELECT slug, updated_at FROM products WHERE status = 'active' ORDER BY updated_at DESC LIMIT 5000`),
      db.query<{ slug: string }>(`SELECT slug FROM categories WHERE active ORDER BY sort_order`),
    ]);
    return { products: products.map((p) => ({ slug: p.slug, updatedAt: p.updated_at })), categories };
  } catch {
    return { products: [], categories: [] };
  }
}
