import { CategoryManager } from '@/components/admin/AdminForms';
import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdmin } from '@/lib/admin-auth';
import { listAdminCategories } from '@/lib/admin-data';

export default async function AdminCategories() {
  const { admin, base } = await requireAdmin();
  const cats = await listAdminCategories();
  return (
    <AdminShell base={base} current="/categories" email={admin.email} title="Categories">
      <p className="muted">Categories can sit inside other categories up to three levels deep. A category with items or sub-categories cannot be deleted; hide it instead.</p>
      <CategoryManager base={base} categories={cats} />
    </AdminShell>
  );
}
