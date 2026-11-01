import Link from 'next/link';
import { AdminShell, Pager } from '@/components/admin/AdminShell';
import { requireAdmin } from '@/lib/admin-auth';
import { ADMIN_PAGE_SIZE, listAdminOrders } from '@/lib/admin-data';
import { formatDateTime, formatINR } from '@/lib/format';
import { PAYMENT_LABEL, PAYMENT_TAG, STATUS_LABEL, STATUS_TAG } from '@/lib/order-labels';
import { first } from '@/lib/safe';

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminOrders({ searchParams }: { searchParams: SP }) {
  const { admin, base } = await requireAdmin();
  const sp = await searchParams;
  const status = first(sp.status) ?? '';
  const q = first(sp.q) ?? '';
  const item = first(sp.item) ?? '';
  const from = first(sp.from) ?? '';
  const to = first(sp.to) ?? '';
  const page = Math.max(1, Number.parseInt(first(sp.page) ?? '1', 10) || 1);
  const { rows, total } = await listAdminOrders({ status, q, item, from, to, page });
  return (
    <AdminShell base={base} current="/orders" email={admin.email} title="Orders">
      <form method="get" action={`${base}/orders`} className="panel glass admin-filters" role="search" aria-label="Filter orders">
        <label className="field">
          <span>Status</span>
          <select className="select" name="status" defaultValue={status}>
            <option value="">All</option>
            {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="field"><span>Item name</span><input className="input" name="item" defaultValue={item} maxLength={80} /></label>
        <label className="field"><span>Order, name, phone or email</span><input className="input" name="q" defaultValue={q} maxLength={80} /></label>
        <label className="field"><span>From</span><input className="input" type="date" name="from" defaultValue={from} /></label>
        <label className="field"><span>To</span><input className="input" type="date" name="to" defaultValue={to} /></label>
        <div className="row"><button className="btn btn--primary" type="submit">Apply filters</button><Link className="btn btn--quiet" href={`${base}/orders`}>Clear</Link></div>
      </form>
      <p className="muted">{total} {total === 1 ? 'order' : 'orders'} found</p>
      <div className="table-wrap">
        <table className="table">
          <caption className="sr-only">Orders</caption>
          <thead><tr><th scope="col">Order</th><th scope="col">Customer</th><th scope="col">Items</th><th scope="col">Status</th><th scope="col">Payment</th><th scope="col">Total</th></tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={6} className="muted">No orders match these filters.</td></tr> : rows.map((o) => (
              <tr key={o.id}>
                <td><Link href={`${base}/orders/${o.id}`}>{o.number}</Link><br /><span className="small muted">{formatDateTime(o.placedAt)}</span></td>
                <td>{o.contactName}</td>
                <td className="small">{o.items}</td>
                <td><span className={`tag ${STATUS_TAG[o.status]}`}>{STATUS_LABEL[o.status]}</span></td>
                <td><span className={`tag ${PAYMENT_TAG[o.paymentStatus]}`}>{PAYMENT_LABEL[o.paymentStatus]}</span></td>
                <td className="num">{formatINR(o.totalPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager base={base} path="/orders" params={{ status, q, item, from, to }} page={page} total={total} size={ADMIN_PAGE_SIZE} />
    </AdminShell>
  );
}
