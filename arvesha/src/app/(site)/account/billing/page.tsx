import Link from 'next/link';
import { db } from '@/lib/db';
import { formatDate } from '@/lib/format';
import { NOINDEX } from '@/lib/seo';
import { requireUser } from '@/lib/session';
import { SITE } from '@/lib/site';

export const metadata = { ...NOINDEX, title: 'Billing' };
export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const user = await requireUser('/account/billing');
  // The store sells no memberships. This reads the table anyway so an active row is never hidden from its owner.
  const subs = await db.query<{ plan_code: string; status: string; current_period_end: Date | null }>(
    `SELECT plan_code, status, current_period_end FROM subscriptions WHERE user_id = $1 AND status <> 'cancelled' ORDER BY created_at DESC`,
    [user.id],
  );
  return (
    <>
      <div className="page-head">
        <h1>Billing</h1>
      </div>
      <section className="panel glass stack" aria-labelledby="plan-h">
        <h2 id="plan-h">Plan</h2>
        {subs.length === 0 ? (
          <>
            <p>{SITE.name} has no memberships or subscriptions. Your account is free and you pay only for the orders you place.</p>
            <ul className="row" style={{ listStyle: 'none', padding: 0 }}>
              <li><Link href="/account/billing/upgrade" className="btn btn--quiet">Upgrade</Link></li>
              <li><Link href="/account/billing/downgrade" className="btn btn--quiet">Downgrade</Link></li>
              <li><Link href="/account/billing/cancel" className="btn btn--quiet">Cancel subscription</Link></li>
            </ul>
          </>
        ) : (
          <>
            <p>An active plan is recorded on your account. Contact support to change or cancel it.</p>
            <ul>
              {subs.map((s) => (
                <li key={s.plan_code}>{s.plan_code}: {s.status}{s.current_period_end ? `, current period ends ${formatDate(s.current_period_end)}` : ''}</li>
              ))}
            </ul>
            <Link href="/support" className="btn btn--quiet">Contact support</Link>
          </>
        )}
      </section>
      <section className="panel glass stack" aria-labelledby="pay-h">
        <h2 id="pay-h">Payments and invoices</h2>
        <p>Card, UPI and netbanking payments are handled by Razorpay. We never see or store your card number. Each order page shows what you paid and any refund.</p>
        <Link href="/account/orders" className="btn btn--quiet">View my orders</Link>
      </section>
    </>
  );
}
