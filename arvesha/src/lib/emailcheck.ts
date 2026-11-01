import { resolve4, resolve6, resolveMx } from 'node:dns/promises';
import MailChecker from 'mailchecker';

export type EmailCheck = 'ok' | 'disposable' | 'unreachable';

// Extra domains on top of the maintained MailChecker list.
const EXTRA_DISPOSABLE = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'sharklasers.com', '10minutemail.com',
  '10minutemail.net', 'tempmail.com', 'temp-mail.org', 'temp-mail.io', 'tempmailo.com', 'yopmail.com', 'yopmail.net',
  'trashmail.com', 'getnada.com', 'nada.email', 'dispostable.com', 'maildrop.cc', 'fakeinbox.com', 'throwawaymail.com',
  'mohmal.com', 'emailondeck.com', 'burnermail.io', 'mintemail.com', 'spamgourmet.com', 'moakt.com', 'tmail.ws',
  'mail.tm', 'inboxkitten.com', 'gmailnator.com', 'emailfake.com', 'tempail.com', 'dropmail.me', 'mytemp.email',
]);

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), ms))]);
}

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  if (!domain) return true;
  if (EXTRA_DISPOSABLE.has(domain)) return true;
  // Block subdomains of listed disposable providers as well.
  for (const d of EXTRA_DISPOSABLE) if (domain.endsWith(`.${d}`)) return true;
  try {
    return !MailChecker.isValid(email);
  } catch {
    return false;
  }
}

/**
 * Rejects throwaway addresses and domains that cannot receive mail.
 * DNS problems other than "this domain has no mail records" are treated as ok, so a
 * temporary DNS outage never blocks a real customer.
 */
export async function checkEmail(email: string): Promise<EmailCheck> {
  if (isDisposableEmail(email)) return 'disposable';
  const domain = email.split('@')[1]!.toLowerCase();
  try {
    const mx = await withTimeout(resolveMx(domain), 3000);
    return mx.length > 0 ? 'ok' : 'unreachable';
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== 'ENOTFOUND' && code !== 'ENODATA') return 'ok';
  }
  // No MX record: mail servers fall back to the domain's address records.
  try {
    const a = await withTimeout(resolve4(domain), 3000);
    if (a.length > 0) return 'ok';
  } catch {
    /* try IPv6 */
  }
  try {
    const aaaa = await withTimeout(resolve6(domain), 3000);
    return aaaa.length > 0 ? 'ok' : 'unreachable';
  } catch (err) {
    const code = (err as { code?: string }).code;
    return code === 'ENOTFOUND' || code === 'ENODATA' ? 'unreachable' : 'ok';
  }
}
