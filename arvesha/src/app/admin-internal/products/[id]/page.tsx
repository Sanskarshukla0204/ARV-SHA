import { notFound } from 'next/navigation';
import { ProductEditor, ProductImages } from '@/components/admin/AdminForms';
import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdmin } from '@/lib/admin-auth';
import { getEditableProduct, listAdminCategories } from '@/lib/admin-data';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { admin, base } = await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [product, cats] = await Promise.all([getEditableProduct(id), listAdminCategories()]);
  if (!product) notFound();
  const byId = new Map(cats.map((c) => [c.id, c.name]));
  const colors = [...new Set(product.variants.map((v) => v.color).filter(Boolean))];
  return (
    <AdminShell base={base} current="/products" email={admin.email} title={product.name || 'Edit item'}>
      <section className="panel glass stack" aria-labelledby="img-h">
        <h2 id="img-h">Images</h2>
        <ProductImages base={base} productId={id} images={product.images} colors={colors} />
      </section>
      <section className="panel glass stack" aria-labelledby="det-h">
        <h2 id="det-h">Details, sizes and stock</h2>
        <ProductEditor base={base} initial={product} categories={cats.map((c) => ({ id: c.id, name: c.name, parent: c.parent_id ? byId.get(c.parent_id) ?? null : null }))} />
      </section>
    </AdminShell>
  );
}
