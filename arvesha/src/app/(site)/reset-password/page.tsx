import Link from 'next/link';
import { ResetForm } from '@/components/AuthForms';
import { peekLinkToken } from '@/lib/auth';
import { NOINDEX } from '@/lib/seo';

export const metadata = { ...NOINDEX, title: 'Choose a new password', referrer: 'no-referrer' as const };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams;
  const valid = token ? await peekLinkToken(token, 'reset_password').catch(() => null) : null;
  return (
    <div className="auth-shell">
      <div className="auth-card glass stack stack--lg">
        <h1 style={{ fontSize: '2.5rem' }}>New password</h1>
        {valid ? (
          <ResetForm token={token} />
        ) : (
          <>
            <p className="notice notice--error" role="alert">
              This reset link is not valid or has expired. Links work once and last 60 minutes.
            </p>
            <Link href="/forgot-password" className="btn btn--primary">
              Request a new link
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
