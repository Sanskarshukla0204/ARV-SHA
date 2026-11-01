import Link from 'next/link';
import { formatDate, formatINR, plural } from '@/lib/format';
import { listOrdersForUser } from '@/lib/orders';
import { PAYMENT_LABEL, STATUS_LABEL, STATUS_TAG } from '@/lib/order-labels';
import { NOINDEX } from '@/lib/seo';
import { requireUser } from '@/lib/session';

export const metadata = { ...NOINDEX, title: 'My orders' };
export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const user = await requireUser('/account/orders');
  const orders = await listOrdersForUser(user.id);
  return (
    <>
      <div className="page-head">
        <h1>My orders</h1>
      </div>
      {orders.length === 0 ? (
        <div className="empty">
          <p>You have not placed an order yet.</p>
          <Link href="/shop" className="btn btn--primary">Browse the shop</Link>
        </div>
      ) : (
        <ul className="stack" style={{ listStyle: 'none', padding: 0 }}>
          {orders.map((o) => (
            <li key={o.id} className="panel glass stack stack--sm">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '1.25rem' }}>
                  <Link href={`/account/orders/${o.number}`}>{o.number}</Link>
                </h2>
                <span className={`tag ${STATUS_TAG[o.status]}`}>{STATUS_LABEL[o.status]}</span>
              </div>
              <p className="muted small">
                Placed {formatDate(o.placedAt)} · {plural(o.items.reduce((n, i) => n + i.qty, 0), 'item')} · {formatINR(o.totalPaise)} · {PAYMENT_LABEL[o.paymentStatus]}
              </p>
              <p className="small">{o.items.map((i) => `${i.name} (${i.size}, ${i.color}) x ${i.qty}`).join('; ')}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
