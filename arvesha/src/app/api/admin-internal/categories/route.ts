import { adminRoute } from '@/lib/admin-route';
import { categorySchema, saveCategory } from '@/lib/admin-products';

export const POST = adminRoute({ body: categorySchema }, async ({ body, log }) => {
  const id = await saveCategory(null, body);
  await log('category.create', 'category', id, { name: body.name });
  return { ok: true, id };
});

export const dynamic = 'force-dynamic';
