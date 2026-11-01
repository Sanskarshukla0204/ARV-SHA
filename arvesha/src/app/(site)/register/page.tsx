import { redirect } from 'next/navigation';
import { RegisterForm } from '@/components/AuthForms';
import { getSessionUser } from '@/lib/session';
import { NOINDEX } from '@/lib/seo';
import { truecallerConfigured } from '@/lib/truecaller';
import { safeNext } from '@/lib/validate';

export const metadata = { ...NOINDEX, title: 'Create an account' };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  if (await getSessionUser().catch(() => null)) redirect('/account');
  return (
    <div className="auth-shell">
      <div className="auth-card auth-card--wide glass stack stack--lg">
        <h1 style={{ fontSize: '2.5rem' }}>Create an account</h1>
        <RegisterForm next={safeNext(sp.next, '/account')} truecaller={truecallerConfigured()} />
      </div>
    </div>
  );
}
