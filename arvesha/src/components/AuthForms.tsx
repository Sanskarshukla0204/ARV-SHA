'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiRequestError, api, errorMessage, safeNextClient } from '@/lib/client';
import { CheckField, Notice, PasswordField, SubmitButton, TextField, useApiForm } from './forms';
import { Turnstile } from './Turnstile';

const HAS_CAPTCHA = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** Keeps the Turnstile token for the form and gets a fresh challenge after every attempt, because tokens work once. */
export function useCaptcha(busy: boolean) {
  const [token, setToken] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const was = useRef(false);
  useEffect(() => {
    if (was.current && !busy) setResetKey((k) => k + 1);
    was.current = busy;
  }, [busy]);
  return { token, resetKey, widget: <Turnstile onToken={setToken} resetKey={resetKey} />, ready: !HAS_CAPTCHA || !!token };
}

// ------------------------------------------------------------------ Truecaller

export function TruecallerButton({ next }: { next: string }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'opening' | 'waiting' | 'unavailable' | 'rejected' | 'expired'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = useRef(true);
  useEffect(() => () => { live.current = false; if (timer.current) clearTimeout(timer.current); }, []);

  const poll = useCallback(
    (nonce: string, browserSecret: string, until: number) => {
      timer.current = setTimeout(async () => {
        if (!live.current) return;
        if (Date.now() > until) return setState('expired');
        try {
          const r = await api<{ status: string; next?: string }>('/api/auth/truecaller/poll', { method: 'POST', body: { nonce, browserSecret } });
          if (r.status === 'verified') return router.push(r.next === '/onboarding' ? `/onboarding` : next);
          if (r.status === 'rejected') return setState('rejected');
          if (r.status === 'expired') return setState('expired');
        } catch {
          /* try again */
        }
        poll(nonce, browserSecret, until);
      }, 2000);
    },
    [next, router],
  );

  async function start() {
    setState('opening');
    try {
      const s = await api<{ nonce: string; browserSecret: string; deepLink: string; ttlMs: number }>('/api/auth/truecaller/start', { method: 'POST', body: {} });
      window.location.href = s.deepLink;
      // If the Truecaller app opened, this page loses focus. If it still has focus after a moment, the app is not installed.
      setTimeout(() => {
        if (!live.current) return;
        if (document.hasFocus() && document.visibilityState === 'visible') setState('unavailable');
        else setState('waiting');
      }, 900);
      poll(s.nonce, s.browserSecret, Date.now() + s.ttlMs + 5000);
    } catch (e) {
      setState('unavailable');
      void e;
    }
  }

  return (
    <div className="stack stack--sm">
      <button type="button" className="btn btn--block" onClick={start} aria-busy={state === 'opening'} disabled={state === 'opening' || state === 'waiting'}>
        Continue with Truecaller
      </button>
      {state === 'waiting' ? <p className="small muted" role="status">Confirm in the Truecaller app. This page continues by itself.</p> : null}
      {state === 'unavailable' ? <p className="small" role="status">Truecaller is not available on this device. Use your email or mobile number and password instead.</p> : null}
      {state === 'rejected' ? <p className="small" role="status">The Truecaller request was cancelled. You can try again or use a password.</p> : null}
      {state === 'expired' ? <p className="small" role="status">The Truecaller request timed out. Try again.</p> : null}
    </div>
  );
}

// ----------------------------------------------------------------------- login

export function LoginForm({ next, truecaller }: { next: string; truecaller: boolean }) {
  const router = useRouter();
  const f = useApiForm({ identifier: '', password: '' });
  const cap = useCaptcha(f.busy);
  const target = safeNextClient(next);
  return (
    <div className="stack stack--lg">
      {truecaller ? (
        <>
          <TruecallerButton next={target} />
          <div className="divider">or use a password</div>
        </>
      ) : null}
      <form className="stack" onSubmit={f.submit('/api/auth/login', (r) => router.push(r.next ?? target), () => ({ turnstileToken: cap.token, next: target }))} noValidate>
        {f.formError ? <Notice tone="error">{f.formError}</Notice> : null}
        <TextField label="Email or mobile number" name="identifier" value={f.values.identifier} onChange={f.set('identifier')} error={f.errors.identifier} required autoComplete="username" maxLength={254} autoFocus />
        <PasswordField label="Password" name="password" value={f.values.password} onChange={f.set('password')} error={f.errors.password} autoComplete="current-password" />
        {cap.widget}
        <SubmitButton busy={f.busy || !cap.ready}>Log in</SubmitButton>
        <div className="row row--between small">
          <Link href="/forgot-password">Forgot password</Link>
          <Link href={`/register${target !== '/account' ? `?next=${encodeURIComponent(target)}` : ''}`}>Create an account</Link>
        </div>
      </form>
    </div>
  );
}

// -------------------------------------------------------------------- register

export function RegisterForm({ next, truecaller }: { next: string; truecaller: boolean }) {
  const router = useRouter();
  const f = useApiForm({ name: '', dob: '', phone: '', email: '', password: '', confirmPassword: '', marketingOptIn: false, acceptTerms: false });
  const cap = useCaptcha(f.busy);
  const latest = new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().slice(0, 10);
  void next;
  return (
    <div className="stack stack--lg">
      {truecaller ? (
        <>
          <TruecallerButton next="/onboarding" />
          <div className="divider">or sign up with email</div>
        </>
      ) : null}
      <form className="stack" onSubmit={f.submit('/api/auth/register', (r) => router.push(r.next ?? '/onboarding'), () => ({ turnstileToken: cap.token }))} noValidate>
        {f.formError ? <Notice tone="error">{f.formError}</Notice> : null}
        <TextField label="Full name" name="name" value={f.values.name} onChange={f.set('name')} error={f.errors.name} required autoComplete="name" maxLength={80} />
        <div className="form-grid">
          <TextField label="Date of birth" name="dob" type="date" value={f.values.dob} onChange={f.set('dob')} error={f.errors.dob} required autoComplete="bday" max={latest} hint="You must be 18 or older." />
          <TextField label="Contact number" name="phone" type="tel" value={f.values.phone} onChange={f.set('phone')} error={f.errors.phone} required autoComplete="tel-national" inputMode="tel" maxLength={16} hint="10 digit Indian mobile number." />
        </div>
        <TextField label="Email" name="email" type="email" value={f.values.email} onChange={f.set('email')} error={f.errors.email} required autoComplete="email" maxLength={254} />
        <PasswordField label="Password" name="password" value={f.values.password} onChange={f.set('password')} error={f.errors.password} autoComplete="new-password" hint="At least 10 characters. A passphrase works well." />
        <PasswordField label="Confirm password" name="confirmPassword" value={f.values.confirmPassword} onChange={f.set('confirmPassword')} error={f.errors.confirmPassword} autoComplete="new-password" />
        <CheckField name="acceptTerms" checked={f.values.acceptTerms} onChange={f.set('acceptTerms')} error={f.errors.acceptTerms}>
          I agree to the <Link href="/legal/terms-of-service">Terms of Service</Link> and have read the <Link href="/legal/privacy-policy">Privacy Policy</Link>.
        </CheckField>
        <CheckField name="marketingOptIn" checked={f.values.marketingOptIn} onChange={f.set('marketingOptIn')}>
          Send me news about new arrivals by email (optional).
        </CheckField>
        {cap.widget}
        <SubmitButton busy={f.busy || !cap.ready}>Create account</SubmitButton>
        <p className="small">
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}

// ------------------------------------------------------------ forgot and reset

export function ForgotForm() {
  const f = useApiForm({ identifier: '' });
  const cap = useCaptcha(f.busy);
  const [done, setDone] = useState<string | null>(null);
  if (done) return <Notice tone="ok">{done}</Notice>;
  return (
    <form className="stack" onSubmit={f.submit('/api/auth/forgot-password', (r) => setDone(r.message), () => ({ turnstileToken: cap.token }))} noValidate>
      {f.formError ? <Notice tone="error">{f.formError}</Notice> : null}
      <TextField label="Email or mobile number" name="identifier" value={f.values.identifier} onChange={f.set('identifier')} error={f.errors.identifier} required autoComplete="username" maxLength={254} autoFocus hint="We email the reset link to the address on the account." />
      {cap.widget}
      <SubmitButton busy={f.busy || !cap.ready}>Send reset link</SubmitButton>
      <Link href="/login" className="small">
        Back to log in
      </Link>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const f = useApiForm({ password: '', confirmPassword: '' });
  return (
    <form className="stack" onSubmit={f.submit('/api/auth/reset-password', () => router.push('/login?reset=1'), () => ({ token }))} noValidate>
      {f.formError ? <Notice tone="error">{f.formError}</Notice> : null}
      <PasswordField label="New password" name="password" value={f.values.password} onChange={f.set('password')} error={f.errors.password} autoComplete="new-password" hint="At least 10 characters." />
      <PasswordField label="Confirm new password" name="confirmPassword" value={f.values.confirmPassword} onChange={f.set('confirmPassword')} error={f.errors.confirmPassword} autoComplete="new-password" />
      <SubmitButton busy={f.busy}>Save new password</SubmitButton>
    </form>
  );
}

// ----------------------------------------------------------- email verification

export function VerifyEmailAction({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<'idle' | 'done' | string>('idle');
  async function go() {
    setBusy(true);
    try {
      await api('/api/auth/verify-email', { method: 'POST', body: { token } });
      setState('done');
      router.refresh();
    } catch (e) {
      setState(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (state === 'done') return <Notice tone="ok">Your email is verified. <Link href="/account">Go to your account</Link>.</Notice>;
  return (
    <div className="stack">
      {state !== 'idle' ? <Notice tone="error">{state}</Notice> : null}
      <div>
        <button type="button" className="btn btn--primary" onClick={go} aria-busy={busy} disabled={busy}>
          Confirm my email
        </button>
      </div>
    </div>
  );
}

export function ResendVerification({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | string>('idle');
  async function go() {
    setState('busy');
    try {
      await api('/api/auth/verify-email/resend', { method: 'POST', body: {} });
      setState('sent');
    } catch (e) {
      setState(e instanceof ApiRequestError ? e.message : 'Could not send the email.');
    }
  }
  return (
    <div className="stack stack--sm">
      <button type="button" className="btn btn--sm" onClick={go} aria-busy={state === 'busy'} disabled={state === 'busy' || state === 'sent'}>
        {state === 'sent' ? 'Link sent' : 'Send verification link'}
      </button>
      {state === 'sent' ? <p className="small" role="status">We sent a new link to {email}.</p> : null}
      {state !== 'idle' && state !== 'busy' && state !== 'sent' ? <p className="small" role="alert" style={{ color: 'var(--danger)' }}>{state}</p> : null}
    </div>
  );
}

// ------------------------------------------------------------------ onboarding

export function CompleteProfileForm({ name, phone }: { name: string; phone: string | null }) {
  const router = useRouter();
  const f = useApiForm({ name: name === 'Customer' ? '' : name, dob: '', email: '', password: '', confirmPassword: '' });
  const latest = new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().slice(0, 10);
  return (
    <form className="stack" onSubmit={f.submit('/api/auth/complete-profile', () => router.refresh())} noValidate>
      {f.formError ? <Notice tone="error">{f.formError}</Notice> : null}
      {phone ? <p className="small muted">Your mobile number {phone} is already verified through Truecaller.</p> : null}
      <TextField label="Full name" name="name" value={f.values.name} onChange={f.set('name')} error={f.errors.name} required autoComplete="name" maxLength={80} />
      <TextField label="Date of birth" name="dob" type="date" value={f.values.dob} onChange={f.set('dob')} error={f.errors.dob} required autoComplete="bday" max={latest} hint="You must be 18 or older." />
      <TextField label="Email" name="email" type="email" value={f.values.email} onChange={f.set('email')} error={f.errors.email} required autoComplete="email" maxLength={254} />
      <PasswordField label="Password (optional)" name="password" value={f.values.password} onChange={f.set('password')} error={f.errors.password} autoComplete="new-password" required={false} hint="Set one to log in with your email as well." />
      {f.values.password ? <PasswordField label="Confirm password" name="confirmPassword" value={f.values.confirmPassword} onChange={f.set('confirmPassword')} error={f.errors.confirmPassword} autoComplete="new-password" /> : null}
      <SubmitButton busy={f.busy}>Save details</SubmitButton>
    </form>
  );
}
