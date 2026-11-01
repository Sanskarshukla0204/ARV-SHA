import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatINR } from '@/lib/format';
import { getOrderForUser } from '@/lib/orders';
import { NOINDEX } from '@/lib/seo';
import { requireUser } from '@/lib/session';

export const metadata = { ...NOINDEX, title: 'Payment received' };

export default async function PaymentSuccess({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order: number = '' } = await searchParams;
  const user = await requireUser('/account/orders');
  const order = await getOrderForUser(number, user.id);
  if (!order) redirect('/account/orders');
  if (order.paymentStatus !== 'paid' && order.status === 'pending_payment') redirect(`/payment/pending?order=${encodeURIComponent(order.number)}`);

  return (
    <div className="container container--narrow section">
      <div className="stack stack--lg">
        <h1>Payment received</h1>
        <p className="lead">
          Thank you, {order.contactName.split(' ')[0]}. Order <strong>{order.number}</strong> is confirmed.
          {order.contactEmail ? ` A confirmation is on its way to ${order.contactEmail}.` : ''}
        </p>
        <div className="raised panel stack">
          {order.items.map((i) => (
            <div className="row row--between" key={i.id} style={{ flexWrap: 'nowrap' }}>
              <span>
                {i.name} <span className="muted small">({[i.size, i.color].filter(Boolean).join(', ')}) x {i.qty}</span>
              </span>
              <span className="num nowrap">{formatINR(i.lineTotalPaise)}</span>
            </div>
          ))}
          <hr className="hr" />
          <div className="row row--between">
            <strong>Total paid</strong>
            <strong className="num">{formatINR(order.totalPaise)}</strong>
          </div>
          <p className="small muted">
            Delivering to {order.address.name}, {[order.address.line1, order.address.line2, order.address.city, order.address.state].filter(Boolean).join(', ')} {order.address.pincode}.
          </p>
        </div>
        <div className="row">
          <Link href={`/account/orders/${order.number}`} className="btn btn--primary">
            View order
          </Link>
          <Link href="/shop" className="btn">
            Keep shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
