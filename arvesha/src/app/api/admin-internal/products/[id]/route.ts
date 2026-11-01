import { adminRoute } from '@/lib/admin-route';
import { archiveProduct, productSchema, saveProduct } from '@/lib/admin-products';
import { HttpError } from '@/lib/http';
import { v } from '@/lib/validate';

function pid(raw: string | undefined): string {
  const r = v.uuid('Product').run(raw);
  if (!r.ok) throw new HttpError(404, 'not_found', 'Product not found.');
  return r.value;
}

export const PATCH = adminRoute({ body: productSchema }, async ({ body, params, log }) => {
  const id = await saveProduct(pid(params.id), body);
  await log('product.update', 'product', id, { name: body.name, status: body.status });
  return { ok: true, id };
});

export const DELETE = adminRoute({}, async ({ params, log }) => {
  const id = pid(params.id);
  await archiveProduct(id);
  await log('product.archive', 'product', id);
  return { ok: true };
});

export const dynamic = 'force-dynamic';
