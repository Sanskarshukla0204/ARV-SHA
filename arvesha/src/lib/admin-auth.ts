import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { audit } from './audit';
import { decryptSecret, encryptSecret, hmacSha256, randomFromAlphabet, randomToken, safeEqual, sha256 } from './crypto';
import { db } from './db';
import { adminPath, env, isProd } from './env';
import { GENERIC_AUTH_ERROR, HttpError, bucket } from './http';
import { burnPasswordCheck, checkPasswordPolicy, hashPassword, verifyPassword } from './password';
import { consume } from './ratelimit';
import { generateTotpSecret, otpauthUri, verifyTotp } from './totp';
import { SITE } from './site';

// Admin access has three independent layers:
//   1. The panel only exists at a secret URL path (ADMIN_PATH). Middleware rewrites it to an internal route
//      and returns a plain 404 for the internal route itself and for /admin, so there is nothing to find.
//   2. Sign-in needs email, password AND a six digit code from an authenticator app (or a single-use recovery code).
//   3. Sessions are short, bound to the browser's user agent, httpOnly and SameSite=Strict, and every action is audited.

export const ADMIN_COOKIE = isProd ? '__Host-arv_admin' : 'arv_admin';
export const ADMIN_BASE_HEADER = 'x-admin-base';
export const ADMIN_SIG_HEADER = 'x-admin-sig';
const ABSOLUTE_MS = 8 * 3600 * 1000;
const IDLE_MS = 45 * 60 * 1000;
const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  sessionId: string;
}

interface Meta {
  ip: string;
  ua: string;
}

// ----------------------------------------------------------- gate signature

/** The value middleware signs into the request so the internal admin routes can trust the secret path. */
export function gateSignature(base: string): string {
  const secret = env('APP_SECRET');
  if (!secret) return '';
  return hmacSha256(secret, `admin-gate:${base}`);
}

/** The secret path this request came through, or null when the request did not pass the admin gate. */
export async function adminBase(): Promise<string | null> {
  const configured = adminPath();
  if (!configured) return null;
  const h = await headers();
  const base = h.get(ADMIN_BASE_HEADER);
  const sig = h.get(ADMIN_SIG_HEADER);
  if (!base || !sig || base !== `/${configured}`) return null;
  const expected = gateSignature(base);
  if (!expected || !safeEqual(expected, sig)) return null;
  return base;
}

/** For admin pages: 404 unless the request came through the secret path. */
export async function requireGate(): Promise<string> {
  const base = await adminBase();
  if (!base) notFound();
  return base;
}

// ------------------------------------------------------------------ sign in

interface AdminRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  totp_secret_enc: string;
  recovery_hashes: string[];
  failed_attempts: number;
  locked_until: Date | null;
  last_totp_step: string | null;
  disabled: boolean;
}

export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export async function adminLogin(input: { email: string; password: string; code: string }, meta: Meta): Promise<AdminUser> {
  const email = input.email.trim().toLowerCase();
  const rl = await consume('admin-login-id', bucket(email), 8, 900);
  if (!rl.allowed) {
    throw new HttpError(429, 'rate_limited', 'Too many attempts. Wait 15 minutes and try again.', undefined, { 'Retry-After': String(rl.retryAfterSec) });
  }

  const deny = async (adminId: string | null, reason: string): Promise<never> => {
    await audit({ adminId, adminEmail: adminId ? email : null, action: 'admin.login_failed', meta: { reason }, ip: meta.ip });
    throw new HttpError(401, 'invalid_credentials', GENERIC_AUTH_ERROR);
  };

  const admin = await db.one<AdminRow>(`SELECT * FROM admin_users WHERE email = $1`, [email]);
  if (!admin || admin.disabled) {
    await burnPasswordCheck(input.password);
    return deny(null, 'unknown_or_disabled');
  }
  if (admin.locked_until && new Date(admin.locked_until).getTime() > Date.now()) {
    await burnPasswordCheck(input.password);
    return deny(admin.id, 'locked');
  }

  const registerFailure = async (reason: string): Promise<never> => {
    const row = await db.one<{ failed_attempts: number }>(
      `UPDATE admin_users
          SET failed_attempts = failed_attempts + 1,
              locked_until = CASE WHEN failed_attempts + 1 >= $2 THEN now() + ($3 || ' minutes')::interval ELSE locked_until END
        WHERE id = $1 RETURNING failed_attempts`,
      [admin.id, MAX_FAILURES, String(LOCK_MINUTES)],
    );
    return deny(admin.id, `${reason}:${row?.failed_attempts ?? '?'}`);
  };

  const passwordOk = await verifyPassword(admin.password_hash, input.password);
  if (!passwordOk) return registerFailure('bad_password');

  const code = input.code.trim();
  let secondFactor = false;
  if (/^\d{6}$/.test(code)) {
    const secret = decryptSecret(admin.totp_secret_enc);
    const last = admin.last_totp_step === null ? null : Number(admin.last_totp_step);
    const r = verifyTotp(secret, code, { lastUsedStep: last });
    if (r.ok && r.step !== undefined) {
      // Atomic compare-and-set: two parallel requests cannot both spend the same code.
      const claimed = await db.one(
        `UPDATE admin_users SET last_totp_step = $2 WHERE id = $1 AND (last_totp_step IS NULL OR last_totp_step < $2) RETURNING id`,
        [admin.id, r.step],
      );
      secondFactor = !!claimed;
    }
  } else {
    const norm = normalizeRecoveryCode(code);
    if (norm.length === 10) {
      const h = sha256(norm);
      const used = await db.one(
        `UPDATE admin_users SET recovery_hashes = array_remove(recovery_hashes, $2) WHERE id = $1 AND $2 = ANY(recovery_hashes) RETURNING id`,
        [admin.id, h],
      );
      secondFactor = !!used;
      if (used) await audit({ adminId: admin.id, adminEmail: admin.email, action: 'admin.recovery_code_used', ip: meta.ip });
    }
  }
  if (!secondFactor) return registerFailure('bad_code');

  await db.query(`UPDATE admin_users SET failed_attempts = 0, locked_until = NULL, last_login_at = now(), last_login_ip = $2 WHERE id = $1`, [admin.id, meta.ip]);

  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + ABSOLUTE_MS);
  const session = await db.one<{ id: string }>(
    `INSERT INTO admin_sessions (admin_id, token_hash, ip, user_agent, expires_at) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [admin.id, sha256(token), meta.ip, meta.ua.slice(0, 300), expiresAt],
  );
  (await cookies()).set(ADMIN_COOKIE, token, { httpOnly: true, secure: isProd, sameSite: 'strict', path: '/', expires: expiresAt });
  await audit({ adminId: admin.id, adminEmail: admin.email, action: 'admin.login', ip: meta.ip });
  return { id: admin.id, email: admin.email, name: admin.name, sessionId: session!.id };
}

// ------------------------------------------------------------------ sessions

/** The signed-in admin for this request, or null. Cached for one request. */
export const getAdmin = cache(async (): Promise<AdminUser | null> => {
  const base = await adminBase();
  if (!base) return null; // not through the secret path: never recognise the cookie
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token || token.length < 20 || token.length > 200) return null;

  const row = await db.one<{ session_id: string; admin_id: string; email: string; name: string; last_seen_at: Date; user_agent: string | null }>(
    `SELECT s.id AS session_id, a.id AS admin_id, a.email, a.name, s.last_seen_at, s.user_agent
       FROM admin_sessions s JOIN admin_users a ON a.id = s.admin_id
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND NOT a.disabled`,
    [sha256(token)],
  );
  if (!row) return null;

  const now = Date.now();
  if (now - new Date(row.last_seen_at).getTime() > IDLE_MS) return null;
  const h = await headers();
  const ua = (h.get('user-agent') ?? '').slice(0, 300);
  if (row.user_agent && row.user_agent !== ua) return null; // cookie replayed from a different browser
  await db.query(`UPDATE admin_sessions SET last_seen_at = now() WHERE id = $1 AND last_seen_at < now() - interval '1 minute'`, [row.session_id]);
  return { id: row.admin_id, email: row.email, name: row.name, sessionId: row.session_id };
});

/** For admin pages: send signed-out visitors to the sign-in page at the secret path. */
export async function requireAdmin(): Promise<{ admin: AdminUser; base: string }> {
  const base = await requireGate();
  const admin = await getAdmin();
  if (!admin) redirect(base);
  return { admin, base };
}

export async function destroyAdminSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (token) await db.query(`UPDATE admin_sessions SET revoked_at = now() WHERE token_hash = $1`, [sha256(token)]);
  jar.set(ADMIN_COOKIE, '', { httpOnly: true, secure: isProd, sameSite: 'strict', path: '/', maxAge: 0 });
}

export async function revokeOtherAdminSessions(adminId: string, keepSessionId: string): Promise<void> {
  await db.query(`UPDATE admin_sessions SET revoked_at = now() WHERE admin_id = $1 AND id <> $2 AND revoked_at IS NULL`, [adminId, keepSessionId]);
}

// ------------------------------------------------------------ account setup

export function generateRecoveryCodes(count = 8): string[] {
  const alphabet = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  return Array.from({ length: count }, () => {
    const c = randomFromAlphabet(10, alphabet);
    return `${c.slice(0, 5)}-${c.slice(5)}`;
  });
}

export interface NewAdmin {
  email: string;
  name: string;
  totpSecret: string;
  otpauth: string;
  recoveryCodes: string[];
}

/** Used by `npm run admin:create`. The password is hashed with Argon2id; the authenticator seed is encrypted at rest. */
export async function createAdminUser(input: { email: string; name: string; password: string }): Promise<NewAdmin> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  if (input.password.length < 12) throw new Error('Use at least 12 characters for an admin password.');
  const weak = checkPasswordPolicy(input.password, { email, name: input.name });
  if (weak) throw new Error(weak);

  const totpSecret = generateTotpSecret();
  const recoveryCodes = generateRecoveryCodes();
  await db.query(
    `INSERT INTO admin_users (email, name, password_hash, totp_secret_enc, recovery_hashes)
     VALUES ($1, $2, $3, $4, $5)`,
    [email, input.name.trim(), await hashPassword(input.password), encryptSecret(totpSecret), recoveryCodes.map((c) => sha256(normalizeRecoveryCode(c)))],
  );
  return { email, name: input.name.trim(), totpSecret, otpauth: otpauthUri(totpSecret, email, SITE.name), recoveryCodes };
}

export async function changeAdminPassword(admin: AdminUser, current: string, next: string): Promise<void> {
  const row = await db.one<{ password_hash: string }>(`SELECT password_hash FROM admin_users WHERE id = $1`, [admin.id]);
  if (!row || !(await verifyPassword(row.password_hash, current))) throw new HttpError(422, 'invalid_password', 'Your current password is not correct.', { currentPassword: 'Your current password is not correct.' });
  if (next.length < 12) throw new HttpError(422, 'weak_password', 'Use at least 12 characters.', { newPassword: 'Use at least 12 characters.' });
  const weak = checkPasswordPolicy(next, { email: admin.email, name: admin.name });
  if (weak) throw new HttpError(422, 'weak_password', weak, { newPassword: weak });
  await db.query(`UPDATE admin_users SET password_hash = $2 WHERE id = $1`, [admin.id, await hashPassword(next)]);
  await revokeOtherAdminSessions(admin.id, admin.sessionId);
}
