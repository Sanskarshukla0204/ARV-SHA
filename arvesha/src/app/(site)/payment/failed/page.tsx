import Link from 'next/link';
import { NOINDEX } from '@/lib/seo';
import { requireUser } from '@/lib/session';

export const metadata = { ...NOINDEX, title: 'Payment not completed' };

export default async function PaymentFailed({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order = '' } = await searchParams;
  await requireUser('/checkout');
  return (
    <div className="container container--narrow section">
      <div className="stack stack--lg">
        <h1>Payment not completed</h1>
        <p className="lead">
          The payment did not go through{/^ARV-\d{6}-[A-Z0-9]{4}$/.test(order) ? ` for order ${order}` : ''}. Your bag is saved and you can try again with the same or another payment method.
        </p>
        <p className="notice notice--info">If money was deducted from your account, the bank returns it automatically, usually within 5 to 7 working days. Contact support if it does not arrive.</p>
        <div className="row">
          <Link href="/checkout" className="btn btn--primary">
            Try again
          </Link>
          <Link href="/cart" className="btn">
            Review your bag
          </Link>
          <Link href="/support" className="btn btn--quiet">
            Contact support
          </Link>
        </div>
      </div>
    </div>
  );
}
