import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OrderActions } from '@/components/admin/AdminForms';
import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdmin } from '@/lib/admin-auth';
import { getOrderExtras } from '@/lib/admin-data';
import { formatDateTime, formatINR } from '@/lib/format';
import { PAYMENT_LABEL, PAYMENT_TAG, STATUS_LABEL, STATUS_TAG, humanizeEvent } from '@/lib/order-labels';
import { allowedNextStatuses, getOrderById, listOrderEvents } from '@/lib/orders';
import { formatPhone } from '@/lib/phone';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  const { admin, base } = await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const order = await getOrderById(id);
  if (!order) notFound();
  const [events, extras] = await Promise.all([listOrderEvents(order.id), getOrderExtras(order.id)]);
  const next = allowedNextStatuses(order.status).filter((s): s is 'processing' | 'shipped' | 'delivered' => s === 'processing' || s === 'shipped' || s === 'delivered');
  const refunded = extras.refunds.filter((r) => r.status !== 'failed').reduce((n, r) => n + r.amount_paise, 0);
  const refundable = order.paymentStatus === 'paid' || order.paymentStatus === 'partially_refunded' ? Math.max(0, order.totalPaise - refunded) : 0;
  const canCancel = order.status === 'pending_payment' || order.status === 'new' || order.status === 'processing';
  const a = order.address;
  return (
    <AdminShell base={base} current="/orders" email={admin.email} title={`Order ${order.number}`}>
      <p className="crumbs"><Link href={`${base}/orders`}>All orders</Link></p>
      <p className="row">
        <span className={`tag ${STATUS_TAG[order.status]}`}>{STATUS_LABEL[order.status]}</span>
        <span className={`tag ${PAYMENT_TAG[order.paymentStatus]}`}>{PAYMENT_LABEL[order.paymentStatus]}</span>
        <span className="muted small">Placed {formatDateTime(order.placedAt)}</span>
      </p>

      <div className="split">
        <div className="stack">
          <section className="panel glass stack" aria-labelledby="i-h">
            <h2 id="i-h">Items</h2>
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">Items</caption>
                <thead><tr><th scope="col">Item</th><th scope="col">Size</th><th scope="col">Colour</th><th scope="col">Qty</th><th scope="col">Total</th></tr></thead>
                <tbody>
                  {order.items.map((i) => (
                    <tr key={i.id}>
                      <td>{i.productId ? <Link href={`${base}/products/${i.productId}`}>{i.name}</Link> : i.name}</td>
                      <td>{i.size}</td><td>{i.color}</td><td className="num">{i.qty}</td><td className="num">{formatINR(i.lineTotalPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="totals">
              <div><dt>Subtotal</dt><dd className="num">{formatINR(order.subtotalPaise)}</dd></div>
              <div><dt>Shipping</dt><dd className="num">{order.shippingPaise === 0 ? 'Free' : formatINR(order.shippingPaise)}</dd></div>
              <div><dt><strong>Total</strong></dt><dd className="num"><strong>{formatINR(order.totalPaise)}</strong></dd></div>
              {refunded > 0 ? <div><dt>Refunded</dt><dd className="num">{formatINR(refunded)}</dd></div> : null}
            </dl>
          </section>

          <section className="panel glass stack" aria-labelledby="c-h">
            <h2 id="c-h">Customer and delivery</h2>
            <p>
              {order.contactName}<br />
              {formatPhone(order.contactPhone)}<br />
              {order.contactEmail ?? extras.customer?.email ?? 'No email'}<br />
              <span className="small muted">Customer ID {extras.customer?.public_id ?? 'guest'}</span>
            </p>
            <address style={{ fontStyle: 'normal' }}>
              {a.name}<br />{a.line1}{a.line2 ? `, ${a.line2}` : ''}{a.landmark ? `, ${a.landmark}` : ''}<br />{a.city}, {a.state} {a.pincode}<br />{formatPhone(a.phone)}
            </address>
            {order.customerNote ? <p><strong>Customer note:</strong> {order.customerNote}</p> : null}
          </section>

          <section className="panel glass stack" aria-labelledby="p-h">
            <h2 id="p-h">Payments and refunds</h2>
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">Payments and refunds</caption>
                <thead><tr><th scope="col">Type</th><th scope="col">Reference</th><th scope="col">Status</th><th scope="col">Amount</th><th scope="col">When</th></tr></thead>
                <tbody>
                  {extras.payments.length + extras.refunds.length === 0 ? <tr><td colSpan={5} className="muted">No payment attempts yet.</td></tr> : null}
                  {extras.payments.map((p, i) => (
                    <tr key={`p${i}`}><td>Payment{p.method ? ` (${p.method})` : ''}</td><td className="small">{p.razorpay_payment_id ?? 'not available'}</td><td>{p.status}{p.error_description ? `, ${p.error_description}` : ''}</td><td className="num">{formatINR(p.amount_paise)}</td><td>{formatDateTime(p.created_at)}</td></tr>
                  ))}
                  {extras.refunds.map((r, i) => (
                    <tr key={`r${i}`}><td>Refund</td><td className="small">{r.razorpay_refund_id ?? 'not available'}</td><td>{r.status}{r.reason ? `, ${r.reason}` : ''}</td><td className="num">{formatINR(r.amount_paise)}</td><td>{formatDateTime(r.created_at)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel glass stack" aria-labelledby="h-h">
            <h2 id="h-h">History</h2>
            <ol className="timeline">
              {events.map((e, i) => (
                <li key={i}><strong>{e.note ?? humanizeEvent(e.type)}</strong><br /><span className="muted small">{formatDateTime(e.createdAt)} by {e.actor}</span></li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="panel glass stack" aria-labelledby="a-h">
          <h2 id="a-h">Actions</h2>
          <OrderActions
            base={base}
            id={order.id}
            next={next}
            canCancel={canCancel}
            canRefund={refundable > 0}
            maxRefundRupees={(refundable / 100).toFixed(2)}
            carrier={order.carrier ?? ''}
            trackingNumber={order.trackingNumber ?? ''}
            trackingUrl={order.trackingUrl ?? ''}
          />
        </aside>
      </div>
    </AdminShell>
  );
}
