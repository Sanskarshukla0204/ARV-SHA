import Link from 'next/link';
import { VerifyEmailAction } from '@/components/AuthForms';
import { peekLinkToken } from '@/lib/auth';
import { NOINDEX } from '@/lib/seo';

export const metadata = { ...NOINDEX, title: 'Verify your email', referrer: 'no-referrer' as const };

// The link only shows a button. Confirming happens on click, so email scanners that open links cannot use up the token.
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams;
  const valid = token ? await peekLinkToken(token, 'verify_email').catch(() => null) : null;
  return (
    <div className="auth-shell">
      <div className="auth-card glass stack stack--lg">
        <h1 style={{ fontSize: '2.5rem' }}>Verify your email</h1>
        {valid ? (
          <>
            <p>Confirm that {valid.target ? <strong>{valid.target}</strong> : 'this address'} is yours.</p>
            <VerifyEmailAction token={token} />
          </>
        ) : (
          <>
            <p className="notice notice--error" role="alert">
              This verification link is not valid or has expired. Log in and request a new one from your account.
            </p>
            <Link href="/login?next=/account" className="btn btn--primary">
              Log in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
