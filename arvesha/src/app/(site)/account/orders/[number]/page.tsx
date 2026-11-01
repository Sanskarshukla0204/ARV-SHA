import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CancelOrderButton } from '@/components/AccountForms';
import { PendingPoller } from '@/components/PendingPoller';
import { formatDate, formatDateTime, formatINR } from '@/lib/format';
import { getOrderForUser, listOrderEvents } from '@/lib/orders';
import { PAYMENT_LABEL, PAYMENT_TAG, STATUS_LABEL, STATUS_TAG, humanizeEvent } from '@/lib/order-labels';
import { formatPhone } from '@/lib/phone';
import { NOINDEX } from '@/lib/seo';
import { requireUser } from '@/lib/session';
import { getSettings } from '@/lib/settings';

export const metadata = { ...NOINDEX, title: 'Order details' };
export const dynamic = 'force-dynamic';

export default async function OrderDetail({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const user = await requireUser('/account/orders');
  if (!/^ARV-\d{6}-[A-Z0-9]{4}$/.test(number)) notFound();
  const order = await getOrderForUser(number, user.id);
  if (!order) notFound();
  const [events, settings] = await Promise.all([listOrderEvents(order.id), getSettings()]);
  const canCancel = (order.status === 'pending_payment' || order.status === 'new' || (order.status === 'processing' && settings.policies.cancelBeforeDispatch));
  const a = order.address;
  const returnUntil = order.deliveredAt ? new Date(order.deliveredAt.getTime() + settings.policies.returnWindowDays * 86400000) : null;
  return (
    <>
      <div className="page-head">
        <p className="crumbs"><Link href="/account/orders">My orders</Link></p>
        <h1>Order {order.number}</h1>
        <p className="row">
          <span className={`tag ${STATUS_TAG[order.status]}`}>{STATUS_LABEL[order.status]}</span>
          <span className={`tag ${PAYMENT_TAG[order.paymentStatus]}`}>{PAYMENT_LABEL[order.paymentStatus]}</span>
          <span className="muted small">Placed {formatDateTime(order.placedAt)}</span>
        </p>
      </div>

      {order.status === 'pending_payment' ? (
        <section className="panel glass stack" aria-labelledby="pay-h">
          <h2 id="pay-h">Waiting for payment</h2>
          <p>We have not received a payment confirmation yet. If money left your account it will be matched to this order automatically. Please do not pay twice.</p>
          <PendingPoller order={order.number} />
        </section>
      ) : null}

      <section className="panel glass stack" aria-labelledby="items-h">
        <h2 id="items-h">Items</h2>
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Items in this order</caption>
            <thead>
              <tr><th scope="col">Item</th><th scope="col">Size</th><th scope="col">Colour</th><th scope="col">Qty</th><th scope="col">Total</th></tr>
            </thead>
            <tbody>
              {order.items.map((i) => (
                <tr key={i.id}>
                  <td>{i.productId ? <Link href="/shop">{i.name}</Link> : i.name}</td>
                  <td>{i.size}</td>
                  <td>{i.color}</td>
                  <td className="num">{i.qty}</td>
                  <td className="num">{formatINR(i.lineTotalPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="totals">
          <div><dt>Subtotal</dt><dd className="num">{formatINR(order.subtotalPaise)}</dd></div>
          <div><dt>Shipping</dt><dd className="num">{order.shippingPaise === 0 ? 'Free' : formatINR(order.shippingPaise)}</dd></div>
          {order.discountPaise > 0 ? <div><dt>Discount</dt><dd className="num">{formatINR(-order.discountPaise)}</dd></div> : null}
          <div><dt><strong>Total</strong></dt><dd className="num"><strong>{formatINR(order.totalPaise)}</strong></dd></div>
        </dl>
      </section>

      <section className="panel glass stack" aria-labelledby="ship-h">
        <h2 id="ship-h">Delivery</h2>
        <address style={{ fontStyle: 'normal' }}>
          {a.name}<br />
          {a.line1}{a.line2 ? `, ${a.line2}` : ''}{a.landmark ? `, ${a.landmark}` : ''}<br />
          {a.city}, {a.state} {a.pincode}<br />
          {formatPhone(a.phone)}
        </address>
        {order.trackingNumber ? (
          <p>
            Tracking: {order.carrier ? `${order.carrier} ` : ''}
            {order.trackingUrl && /^https:\/\//.test(order.trackingUrl) ? (
              <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer">{order.trackingNumber}</a>
            ) : (
              <strong className="num">{order.trackingNumber}</strong>
            )}
          </p>
        ) : order.status === 'new' || order.status === 'processing' ? (
          <p className="muted">Tracking details appear here once the order ships. We dispatch within {settings.shipping.dispatchDays} business {settings.shipping.dispatchDays === 1 ? 'day' : 'days'}.</p>
        ) : null}
        {returnUntil && order.status === 'delivered' ? (
          <p>You can request a return or exchange until {formatDate(returnUntil)}. See the <Link href="/legal/return-exchange-policy">Return and Exchange Policy</Link>, then <Link href={`/support`}>contact support</Link> with this order number.</p>
        ) : null}
      </section>

      <section className="panel glass stack" aria-labelledby="tl-h">
        <h2 id="tl-h">History</h2>
        <ol className="timeline">
          {events.map((e, i) => (
            <li key={i}>
              <strong>{e.note ?? humanizeEvent(e.type)}</strong>
              <br />
              <span className="muted small">{formatDateTime(e.createdAt)}</span>
            </li>
          ))}
        </ol>
      </section>

      {canCancel ? (
        <section className="stack" aria-labelledby="cancel-h">
          <h2 id="cancel-h" className="sr-only">Cancel order</h2>
          <CancelOrderButton number={order.number} paid={order.paymentStatus === 'paid'} />
        </section>
      ) : null}
      <p className="small muted">Questions about this order? <Link href="/support">Contact support</Link> and quote {order.number}.</p>
    </>
  );
}
