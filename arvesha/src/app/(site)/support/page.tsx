import Link from 'next/link';
import { SupportForm } from '@/components/AccountForms';
import { formatPhone } from '@/lib/phone';
import { pageMeta } from '@/lib/seo';
import { getSessionUser } from '@/lib/session';
import { getSettings } from '@/lib/settings';
import { SUPPORT_TOPICS } from '@/lib/site';

export const metadata = pageMeta({
  title: 'Contact support',
  description: 'Ask about an order, a return, a refund or a product. Send a message and we reply by email.',
  path: '/support',
});
export const dynamic = 'force-dynamic';

export default async function SupportPage() {
  const [user, settings] = await Promise.all([getSessionUser(), getSettings()]);
  const b = settings.business;
  return (
    <div className="container section">
      <div className="split">
        <div className="stack stack--lg">
          <div className="page-head">
            <h1>Contact support</h1>
            <p className="lead">Tell us what you need and we will reply by email. Many answers are already in the <Link href="/help">Help Center</Link>.</p>
          </div>
          <SupportForm topics={SUPPORT_TOPICS} defaults={{ name: user?.name && user.name !== 'Customer' ? user.name : '', email: user?.email ?? '', phone: user?.phone ?? '' }} />
        </div>
        <aside className="panel glass stack" aria-labelledby="reach-h">
          <h2 id="reach-h" style={{ fontSize: '1.5rem' }}>Other ways to reach us</h2>
          {b.supportEmail ? <p>Email <a href={`mailto:${b.supportEmail}`}>{b.supportEmail}</a></p> : null}
          {b.supportPhone ? <p>Phone <a href={`tel:${b.supportPhone.replace(/\s/g, '')}`}>{b.supportPhone.startsWith('+91') ? formatPhone(b.supportPhone) : b.supportPhone}</a></p> : null}
          {!b.supportEmail && !b.supportPhone ? <p className="muted">Use the form and we will reply by email.</p> : null}
          <p className="small muted">For complaints about how we handle your data or an order, see the grievance officer details in the <Link href="/legal/privacy-policy">Privacy Policy</Link>.</p>
        </aside>
      </div>
    </div>
  );
}
