import { PendingPoller } from '@/components/PendingPoller';
import { NOINDEX } from '@/lib/seo';
import { requireUser } from '@/lib/session';

export const metadata = { ...NOINDEX, title: 'Payment pending' };

export default async function PaymentPending({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order = '' } = await searchParams;
  await requireUser('/account/orders');
  const valid = /^ARV-\d{6}-[A-Z0-9]{4}$/.test(order);
  return (
    <div className="container container--narrow section">
      <div className="stack stack--lg">
        <h1>Payment pending</h1>
        <p className="lead">We are waiting for your bank to confirm the payment{valid ? ` for order ${order}` : ''}. Please do not pay again or close this page.</p>
        {valid ? <PendingPoller order={order} /> : null}
      </div>
    </div>
  );
}
