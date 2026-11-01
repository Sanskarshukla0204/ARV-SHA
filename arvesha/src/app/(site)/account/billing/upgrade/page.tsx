import Link from 'next/link';
import { NOINDEX } from '@/lib/seo';
import { SITE } from '@/lib/site';

export const metadata = { ...NOINDEX, title: 'Upgrade' };

export default function Page() {
  return (
    <>
      <div className="page-head">
        <p className="crumbs"><Link href="/account/billing">Billing</Link></p>
        <h1>Upgrade</h1>
      </div>
      <section className="panel glass stack">
        <p className="lead">There is no plan to upgrade to.</p>
        <p>We do not sell memberships or subscriptions, so no paid tier exists for your account. Your account is free and has every feature.</p>
        <div className="row">
          <Link href="/account/orders" className="btn btn--primary">My orders</Link>
          <Link href="/support" className="btn btn--quiet">Contact support</Link>
        </div>
      </section>
      <p className="small muted">{SITE.name} sells clothing. You pay for each order once, at checkout.</p>
    </>
  );
}
