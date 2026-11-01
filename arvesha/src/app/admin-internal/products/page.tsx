import Link from 'next/link';
import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdmin } from '@/lib/admin-auth';
import { listAdminProducts } from '@/lib/admin-data';
import { formatDate, formatINR } from '@/lib/format';
import { first } from '@/lib/safe';

export default async function AdminProducts({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { admin, base } = await requireAdmin();
  const sp = await searchParams;
  const status = first(sp.status) ?? '';
  const q = first(sp.q) ?? '';
  const rows = await listAdminProducts({ status, q });
  return (
    <AdminShell base={base} current="/products" email={admin.email} title="Products">
      <div className="row row--between">
        <form method="get" action={`${base}/products`} className="row" role="search" aria-label="Filter products">
          <label className="field"><span className="sr-only">Search</span><input className="input" name="q" placeholder="Search products" defaultValue={q} maxLength={80} /></label>
          <label className="field"><span className="sr-only">Status</span>
            <select className="select" name="status" defaultValue={status}>
              <option value="">All statuses</option><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option>
            </select>
          </label>
          <button className="btn" type="submit">Filter</button>
        </form>
        <Link className="btn btn--primary" href={`${base}/products/new`}>Add new item</Link>
      </div>
      <div className="table-wrap">
        <table className="table">
          <caption className="sr-only">Products</caption>
          <thead><tr><th scope="col">Item</th><th scope="col">Category</th><th scope="col">Status</th><th scope="col">Price from</th><th scope="col">Variants</th><th scope="col">Stock</th><th scope="col">Updated</th></tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={7} className="muted">No products yet. Use Add new item to create the first one.</td></tr> : rows.map((p) => (
              <tr key={p.id}>
                <td><Link href={`${base}/products/${p.id}`}>{p.name}</Link></td>
                <td>{p.category ?? 'None'}</td>
                <td><span className={`tag ${p.status === 'active' ? 'tag--ok' : p.status === 'draft' ? 'tag--warn' : 'tag--plain'}`}>{p.status}</span></td>
                <td className="num">{formatINR(p.pricePaise)}</td>
                <td className="num">{p.variants}</td>
                <td className="num">{p.stock}</td>
                <td>{formatDate(p.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
