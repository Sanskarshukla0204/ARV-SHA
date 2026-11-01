import { env, isProd } from './env';

/**
 * Verifies a Cloudflare Turnstile token on the server. Tokens are single use.
 * In production a missing secret fails closed, so the site never silently runs without a captcha.
 */
export async function verifyTurnstile(token: unknown, ip: string): Promise<boolean> {
  const secret = env('TURNSTILE_SECRET_KEY');
  if (!secret) {
    if (isProd) {
      console.error('[turnstile] TURNSTILE_SECRET_KEY is not set; rejecting request');
      return false;
    }
    return true; // local development without keys
  }
  if (typeof token !== 'string' || token.length < 10 || token.length > 4096) return false;

  const form = new URLSearchParams({ secret, response: token });
  if (ip && ip !== 'unknown') form.set('remoteip', ip);

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error('[turnstile] verification request failed', (err as Error).message);
    return false;
  }
}
