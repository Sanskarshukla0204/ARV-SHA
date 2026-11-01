import Link from 'next/link';
import { CompleteProfileForm, ResendVerification } from '@/components/AuthForms';
import { NOINDEX } from '@/lib/seo';
import { requireUser } from '@/lib/session';

export const metadata = { ...NOINDEX, title: 'Welcome' };

export default async function OnboardingPage() {
  const user = await requireUser('/onboarding');
  const needsDetails = !user.profileComplete;
  const needsVerify = !!user.email && !user.emailVerified;
  return (
    <div className="auth-shell">
      <div className="auth-card auth-card--wide glass stack stack--lg">
        <div className="stack stack--sm">
          <h1 style={{ fontSize: '2.5rem' }}>Welcome, {user.name.split(' ')[0]}</h1>
          <p>Your customer ID is <strong className="num">{user.publicId}</strong>. Quote it when you contact support.</p>
        </div>

        {needsDetails ? (
          <section className="stack" aria-labelledby="details-h">
            <h2 id="details-h" style={{ fontSize: '1.75rem' }}>Finish your profile</h2>
            <CompleteProfileForm name={user.name} phone={user.phone} />
          </section>
        ) : null}

        {needsVerify ? (
          <section className="stack" aria-labelledby="verify-h">
            <h2 id="verify-h" style={{ fontSize: '1.75rem' }}>Verify your email</h2>
            <p>We sent a link to <strong>{user.email}</strong>. You can verify now or later from your account. Verifying lets you recover your account if you forget your password.</p>
            <ResendVerification email={user.email!} />
          </section>
        ) : null}

        <div className="row">
          <Link href="/shop" className="btn btn--primary">
            {needsDetails || needsVerify ? 'Skip for now and start shopping' : 'Start shopping'}
          </Link>
          <Link href="/account" className="btn btn--quiet">
            Go to my account
          </Link>
        </div>
      </div>
    </div>
  );
}
