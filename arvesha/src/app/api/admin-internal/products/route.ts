import { adminRoute } from '@/lib/admin-route';
import { productSchema, saveProduct } from '@/lib/admin-products';

export const POST = adminRoute({ body: productSchema }, async ({ body, log }) => {
  const id = await saveProduct(null, body);
  await log('product.create', 'product', id, { name: body.name, status: body.status });
  return { ok: true, id };
});

export const dynamic = 'force-dynamic';
