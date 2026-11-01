'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { SavedAddress } from '@/lib/address';
import { api, errorMessage } from '@/lib/client';
import { formatDateTime } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import { useCaptcha } from './AuthForms';
import { CheckField, Notice, PasswordField, SelectField, SubmitButton, TextAreaField, TextField, useApiForm } from './forms';
import { PhoneVerify } from './PhoneVerify';

// ------------------------------------------------------------------ profile

export function ProfileForm({ name, dob, marketingOptIn }: { name: string; dob: string; marketingOptIn: boolean }) {
  const router = useRouter();
  const f = useApiForm({ name, dob, marketingOptIn });
  const [saved, setSaved] = useState(false);
  const latest = new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().slice(0, 10);
  return (
    <form
      className="stack"
      noValidate
      onSubmit={f.submit(
        '/api/account/profile',
        () => {
          setSaved(true);
          router.refresh();
        },
        undefined,
        'PATCH',
      )}
    >
      {f.formError ? <Notice tone="error">{f.formError}</Notice> : null}
      {saved ? <Notice tone="ok">Your details are saved.</Notice> : null}
      <TextField label="Name" name="name" value={f.values.name} onChange={(v) => { setSaved(false); f.set('name')(v); }} error={f.errors.name} required autoComplete="name" maxLength={80} />
      <TextField label="Date of birth" name="dob" type="date" value={f.values.dob} onChange={(v) => { setSaved(false); f.set('dob')(v); }} error={f.errors.dob} required autoComplete="bday" max={latest} />
      <CheckField name="marketingOptIn" checked={f.values.marketingOptIn} onChange={(v) => { setSaved(false); f.set('marketingOptIn')(v); }}>
        Send me emails about new arrivals. I can turn this off at any time.
      </CheckField>
      <div>
        <SubmitButton busy={f.busy} block={false}>Save details</SubmitButton>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ contact status

export function ContactStatus({ email, emailVerified, phone, phoneVerified }: { email: string | null; emailVerified: boolean; phone: string | null; phoneVerified: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  async function resend() {
    setBusy(true);
    setMsg(null);
    try {
      await api('/api/auth/verify-email/resend', { method: 'POST', body: {} });
      setMsg({ tone: 'ok', text: 'We sent a new verification link. It is valid for 24 hours.' });
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <dl className="kv">
        <dt>Email</dt>
        <dd>
          {email ?? 'Not added'}{' '}
          {email ? <span className={`tag ${emailVerified ? 'tag--ok' : 'tag--warn'}`}>{emailVerified ? 'Verified' : 'Not verified'}</span> : null}
        </dd>
        <dt>Mobile</dt>
        <dd>
          {phone ? formatPhone(phone) : 'Not added'}{' '}
          {phone ? <span className={`tag ${phoneVerified ? 'tag--ok' : 'tag--plain'}`}>{phoneVerified ? 'Verified' : 'Not verified'}</span> : null}
        </dd>
      </dl>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {email && !emailVerified ? (
        <div>
          <button type="button" className="btn btn--quiet" onClick={resend} disabled={busy}>
            {busy ? 'Sending' : 'Send verification email'}
          </button>
        </div>
      ) : null}
      {phone && !phoneVerified ? <PhoneVerify phone={phone} /> : null}
    </div>
  );
}

// ------------------------------------------------------------------ password

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const f = useApiForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [done, setDone] = useState(false);
  return (
    <form
      className="stack"
      noValidate
      onSubmit={f.submit('/api/account/password', () => {
        f.setValues({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setDone(true);
        router.refresh();
      })}
    >
      {f.formError ? <Notice tone="error">{f.formError}</Notice> : null}
      {done ? <Notice tone="ok">Password changed. Your other devices have been signed out.</Notice> : null}
      {hasPassword ? (
        <PasswordField label="Current password" name="currentPassword" value={f.values.currentPassword} onChange={f.set('currentPassword')} error={f.errors.currentPassword} autoComplete="current-password" />
      ) : (
        <p className="muted">You signed up with Truecaller, so you have no password yet. Set one to also log in with your email or mobile number.</p>
      )}
      <PasswordField label="New password" name="newPassword" value={f.values.newPassword} onChange={f.set('newPassword')} error={f.errors.newPassword} autoComplete="new-password" hint="At least 10 characters. Avoid passwords you use elsewhere." />
      <PasswordField label="Confirm new password" name="confirmPassword" value={f.values.confirmPassword} onChange={f.set('confirmPassword')} error={f.errors.confirmPassword} autoComplete="new-password" />
      <div>
        <SubmitButton busy={f.busy} block={false}>{hasPassword ? 'Change password' : 'Set password'}</SubmitButton>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ sessions

export interface SessionRow {
  id: string;
  device: string;
  ip: string | null;
  lastSeenAt: string;
  current: boolean;
}

export function SessionsList({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function revoke(sessionId: string | null, all = false) {
    setBusy(sessionId ?? 'all');
    setError(null);
    try {
      await api('/api/account/sessions', { method: 'DELETE', body: { sessionId, all } });
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  const others = sessions.filter((s) => !s.current).length;
  return (
    <div className="stack">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="table-wrap">
        <table className="table">
          <caption className="sr-only">Devices signed in to your account</caption>
          <thead>
            <tr>
              <th scope="col">Device</th>
              <th scope="col">Last active</th>
              <th scope="col"><span className="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.device}
                  {s.ip ? <span className="small muted"> · {s.ip}</span> : null}
                  {s.current ? <span className="tag tag--info"> This device</span> : null}
                </td>
                <td>{formatDateTime(s.lastSeenAt)}</td>
                <td>
                  {s.current ? null : (
                    <button type="button" className="btn btn--quiet btn--sm" onClick={() => revoke(s.id)} disabled={busy !== null}>
                      {busy === s.id ? 'Signing out' : 'Sign out'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {others > 0 ? (
        <div>
          <button type="button" className="btn btn--quiet" onClick={() => revoke(null, true)} disabled={busy !== null}>
            {busy === 'all' ? 'Signing out' : 'Sign out all other devices'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ addresses

const BLANK = { name: '', phone: '', line1: '', line2: '', landmark: '', city: '', state: '', pincode: '', label: 'Home', makeDefault: false };

function AddressForm({ initial, id, states, onDone, onCancel }: { initial: typeof BLANK; id?: string; states: readonly string[]; onDone: () => void; onCancel: () => void }) {
  const f = useApiForm(initial);
  const [lookup, setLookup] = useState<string | null>(null);
  async function onPin(v: string) {
    f.set('pincode')(v.replace(/\D/g, '').slice(0, 6));
    const pin = v.replace(/\D/g, '');
    if (pin.length !== 6) return;
    try {
      const r = await api<{ found: boolean | 'unknown'; state: string | null; district: string | null }>(`/api/pincode/${pin}`);
      if (r.found === true) {
        if (r.state && states.includes(r.state)) f.set('state')(r.state);
        if (r.district && !f.values.city) f.set('city')(r.district);
        setLookup(null);
      } else if (r.found === false) setLookup('We could not find that PIN code.');
    } catch {
      setLookup(null);
    }
  }
  const body = () => {
    const { label, makeDefault, ...address } = f.values;
    return { address, label, makeDefault };
  };
  return (
    <form
      className="stack"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        f.setBusy(true);
        f.setFormError(null);
        f.setErrors({});
        try {
          await api(id ? `/api/account/addresses/${id}` : '/api/account/addresses', { method: id ? 'PATCH' : 'POST', body: body() });
          onDone();
        } catch (err: any) {
          if (err?.fields && Object.keys(err.fields).length) {
            const flat: Record<string, string> = {};
            for (const [k, m] of Object.entries(err.fields as Record<string, string>)) flat[k.replace(/^address\./, '')] = m;
            f.setErrors(flat);
          } else f.setFormError(errorMessage(err));
        } finally {
          f.setBusy(false);
        }
      }}
    >
      {f.formError ? <Notice tone="error">{f.formError}</Notice> : null}
      <div className="form-grid">
        <TextField label="Label" name="label" value={f.values.label} onChange={f.set('label')} error={f.errors.label} maxLength={30} hint="For example Home or Work." />
        <TextField label="Full name" name="name" value={f.values.name} onChange={f.set('name')} error={f.errors.name} required autoComplete="name" maxLength={80} />
        <TextField label="Mobile number" name="phone" type="tel" value={f.values.phone} onChange={f.set('phone')} error={f.errors.phone} required autoComplete="tel" inputMode="tel" maxLength={16} />
        <TextField label="PIN code" name="pincode" value={f.values.pincode} onChange={onPin} error={f.errors.pincode} required autoComplete="postal-code" inputMode="numeric" maxLength={6} hint={lookup ?? undefined} />
        <div className="span-2">
          <TextField label="Address line 1" name="line1" value={f.values.line1} onChange={f.set('line1')} error={f.errors.line1} required autoComplete="address-line1" maxLength={120} />
        </div>
        <div className="span-2">
          <TextField label="Address line 2 (optional)" name="line2" value={f.values.line2} onChange={f.set('line2')} error={f.errors.line2} autoComplete="address-line2" maxLength={120} />
        </div>
        <TextField label="Landmark (optional)" name="landmark" value={f.values.landmark} onChange={f.set('landmark')} error={f.errors.landmark} maxLength={80} />
        <TextField label="City" name="city" value={f.values.city} onChange={f.set('city')} error={f.errors.city} required autoComplete="address-level2" maxLength={60} />
        <SelectField label="State" name="state" value={f.values.state} onChange={f.set('state')} error={f.errors.state} required options={states} placeholder="Choose a state" />
      </div>
      <CheckField name="makeDefault" checked={f.values.makeDefault} onChange={f.set('makeDefault')}>Use as my default address</CheckField>
      <div className="row">
        <SubmitButton busy={f.busy} block={false}>{id ? 'Save address' : 'Add address'}</SubmitButton>
        <button type="button" className="btn btn--quiet" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export function AddressManager({ addresses, states, max }: { addresses: SavedAddress[]; states: readonly string[]; max: number }) {
  const router = useRouter();
  const [mode, setMode] = useState<'none' | 'new' | string>('none');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  async function remove(id: string) {
    setBusy(id);
    setError(null);
    try {
      await api(`/api/account/addresses/${id}`, { method: 'DELETE' });
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  const done = () => {
    setMode('none');
    router.refresh();
  };
  return (
    <div className="stack">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {addresses.length === 0 && mode !== 'new' ? <p className="muted">You have no saved addresses. Add one to check out faster.</p> : null}
      <ul className="stack stack--sm" style={{ listStyle: 'none', padding: 0 }}>
        {addresses.map((a) => (
          <li key={a.id} className="panel inset stack stack--sm">
            {mode === a.id ? (
              <AddressForm
                id={a.id}
                states={states}
                onDone={done}
                onCancel={() => setMode('none')}
                initial={{ name: a.name, phone: a.phone, line1: a.line1, line2: a.line2 ?? '', landmark: a.landmark ?? '', city: a.city, state: a.state, pincode: a.pincode, label: a.label, makeDefault: a.isDefault }}
              />
            ) : (
              <>
                <p>
                  <strong>{a.label}</strong> {a.isDefault ? <span className="tag tag--info">Default</span> : null}
                </p>
                <address style={{ fontStyle: 'normal' }}>
                  {a.name}
                  <br />
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ''}
                  {a.landmark ? `, ${a.landmark}` : ''}
                  <br />
                  {a.city}, {a.state} {a.pincode}
                  <br />
                  {formatPhone(a.phone)}
                </address>
                <div className="row">
                  <button type="button" className="btn btn--quiet btn--sm" onClick={() => setMode(a.id)}>Edit</button>
                  <button type="button" className="btn btn--quiet btn--sm" onClick={() => remove(a.id)} disabled={busy !== null}>{busy === a.id ? 'Removing' : 'Remove'}</button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {mode === 'new' ? (
        <div className="panel inset">
          <AddressForm initial={BLANK} states={states} onDone={done} onCancel={() => setMode('none')} />
        </div>
      ) : addresses.length < max ? (
        <div>
          <button type="button" className="btn btn--quiet" onClick={() => setMode('new')}>Add an address</button>
        </div>
      ) : (
        <p className="muted small">You have reached the limit of {max} saved addresses.</p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ delete account

export function DeleteAccountForm({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const f = useApiForm({ password: '', confirmText: '' });
  if (!open) {
    return (
      <div>
        <button type="button" className="btn btn--danger" onClick={() => setOpen(true)}>Delete my account</button>
      </div>
    );
  }
  return (
    <form className="stack" noValidate onSubmit={f.submit('/api/account/delete', () => { router.push('/'); router.refresh(); })}>
      <Notice tone="warn">This removes your profile, saved addresses and bag. Past orders are kept without your profile because tax law requires us to keep them. This cannot be undone.</Notice>
      {f.formError ? <Notice tone="error">{f.formError}</Notice> : null}
      {hasPassword ? (
        <PasswordField label="Confirm with your password" name="password" value={f.values.password} onChange={f.set('password')} error={f.errors.password} autoComplete="current-password" />
      ) : (
        <TextField label="Type DELETE to confirm" name="confirmText" value={f.values.confirmText} onChange={f.set('confirmText')} error={f.errors.confirmText} maxLength={20} />
      )}
      <div className="row">
        <button type="submit" className="btn btn--danger" disabled={f.busy}>{f.busy ? 'Deleting' : 'Delete permanently'}</button>
        <button type="button" className="btn btn--quiet" onClick={() => setOpen(false)}>Keep my account</button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ cancel order

export function CancelOrderButton({ number, paid }: { number: string; paid: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/orders/${encodeURIComponent(number)}/cancel`, { method: 'POST', body: { reason } });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  if (!open) return <button type="button" className="btn btn--quiet" onClick={() => setOpen(true)}>Cancel this order</button>;
  return (
    <form className="stack panel inset" onSubmit={go}>
      <p>{paid ? 'Your payment will be refunded to the original payment method.' : 'No payment has been taken for this order.'}</p>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <TextField label="Reason (optional)" name="reason" value={reason} onChange={setReason} maxLength={200} />
      <div className="row">
        <button type="submit" className="btn btn--danger" disabled={busy}>{busy ? 'Cancelling' : 'Confirm cancellation'}</button>
        <button type="button" className="btn btn--quiet" onClick={() => setOpen(false)}>Keep the order</button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ support

export function SupportForm({ topics, defaults }: { topics: readonly string[]; defaults: { name: string; email: string; phone: string } }) {
  const f = useApiForm({ name: defaults.name, email: defaults.email, phone: defaults.phone, orderNumber: '', topic: '', message: '' });
  const cap = useCaptcha(f.busy);
  const [ref, setRef] = useState<string | null>(null);
  if (ref) {
    return (
      <div className="stack">
        <Notice tone="ok">Thank you. Your message is with us. Your reference is <strong className="num">{ref}</strong>. We sent a copy to your email.</Notice>
      </div>
    );
  }
  return (
    <form
      className="stack"
      noValidate
      onSubmit={f.submit('/api/support', (r) => setRef(r.reference), () => ({ turnstileToken: cap.token, phone: f.values.phone || null }))}
    >
      {f.formError ? <Notice tone="error">{f.formError}</Notice> : null}
      <div className="form-grid">
        <TextField label="Name" name="name" value={f.values.name} onChange={f.set('name')} error={f.errors.name} required autoComplete="name" maxLength={80} />
        <TextField label="Email" name="email" type="email" value={f.values.email} onChange={f.set('email')} error={f.errors.email} required autoComplete="email" maxLength={254} />
        <TextField label="Mobile number (optional)" name="phone" type="tel" value={f.values.phone} onChange={f.set('phone')} error={f.errors.phone} autoComplete="tel" inputMode="tel" maxLength={16} />
        <TextField label="Order number (optional)" name="orderNumber" value={f.values.orderNumber} onChange={(v) => f.set('orderNumber')(v.toUpperCase())} error={f.errors.orderNumber} maxLength={20} />
        <div className="span-2">
          <SelectField label="Topic" name="topic" value={f.values.topic} onChange={f.set('topic')} error={f.errors.topic} required options={topics} placeholder="Choose a topic" />
        </div>
        <div className="span-2">
          <TextAreaField label="Message" name="message" value={f.values.message} onChange={f.set('message')} error={f.errors.message} required maxLength={2000} rows={6} hint="At least 15 characters. Do not include passwords or card numbers." />
        </div>
      </div>
      {cap.widget}
      <div>
        <SubmitButton busy={f.busy || !cap.ready} block={false}>Send message</SubmitButton>
      </div>
    </form>
  );
}
