import { ProductEditor } from '@/components/admin/AdminForms';
import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdmin } from '@/lib/admin-auth';
import { blankProduct, listAdminCategories } from '@/lib/admin-data';

export default async function NewProduct() {
  const { admin, base } = await requireAdmin();
  const cats = await listAdminCategories();
  const byId = new Map(cats.map((c) => [c.id, c.name]));
  return (
    <AdminShell base={base} current="/products" email={admin.email} title="Add new item">
      <p className="muted">Save the item first. Image upload appears on the next screen, after the item exists.</p>
      <ProductEditor base={base} initial={blankProduct()} categories={cats.map((c) => ({ id: c.id, name: c.name, parent: c.parent_id ? byId.get(c.parent_id) ?? null : null }))} />
    </AdminShell>
  );
}
