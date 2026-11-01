import { db, isUniqueViolation, tx, type Queryable } from './db';
import { HttpError } from './http';
import { ValidationError, slugify, v, type Infer } from './validate';

// Everything the admin panel needs to create and change products. Called only from adminRoute() handlers.

const variantSchema = v.object({
  id: v.nullable(v.uuid('Variant')),
  sku: v.string({ min: 2, max: 40, pattern: /^[A-Za-z0-9][A-Za-z0-9._-]*$/, label: 'SKU', patternMessage: 'SKU may use letters, numbers, dot, hyphen and underscore.' }),
  size: v.string({ min: 1, max: 20, label: 'Size' }),
  color: v.optionalString({ max: 40, label: 'Colour' }),
  colorHex: v.nullable(v.string({ pattern: /^#[0-9a-fA-F]{6}$/, label: 'Colour code', patternMessage: 'Use a colour code like #247BA0.' })),
  price: v.nullable(v.rupees({ min: 100, label: 'Variant price' })),
  stock: v.int({ min: 0, max: 100000, label: 'Stock' }),
  active: v.bool(),
});

export const productSchema = v.object({
  name: v.string({ min: 2, max: 120, label: 'Name' }),
  slug: v.optionalString({ max: 80, pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, patternMessage: 'Use lower-case letters, numbers and hyphens.', label: 'Page address' }),
  shortDesc: v.optionalString({ max: 200, label: 'Short description' }),
  description: v.optionalString({ max: 5000, multiline: true, label: 'Description' }),
  fabric: v.optionalString({ max: 120, label: 'Fabric' }),
  fit: v.optionalString({ max: 120, label: 'Fit' }),
  care: v.optionalString({ max: 300, multiline: true, label: 'Care' }),
  origin: v.optionalString({ max: 80, label: 'Made in' }),
  details: v.array(v.object({ label: v.string({ min: 1, max: 40, label: 'Detail name' }), value: v.string({ min: 1, max: 200, label: 'Detail value' }) }), { max: 12, label: 'Details' }),
  price: v.rupees({ min: 100, label: 'Price' }),
  comparePrice: v.nullable(v.rupees({ min: 100, label: 'Compare at price' })),
  categoryId: v.nullable(v.uuid('Category')),
  status: v.oneOf(['draft', 'active', 'archived'] as const, 'Status'),
  tags: v.array(v.string({ min: 1, max: 30, label: 'Tag' }), { max: 15, label: 'Tags' }),
  seoTitle: v.optionalString({ max: 70, label: 'Search title' }),
  seoDescription: v.optionalString({ max: 160, label: 'Search description' }),
  variants: v.array(variantSchema, { min: 1, max: 60, label: 'Variants' }),
});

export type ProductInput = Infer<typeof productSchema>;

async function uniqueSlug(q: Queryable, base: string, exceptId: string | null): Promise<string> {
  const root = slugify(base) || 'product';
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const hit = await q.one(`SELECT 1 FROM products WHERE slug = $1 AND ($2::uuid IS NULL OR id <> $2::uuid)`, [candidate, exceptId]);
    if (!hit) return candidate;
  }
  throw new HttpError(500, 'slug', 'Could not create a page address for this product.');
}

function checkPublishable(input: ProductInput, imageCount: number) {
  if (input.status !== 'active') return;
  const errors: Record<string, string> = {};
  if (imageCount < 1) errors[''] = 'Add at least one photo before publishing.';
  if (!input.variants.some((x) => x.active)) errors.variants = 'Add at least one active size before publishing.';
  if (!input.description) errors.description = 'Add a description before publishing.';
  if (input.comparePrice !== null && input.comparePrice <= input.price) errors.comparePrice = 'The compare at price must be higher than the price.';
  if (Object.keys(errors).length) throw new ValidationError(errors, 'This product is not ready to publish.');
}

export async function saveProduct(id: string | null, input: ProductInput): Promise<string> {
  const dup = new Set<string>();
  for (const [i, x] of input.variants.entries()) {
    const key = `${x.size.toLowerCase()}|${(x.color ?? '').toLowerCase()}`;
    if (dup.has(key)) throw new ValidationError({ [`variants.${i}.size`]: 'This size and colour is already listed.' });
    dup.add(key);
  }
  if (input.comparePrice !== null && input.comparePrice <= input.price) throw new ValidationError({ comparePrice: 'The compare at price must be higher than the price.' });

  try {
    return await tx(async (q) => {
      let productId = id;
      const imageCount = id ? ((await q.one<{ n: number }>(`SELECT count(*)::int AS n FROM product_images WHERE product_id = $1`, [id]))?.n ?? 0) : 0;
      checkPublishable(input, imageCount);

      const slug = await uniqueSlug(q, input.slug ?? input.name, id);
      const cols = [slug, input.name, input.shortDesc ?? null, input.description ?? null, input.fabric ?? null, input.fit ?? null, input.care ?? null, input.origin ?? null,
        JSON.stringify(input.details), input.price, input.comparePrice, input.categoryId, input.status, input.tags, input.seoTitle ?? null, input.seoDescription ?? null];
      if (id) {
        const row = await q.one(
          `UPDATE products SET slug=$2, name=$3, short_desc=$4, description=$5, fabric=$6, fit=$7, care=$8, origin=$9, details=$10::jsonb, price_paise=$11,
                  compare_at_paise=$12, category_id=$13, status=$14, tags=$15, seo_title=$16, seo_description=$17,
                  published_at = CASE WHEN $14 = 'active' AND published_at IS NULL THEN now() ELSE published_at END, updated_at = now()
            WHERE id = $1 RETURNING id`,
          [id, ...cols],
        );
        if (!row) throw new HttpError(404, 'not_found', 'Product not found.');
      } else {
        const row = await q.one<{ id: string }>(
          `INSERT INTO products (slug, name, short_desc, description, fabric, fit, care, origin, details, price_paise, compare_at_paise, category_id, status, tags, seo_title, seo_description, published_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16, CASE WHEN $13 = 'active' THEN now() ELSE NULL END) RETURNING id`,
          cols,
        );
        productId = row!.id;
      }

      // Variants: update the ones that exist, add new ones, and retire the rest (deleted only if never ordered).
      const keep: string[] = [];
      for (const [i, x] of input.variants.entries()) {
        const vals = [productId, x.sku, x.size, x.color ?? '', x.colorHex, x.price, x.stock, x.active, i];
        if (x.id) {
          const r = await q.one(
            `UPDATE product_variants SET sku=$2, size=$3, color=$4, color_hex=$5, price_paise=$6, stock=$7, active=$8, sort_order=$9 WHERE id = $10 AND product_id = $1 RETURNING id`,
            [...vals, x.id],
          );
          if (!r) throw new HttpError(404, 'not_found', 'A size on this product no longer exists. Reload the page.');
          keep.push(x.id);
        } else {
          const r = await q.one<{ id: string }>(
            `INSERT INTO product_variants (product_id, sku, size, color, color_hex, price_paise, stock, active, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
            vals,
          );
          keep.push(r!.id);
        }
      }
      const gone = await q.query<{ id: string }>(`SELECT id FROM product_variants WHERE product_id = $1 AND NOT (id = ANY($2::uuid[]))`, [productId, keep]);
      for (const g of gone) {
        const ordered = await q.one(`SELECT 1 FROM order_items WHERE variant_id = $1 LIMIT 1`, [g.id]);
        if (ordered) await q.query(`UPDATE product_variants SET active = false, stock = 0 WHERE id = $1`, [g.id]);
        else await q.query(`DELETE FROM product_variants WHERE id = $1`, [g.id]);
      }
      return productId!;
    });
  } catch (err) {
    if (isUniqueViolation(err, 'sku')) throw new ValidationError({ variants: 'Another product already uses one of these SKUs.' });
    if (isUniqueViolation(err)) throw new ValidationError({ variants: 'Two sizes have the same SKU or the same size and colour.' });
    throw err;
  }
}

export async function archiveProduct(id: string): Promise<void> {
  const r = await db.one(`UPDATE products SET status = 'archived', updated_at = now() WHERE id = $1 RETURNING id`, [id]);
  if (!r) throw new HttpError(404, 'not_found', 'Product not found.');
}

export const MAX_IMAGES = 10;

export interface CategoryInput {
  name: string;
  slug?: string;
  parentId: string | null;
  description?: string;
  sortOrder: number;
  active: boolean;
}

export const categorySchema = v.object({
  name: v.string({ min: 2, max: 60, label: 'Name' }),
  slug: v.optionalString({ max: 80, pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, patternMessage: 'Use lower-case letters, numbers and hyphens.', label: 'Page address' }),
  parentId: v.nullable(v.uuid('Parent category')),
  description: v.optionalString({ max: 300, label: 'Description' }),
  sortOrder: v.int({ min: 0, max: 9999, label: 'Order' }),
  active: v.bool(),
});

export async function saveCategory(id: string | null, input: CategoryInput): Promise<string> {
  return tx(async (q) => {
    if (input.parentId) {
      if (input.parentId === id) throw new ValidationError({ parentId: 'A category cannot be inside itself.' });
      // Walk up from the chosen parent: if we meet this category, the move would make a loop. Depth is capped at 3 levels.
      let cur: string | null = input.parentId;
      let depth = 1;
      while (cur) {
        if (cur === id) throw new ValidationError({ parentId: 'A category cannot be moved inside its own subcategory.' });
        const up: { parent_id: string | null } | null = await q.one(`SELECT parent_id FROM categories WHERE id = $1`, [cur]);
        if (!up) throw new ValidationError({ parentId: 'That parent category no longer exists.' });
        cur = up.parent_id;
        if (cur) depth++;
      }
      if (depth >= 3) throw new ValidationError({ parentId: 'Categories can go three levels deep at most.' });
    }
    const base = slugify(input.slug ?? input.name) || 'category';
    let slug = base;
    for (let i = 2; await q.one(`SELECT 1 FROM categories WHERE slug = $1 AND ($2::uuid IS NULL OR id <> $2::uuid)`, [slug, id]); i++) slug = `${base}-${i}`;
    if (id) {
      const r = await q.one(`UPDATE categories SET name=$2, slug=$3, parent_id=$4, description=$5, sort_order=$6, active=$7, updated_at=now() WHERE id=$1 RETURNING id`,
        [id, input.name, slug, input.parentId, input.description ?? null, input.sortOrder, input.active]);
      if (!r) throw new HttpError(404, 'not_found', 'Category not found.');
      return id;
    }
    const r = await q.one<{ id: string }>(`INSERT INTO categories (name, slug, parent_id, description, sort_order, active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [input.name, slug, input.parentId, input.description ?? null, input.sortOrder, input.active]);
    return r!.id;
  });
}

export async function deleteCategory(id: string): Promise<void> {
  const kids = await db.one(`SELECT 1 FROM categories WHERE parent_id = $1 LIMIT 1`, [id]);
  if (kids) throw new HttpError(409, 'has_children', 'Move or delete the subcategories first.');
  const prods = await db.one(`SELECT 1 FROM products WHERE category_id = $1 LIMIT 1`, [id]);
  if (prods) throw new HttpError(409, 'has_products', 'Move the products in this category first, or switch the category off instead.');
  await db.query(`DELETE FROM categories WHERE id = $1`, [id]);
}
