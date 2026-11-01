import { env, isProd } from './env';

// Optional mobile OTP delivery. Configure MSG91 (a common choice for Indian SMS, DLT template required)
// by setting MSG91_AUTH_KEY and MSG91_TEMPLATE_ID. Without them SMS verification is switched off and
// the store relies on email verification and Truecaller, which already verifies the number.
//
// Check the request format against the current MSG91 "Send OTP" documentation before going live, because
// providers change parameters. Only this file needs to change to swap providers.

export function smsConfigured(): boolean {
  return !!env('MSG91_AUTH_KEY') && !!env('MSG91_TEMPLATE_ID');
}

/** `e164` looks like +919812345670. Returns true when the provider accepted the message. */
export async function sendOtpSms(e164: string, code: string): Promise<boolean> {
  if (!smsConfigured()) {
    if (!isProd) {
      console.log(`\n[sms:dev] to=${e164} code=${code}\n`);
      return true;
    }
    return false;
  }
  const url = new URL('https://control.msg91.com/api/v5/otp');
  url.searchParams.set('template_id', env('MSG91_TEMPLATE_ID')!);
  url.searchParams.set('mobile', e164.replace('+', ''));
  url.searchParams.set('authkey', env('MSG91_AUTH_KEY')!);
  url.searchParams.set('otp', code);
  url.searchParams.set('otp_expiry', '10');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error('[sms] provider returned', res.status);
      return false;
    }
    const data = (await res.json().catch(() => ({}))) as { type?: string };
    return data.type === 'success';
  } catch (err) {
    console.error('[sms] send failed', (err as Error).message);
    return false;
  }
}
