import Link from 'next/link';
import { NOINDEX } from '@/lib/seo';
import { SITE } from '@/lib/site';

export const metadata = { ...NOINDEX, title: 'Downgrade' };

export default function Page() {
  return (
    <>
      <div className="page-head">
        <p className="crumbs"><Link href="/account/billing">Billing</Link></p>
        <h1>Downgrade</h1>
      </div>
      <section className="panel glass stack">
        <p className="lead">There is no plan to downgrade from.</p>
        <p>Your account is free and we do not charge a recurring fee. Nothing on your account needs to be reduced.</p>
        <div className="row">
          <Link href="/account/orders" className="btn btn--primary">My orders</Link>
          <Link href="/support" className="btn btn--quiet">Contact support</Link>
        </div>
      </section>
      <p className="small muted">{SITE.name} sells clothing. You pay for each order once, at checkout.</p>
    </>
  );
}
