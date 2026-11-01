import { db, isUniqueViolation, tx } from './db';
import { newPublicId, randomToken, safeEqual, sha256 } from './crypto';
import { env } from './env';
import { HttpError } from './http';
import { fromTruecaller } from './phone';
import { absoluteUrl, SITE } from './site';

// Truecaller one-tap web login (the "web verify" flow).
//
//   1. start():    server creates a random nonce and returns a truecallersdk:// deep link.
//   2. Browser opens the link. If the Truecaller app is installed, a sheet asks the person to continue.
//   3. callback(): Truecaller's servers POST { requestId, accessToken, endpoint } to /api/auth/truecaller/callback.
//                  We fetch the profile from `endpoint` with the access token, which proves the mobile number.
//   4. poll():     the browser polls with its nonce and a secret only it holds; once verified we sign it in.
//
// You need an app key from the Truecaller developer portal, with the callback URL
//   https://YOUR-DOMAIN/api/auth/truecaller/callback
// registered against it. Set TRUECALLER_APP_KEY and TRUECALLER_APP_NAME. Truecaller changes this flow from
// time to time, so compare this file against their current "web verification" documentation before launch.

export const REQUEST_TTL_MS = 3 * 60 * 1000;

export function truecallerConfigured(): boolean {
  return !!env('TRUECALLER_APP_KEY') && !!env('TRUECALLER_APP_NAME');
}

export interface TruecallerStart {
  nonce: string;
  browserSecret: string;
  deepLink: string;
  ttlMs: number;
}

export async function startTruecaller(ip: string): Promise<TruecallerStart> {
  if (!truecallerConfigured()) throw new HttpError(503, 'unavailable', 'Truecaller login is not available right now.');
  const nonce = randomToken(18).replace(/[-_]/g, 'x'); // letters and digits only
  const browserSecret = randomToken(24);
  await db.query(
    `INSERT INTO truecaller_requests (nonce_hash, browser_hash, ip, expires_at) VALUES ($1, $2, $3, now() + ($4 || ' milliseconds')::interval)`,
    [sha256(nonce), sha256(browserSecret), ip, String(REQUEST_TTL_MS)],
  );
  const q = new URLSearchParams({
    type: 'btmsheet',
    requestNonce: nonce,
    partnerKey: env('TRUECALLER_APP_KEY')!,
    partnerName: env('TRUECALLER_APP_NAME') ?? SITE.name,
    lang: 'en',
    privacyUrl: absoluteUrl('/legal/privacy-policy'),
    termsUrl: absoluteUrl('/legal/terms-of-service'),
    ttl: String(REQUEST_TTL_MS),
  });
  return { nonce, browserSecret, deepLink: `truecallersdk://truesdk/web_verify?${q.toString()}`, ttlMs: REQUEST_TTL_MS };
}

/** Only follow profile endpoints on Truecaller's own domains over HTTPS. Stops the callback being used to make us call arbitrary URLs. */
export function isTrustedProfileEndpoint(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length > 300) return false;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return false;
  const host = u.hostname.toLowerCase();
  return host === 'truecaller.com' || host.endsWith('.truecaller.com');
}

export interface TruecallerProfile {
  phone: string | null;
  name: string | null;
  email: string | null;
}

/** Truecaller returns slightly different shapes over time, so read defensively. */
export function parseProfile(data: any): TruecallerProfile {
  const first = data?.name?.first ?? data?.firstName ?? data?.first_name;
  const last = data?.name?.last ?? data?.lastName ?? data?.last_name;
  const fullName = typeof data?.name === 'string' ? data.name : [first, last].filter((x) => typeof x === 'string' && x).join(' ');
  const rawPhone = Array.isArray(data?.phoneNumbers) ? data.phoneNumbers[0] : (data?.phoneNumber ?? data?.phone_number ?? data?.phone);
  const emailRaw = data?.onlineIdentities?.email ?? data?.email;
  const email = typeof emailRaw === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) && emailRaw.length <= 254 ? emailRaw.toLowerCase() : null;
  const name = fullName.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 80);
  return { phone: fromTruecaller(rawPhone), name: name || null, email };
}

export interface CallbackBody {
  requestId?: unknown;
  accessToken?: unknown;
  endpoint?: unknown;
  status?: unknown;
}

/** Called by Truecaller's servers. Returns quietly in every case so the caller learns nothing about our state. */
export async function handleCallback(body: CallbackBody): Promise<void> {
  const requestId = typeof body.requestId === 'string' && /^[A-Za-z0-9]{8,64}$/.test(body.requestId) ? body.requestId : null;
  if (!requestId) return;
  const hash = sha256(requestId);

  const row = await db.one<{ status: string }>(`SELECT status FROM truecaller_requests WHERE nonce_hash = $1 AND expires_at > now()`, [hash]);
  if (!row || row.status !== 'pending') return;

  const token = typeof body.accessToken === 'string' ? body.accessToken : '';
  if (!token) {
    // The person dismissed the sheet or chose another method.
    await db.query(`UPDATE truecaller_requests SET status = 'rejected' WHERE nonce_hash = $1 AND status = 'pending'`, [hash]);
    return;
  }
  if (!isTrustedProfileEndpoint(body.endpoint) || token.length > 2048) {
    console.error('[truecaller] callback rejected: untrusted endpoint or token');
    await db.query(`UPDATE truecaller_requests SET status = 'rejected' WHERE nonce_hash = $1 AND status = 'pending'`, [hash]);
    return;
  }

  let profile: TruecallerProfile;
  try {
    const res = await fetch(body.endpoint, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
      redirect: 'error',
    });
    if (!res.ok) throw new Error(`profile endpoint returned ${res.status}`);
    profile = parseProfile(await res.json());
  } catch (err) {
    console.error('[truecaller] profile fetch failed', (err as Error).message);
    await db.query(`UPDATE truecaller_requests SET status = 'rejected' WHERE nonce_hash = $1 AND status = 'pending'`, [hash]);
    return;
  }
  if (!profile.phone) {
    await db.query(`UPDATE truecaller_requests SET status = 'rejected' WHERE nonce_hash = $1 AND status = 'pending'`, [hash]);
    return;
  }
  await db.query(
    `UPDATE truecaller_requests SET status = 'verified', phone = $2, full_name = $3, email = $4 WHERE nonce_hash = $1 AND status = 'pending'`,
    [hash, profile.phone, profile.name, profile.email],
  );
}

export type PollResult =
  | { status: 'pending' }
  | { status: 'rejected' | 'expired' }
  | { status: 'verified'; userId: string; isNew: boolean; profileComplete: boolean };

export async function pollTruecaller(nonce: string, browserSecret: string): Promise<PollResult> {
  if (!/^[A-Za-z0-9]{8,64}$/.test(nonce)) return { status: 'expired' };
  const hash = sha256(nonce);
  const row = await db.one<{ browser_hash: string; status: string; expires_at: Date }>(
    `SELECT browser_hash, status, expires_at FROM truecaller_requests WHERE nonce_hash = $1`,
    [hash],
  );
  if (!row || !safeEqual(row.browser_hash, sha256(browserSecret))) return { status: 'expired' };
  if (new Date(row.expires_at).getTime() < Date.now() && row.status !== 'verified') return { status: 'expired' };
  if (row.status === 'pending') return { status: 'pending' };
  if (row.status === 'rejected') return { status: 'rejected' };
  if (row.status === 'consumed') return { status: 'expired' };

  // verified: spend the request exactly once
  const claimed = await db.one<{ phone: string; full_name: string | null; email: string | null }>(
    `UPDATE truecaller_requests SET status = 'consumed'
      WHERE nonce_hash = $1 AND status = 'verified' RETURNING phone, full_name, email`,
    [hash],
  );
  if (!claimed) return { status: 'expired' };
  // The profile data was only needed to create the account; do not keep it on the request row.
  await db.query(`UPDATE truecaller_requests SET full_name = NULL, email = NULL WHERE nonce_hash = $1`, [hash]);
  const who = await loginOrCreateFromTruecaller({ phone: claimed.phone, name: claimed.full_name, email: claimed.email });
  return { status: 'verified', ...who };
}

/**
 * Finds the customer who owns this mobile number, or creates one.
 *
 * Truecaller proves the number belongs to whoever is holding the phone, which is stronger than an unverified
 * number typed into the sign-up form. So if an email sign-up claimed the number without verifying it, the number
 * is taken away from that account instead of letting its creator (who may not own the number) be logged in as them.
 */
export async function loginOrCreateFromTruecaller(p: TruecallerProfile & { phone: string }): Promise<{ userId: string; isNew: boolean; profileComplete: boolean }> {
  return tx(async (q) => {
    const existing = await q.one<{ id: string; status: string; phone_verified_at: Date | null; email: string | null; profile_complete: boolean }>(
      `SELECT id, status, phone_verified_at, email, profile_complete FROM users WHERE phone = $1 FOR UPDATE`,
      [p.phone],
    );
    if (existing) {
      if (existing.status !== 'active') throw new HttpError(403, 'unavailable', 'This account is not available. Contact support for help.');
      if (existing.phone_verified_at) return { userId: existing.id, isNew: false, profileComplete: existing.profile_complete };
      if (!existing.email) {
        // A number-only account with no verification. Treat the Truecaller proof as the verification.
        await q.query(`UPDATE users SET phone_verified_at = now(), updated_at = now() WHERE id = $1`, [existing.id]);
        return { userId: existing.id, isNew: false, profileComplete: existing.profile_complete };
      }
      // Unverified claim on this number by an email sign-up: release the number from that account.
      await q.query(`UPDATE users SET phone = NULL, updated_at = now() WHERE id = $1`, [existing.id]);
    }

    let emailToUse: string | null = null;
    if (p.email) {
      const taken = await q.one(`SELECT 1 FROM users WHERE email = $1`, [p.email]);
      if (!taken) emailToUse = p.email;
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await q.query('SAVEPOINT create_user');
        const row = await q.one<{ id: string }>(
          `INSERT INTO users (public_id, name, email, phone, phone_verified_at, signup_method, profile_complete, terms_accepted_at)
           VALUES ($1, $2, $3, $4, now(), 'truecaller', false, now()) RETURNING id`,
          [newPublicId(), p.name ?? 'Customer', emailToUse, p.phone],
        );
        await q.query('RELEASE SAVEPOINT create_user');
        return { userId: row!.id, isNew: true, profileComplete: false };
      } catch (err) {
        await q.query('ROLLBACK TO SAVEPOINT create_user');
        if (isUniqueViolation(err, 'public_id')) continue;
        throw err;
      }
    }
    throw new HttpError(500, 'server_error', 'Something went wrong on our side. Please try again.');
  });
}

export async function purgeTruecallerRequests(): Promise<number> {
  const rows = await db.query(`DELETE FROM truecaller_requests WHERE expires_at < now() - interval '1 hour' RETURNING 1`);
  return rows.length;
}
