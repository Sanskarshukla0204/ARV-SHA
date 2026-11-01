import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { formatINR } from '@/lib/format';
import { pageMeta } from '@/lib/seo';
import { getSettings } from '@/lib/settings';

export const metadata = pageMeta({
  title: 'Help Center',
  description: 'Answers about ordering, payment, shipping, returns, refunds and your account at Arvésha Clothing.',
  path: '/help',
});
export const revalidate = 300;

export default async function HelpPage() {
  const s = await getSettings();
  const { shipping: sh, policies: p } = s;
  const days = (n: number) => `${n} business ${n === 1 ? 'day' : 'days'}`;
  const shippingFee = sh.freeAbovePaise === null ? `Shipping is ${formatINR(sh.flatPaise)} per order.` : `Shipping is ${formatINR(sh.flatPaise)} per order, and free on orders of ${formatINR(sh.freeAbovePaise)} or more.`;
  const groups: { title: string; items: { q: string; a: string; link?: { href: string; text: string } }[] }[] = [
    {
      title: 'Ordering and payment',
      items: [
        { q: 'Which payment methods can I use?', a: 'You can pay by UPI, debit or credit card and netbanking through Razorpay. Payment is confirmed by Razorpay before your order is accepted.' },
        { q: 'My money was deducted but the order shows pending. What now?', a: 'Wait a few minutes and keep the page open. Banks sometimes confirm late. We match the payment to your order automatically. If the amount was taken and the order does not update within a day, contact support with your order number. Do not pay a second time.', link: { href: '/support', text: 'Contact support' } },
        { q: 'Why was my payment declined?', a: 'The bank or card network refused it. Try again, use another method or check with your bank. No order is created until payment succeeds.' },
        { q: 'Do I need an account to order?', a: 'Yes. An account lets us keep your order history, tracking and refunds in one place. You can register with email or log in with Truecaller.', link: { href: '/register', text: 'Create an account' } },
      ],
    },
    {
      title: 'Shipping',
      items: [
        { q: 'Where do you deliver?', a: 'We deliver across India to addresses with a valid PIN code. The PIN code must match the state you enter.' },
        { q: 'How long does delivery take?', a: `We hand your order to the courier within ${days(sh.dispatchDays)}. Delivery then takes ${sh.deliveryMinDays} to ${sh.deliveryMaxDays} business days, depending on your location.` },
        { q: 'How much does shipping cost?', a: shippingFee },
        { q: 'How do I track my order?', a: 'Open the order from My orders. The tracking number and courier link appear once the order ships.', link: { href: '/account/orders', text: 'My orders' } },
      ],
    },
    {
      title: 'Cancellations, returns and refunds',
      items: [
        { q: 'Can I cancel an order?', a: p.cancelBeforeDispatch ? 'Yes, until it is handed to the courier. Open the order and choose Cancel this order. A paid order is refunded to the original payment method.' : 'You can cancel an order while it is still awaiting confirmation. After that, contact support.' },
        { q: 'How do I return or exchange an item?', a: `Contact support within ${p.returnWindowDays} days of delivery with your order number and the reason. Items must be unworn, unwashed and have their tags.`, link: { href: '/legal/return-exchange-policy', text: 'Return and Exchange Policy' } },
        { q: 'When will I get my refund?', a: `Approved refunds go back to the original payment method within ${days(p.refundDays)} after we receive the returned item. Your bank may take a few more days to show it.`, link: { href: '/legal/refund-policy', text: 'Refund Policy' } },
      ],
    },
    {
      title: 'Your account',
      items: [
        { q: 'I forgot my password.', a: 'Use the reset link on the login page. We email a link that is valid for 60 minutes. If your email is not verified, log in with Truecaller or contact support.', link: { href: '/forgot-password', text: 'Reset password' } },
        { q: 'How do I change my details or addresses?', a: 'Open Account settings. You can change your name, date of birth, saved addresses and password there.', link: { href: '/account', text: 'Account settings' } },
        { q: 'How do I delete my account?', a: 'Open Account settings and choose Delete account. Orders in progress must be delivered or cancelled first. Past orders are kept without your profile for tax records.' },
        { q: 'How is my data protected?', a: 'Passwords are stored as Argon2 hashes that nobody can read. Card details go straight to Razorpay and never touch our servers.', link: { href: '/legal/privacy-policy', text: 'Privacy Policy' } },
      ],
    },
  ];
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: groups.flatMap((g) => g.items).map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
  };
  return (
    <div className="container container--narrow section">
      <JsonLd data={ld} />
      <div className="page-head">
        <h1>Help Center</h1>
        <p className="lead">Quick answers about orders, delivery, returns and your account.</p>
      </div>
      <div className="stack stack--lg">
        {groups.map((g) => (
          <section key={g.title} className="stack stack--sm" aria-labelledby={`h-${g.title.replace(/\W+/g, '-')}`}>
            <h2 id={`h-${g.title.replace(/\W+/g, '-')}`} style={{ fontSize: '1.5rem' }}>{g.title}</h2>
            <div>
              {g.items.map((i) => (
                <details key={i.q} className="disclosure">
                  <summary>{i.q}</summary>
                  <div className="stack stack--sm" style={{ paddingBottom: '1rem' }}>
                    <p>{i.a}</p>
                    {i.link ? <p><Link href={i.link.href}>{i.link.text}</Link></p> : null}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}
        <p>Still stuck? <Link href="/support">Send us a message</Link>.</p>
      </div>
    </div>
  );
}
