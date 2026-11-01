import Link from 'next/link';
import { LogoutButton } from '@/components/LogoutButton';
import { requireUser } from '@/lib/session';

const LINKS = [
  { href: '/account', label: 'Account settings' },
  { href: '/account/orders', label: 'My orders' },
  { href: '/account/billing', label: 'Billing' },
  { href: '/support', label: 'Support' },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireUser('/account');
  return (
    <div className="container section">
      <div className="split">
        <nav aria-label="Account" className="stack stack--sm">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="btn btn--quiet">
              {l.label}
            </Link>
          ))}
          <LogoutButton />
        </nav>
        <div className="stack stack--lg">{children}</div>
      </div>
    </div>
  );
}

