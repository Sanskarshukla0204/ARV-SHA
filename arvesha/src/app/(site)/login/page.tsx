import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/AuthForms';
import { getSessionUser } from '@/lib/session';
import { NOINDEX } from '@/lib/seo';
import { truecallerConfigured } from '@/lib/truecaller';
import { safeNext } from '@/lib/validate';

export const metadata = { ...NOINDEX, title: 'Log in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, '/account');
  if (await getSessionUser().catch(() => null)) redirect(next);
  return (
    <div className="auth-shell">
      <div className="auth-card glass stack stack--lg">
        <h1 style={{ fontSize: '2.5rem' }}>Log in</h1>
        {sp.reset ? <p className="notice notice--ok" role="status">Your password was changed. Log in with the new one.</p> : null}
        <LoginForm next={next} truecaller={truecallerConfigured()} />
      </div>
    </div>
  );
}
