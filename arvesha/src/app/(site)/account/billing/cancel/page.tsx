import Link from 'next/link';
import { NOINDEX } from '@/lib/seo';
import { SITE } from '@/lib/site';

export const metadata = { ...NOINDEX, title: 'Cancel subscription' };

export default function Page() {
  return (
    <>
      <div className="page-head">
        <p className="crumbs"><Link href="/account/billing">Billing</Link></p>
        <h1>Cancel subscription</h1>
      </div>
      <section className="panel glass stack">
        <p className="lead">You have no subscription to cancel.</p>
        <p>We do not bill you on a schedule. To cancel an order that has not shipped, open it from your orders and choose Cancel this order. To remove your profile, use Delete account in your account settings.</p>
        <div className="row">
          <Link href="/account/orders" className="btn btn--primary">My orders</Link>
          <Link href="/support" className="btn btn--quiet">Contact support</Link>
        </div>
      </section>
      <p className="small muted">{SITE.name} sells clothing. You pay for each order once, at checkout.</p>
    </>
  );
}
