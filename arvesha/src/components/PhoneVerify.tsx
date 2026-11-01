'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiRequestError, api, errorMessage } from '@/lib/client';
import { formatPhone } from '@/lib/phone';
import { Notice, TextField } from './forms';

/** Sends a six digit code by SMS and confirms it. Used in checkout and in account settings. */
export function PhoneVerify({ phone, onVerified }: { phone: string; onVerified?: () => void }) {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await api('/api/auth/phone/send', { method: 'POST', body: {} });
      setSent(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/auth/phone/verify', { method: 'POST', body: { code } });
      onVerified?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError && err.fields.code ? err.fields.code : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" role="group" aria-label="Verify your mobile number">
      {!sent ? (
        <>
          <p>
            Verify <strong>{formatPhone(phone)}</strong> with a code sent by SMS.
          </p>
          <div>
            <button type="button" className="btn" onClick={send} aria-busy={busy} disabled={busy}>
              Send code
            </button>
          </div>
        </>
      ) : (
        <form className="stack" onSubmit={verify}>
          <TextField label="6 digit code" name="code" value={code} onChange={setCode} required inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" />
          <div className="row">
            <button type="submit" className="btn btn--primary" aria-busy={busy} disabled={busy || code.length !== 6}>
              Confirm
            </button>
            <button type="button" className="btn btn--quiet" onClick={send} disabled={busy}>
              Send again
            </button>
          </div>
        </form>
      )}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </div>
  );
}
