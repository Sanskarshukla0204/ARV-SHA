import { adminRoute } from '@/lib/admin-route';
import { categorySchema, deleteCategory, saveCategory } from '@/lib/admin-products';
import { HttpError } from '@/lib/http';
import { v } from '@/lib/validate';

function cid(raw: string | undefined): string {
  const r = v.uuid('Category').run(raw);
  if (!r.ok) throw new HttpError(404, 'not_found', 'Category not found.');
  return r.value;
}

export const PATCH = adminRoute({ body: categorySchema }, async ({ body, params, log }) => {
  const id = await saveCategory(cid(params.id), body);
  await log('category.update', 'category', id, { name: body.name });
  return { ok: true };
});

export const DELETE = adminRoute({}, async ({ params, log }) => {
  const id = cid(params.id);
  await deleteCategory(id);
  await log('category.delete', 'category', id);
  return { ok: true };
});

export const dynamic = 'force-dynamic';
