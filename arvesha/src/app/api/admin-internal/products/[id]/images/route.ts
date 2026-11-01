import { adminRoute } from '@/lib/admin-route';
import { MAX_IMAGES } from '@/lib/admin-products';
import { db } from '@/lib/db';
import { HttpError } from '@/lib/http';
import { MAX_UPLOAD_BYTES, storeProductImage } from '@/lib/storage';
import { v } from '@/lib/validate';

// One image per request keeps each upload under the hosting body limit. The browser sends them one after another.
export const POST = adminRoute({ multipart: true, perMinute: 60 }, async ({ req, params, log }) => {
  const id = v.uuid('Product').run(params.id);
  if (!id.ok) throw new HttpError(404, 'not_found', 'Product not found.');
  const product = await db.one<{ name: string }>(`SELECT name FROM products WHERE id = $1`, [id.value]);
  if (!product) throw new HttpError(404, 'not_found', 'Product not found.');

  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > MAX_UPLOAD_BYTES + 64 * 1024) throw new HttpError(413, 'too_large', 'Each image must be 4 MB or smaller.');
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) throw new HttpError(422, 'invalid_image', 'Choose an image to upload.');
  const alt = String(form?.get('alt') ?? '').replace(/[\u0000-\u001F]/g, '').trim().slice(0, 140) || product.name;

  const count = await db.one<{ n: number; next: number }>(`SELECT count(*)::int AS n, COALESCE(max(sort_order), -1) + 1 AS next FROM product_images WHERE product_id = $1`, [id.value]);
  if ((count?.n ?? 0) >= MAX_IMAGES) throw new HttpError(409, 'too_many', `A product can have up to ${MAX_IMAGES} photos.`);

  const img = await storeProductImage(Buffer.from(await file.arrayBuffer()));
  const row = await db.one<{ id: string }>(
    `INSERT INTO product_images (product_id, url, url_md, url_sm, width, height, alt, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [id.value, img.url, img.urlMd, img.urlSm, img.width, img.height, alt, count?.next ?? 0],
  );
  await db.query(`UPDATE products SET updated_at = now() WHERE id = $1`, [id.value]);
  await log('product.image_add', 'product', id.value);
  return { ok: true, image: { id: row!.id, url: img.urlSm, alt } };
});

const orderSchema = v.object({ order: v.array(v.uuid('Image'), { min: 1, max: 20, label: 'Order' }) });

export const PATCH = adminRoute({ body: orderSchema }, async ({ body, params, log }) => {
  const id = v.uuid('Product').run(params.id);
  if (!id.ok) throw new HttpError(404, 'not_found', 'Product not found.');
  for (const [i, imageId] of body.order.entries()) {
    await db.query(`UPDATE product_images SET sort_order = $3 WHERE id = $1 AND product_id = $2`, [imageId, id.value, i]);
  }
  await db.query(`UPDATE products SET updated_at = now() WHERE id = $1`, [id.value]);
  await log('product.image_reorder', 'product', id.value);
  return { ok: true };
});

export const dynamic = 'force-dynamic';
