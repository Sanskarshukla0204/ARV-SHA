import { adminRoute } from '@/lib/admin-route';
import { db } from '@/lib/db';
import { HttpError } from '@/lib/http';
import { removeStoredImage } from '@/lib/storage';
import { v } from '@/lib/validate';

const schema = v.object({ alt: v.string({ min: 1, max: 140, label: 'Description' }), color: v.optionalString({ max: 40, label: 'Colour' }) });

function ids(params: Record<string, string>) {
  const p = v.uuid('Product').run(params.id);
  const i = v.uuid('Image').run(params.imageId);
  if (!p.ok || !i.ok) throw new HttpError(404, 'not_found', 'Image not found.');
  return { productId: p.value, imageId: i.value };
}

export const PATCH = adminRoute({ body: schema }, async ({ body, params, log }) => {
  const { productId, imageId } = ids(params);
  const r = await db.one(`UPDATE product_images SET alt = $3, color = $4 WHERE id = $1 AND product_id = $2 RETURNING id`, [imageId, productId, body.alt, body.color ?? null]);
  if (!r) throw new HttpError(404, 'not_found', 'Image not found.');
  await log('product.image_update', 'product', productId);
  return { ok: true };
});

export const DELETE = adminRoute({}, async ({ params, log }) => {
  const { productId, imageId } = ids(params);
  const row = await db.one<{ url: string; url_md: string; url_sm: string }>(`DELETE FROM product_images WHERE id = $1 AND product_id = $2 RETURNING url, url_md, url_sm`, [imageId, productId]);
  if (!row) throw new HttpError(404, 'not_found', 'Image not found.');
  await removeStoredImage([row.url, row.url_md, row.url_sm]);
  // An active product must keep at least one photo.
  const left = await db.one<{ n: number }>(`SELECT count(*)::int AS n FROM product_images WHERE product_id = $1`, [productId]);
  if ((left?.n ?? 0) === 0) await db.query(`UPDATE products SET status = 'draft', updated_at = now() WHERE id = $1 AND status = 'active'`, [productId]);
  await log('product.image_delete', 'product', productId);
  return { ok: true };
});

export const dynamic = 'force-dynamic';
