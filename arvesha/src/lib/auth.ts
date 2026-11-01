import { db, isUniqueViolation, tx } from './db';
import { newPublicId, randomCode, randomToken, safeEqual, sha256 } from './crypto';
import { checkEmail } from './emailcheck';
import { absoluteUrl } from './site';
import { GENERIC_AUTH_ERROR, HttpError, bucket } from './http';
import { sendMail } from './mail';
import { passwordChangedMail, resetPasswordMail, verifyEmailMail } from './email-templates';
import { assertPasswordAcceptable, burnPasswordCheck, hashPassword, verifyPassword } from './password';
import { normalizeIN } from './phone';
import { consume } from './ratelimit';
import { createSession, revokeAllSessions } from './session';
import { mergeGuestCart } from './cart';
import { ValidationError } from './validate';

export const VERIFY_EMAIL_HOURS = 24;
export const RESET_MINUTES = 60;
const PHONE_CODE_MINUTES = 10;
const PHONE_CODE_MAX_ATTEMPTS = 5;

export interface RequestMeta {
  ip: string;
  ua: string;
}

export type LoginMethod = 'password' | 'truecaller' | 'register' | 'reset';

export async function logLoginEvent(userId: string | null, method: string, success: boolean, reason: string | null, meta: RequestMeta) {
  try {
    await db.query(`INSERT INTO login_events (user_id, method, success, reason, ip, user_agent) VALUES ($1, $2, $3, $4, $5, $6)`, [
      userId,
      method,
      success,
      reason,
      meta.ip,
      meta.ua.slice(0, 300),
    ]);
  } catch (err) {
    console.error('[auth] could not record login event', (err as Error).message);
  }
}

// --------------------------------------------------------------- link tokens

type LinkPurpose = 'verify_email' | 'reset_password';

/** Creates a single-use link token. Only its hash is stored. Older unused tokens for the same purpose stop working. */
export async function createLinkToken(userId: string, purpose: LinkPurpose, target: string, ttlMinutes: number): Promise<string> {
  const token = randomToken(32);
  await db.query(`UPDATE auth_tokens SET used_at = now() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`, [userId, purpose]);
  await db.query(
    `INSERT INTO auth_tokens (user_id, purpose, token_hash, target, expires_at) VALUES ($1, $2, $3, $4, now() + ($5 || ' minutes')::interval)`,
    [userId, purpose, sha256(token), target, String(ttlMinutes)],
  );
  return token;
}

interface TokenRow {
  id: string;
  user_id: string;
  target: string | null;
}

/** Checks a token without using it. For showing the right page before the person submits. */
export async function peekLinkToken(token: string, purpose: LinkPurpose): Promise<TokenRow | null> {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null;
  return db.one<TokenRow>(
    `SELECT id, user_id, target FROM auth_tokens WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()`,
    [sha256(token), purpose],
  );
}

/** Atomically spends a token. Returns null if it was already used, expired or never existed. */
export async function consumeLinkToken(token: string, purpose: LinkPurpose): Promise<TokenRow | null> {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null;
  return db.one<TokenRow>(
    `UPDATE auth_tokens SET used_at = now()
      WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()
      RETURNING id, user_id, target`,
    [sha256(token), purpose],
  );
}

// --------------------------------------------------------------- registration

export interface RegisterInput {
  name: string;
  dob: string;
  phone: string;
  email: string;
  password: string;
  marketingOptIn: boolean;
}

export const CANNOT_CREATE =
  'We could not create an account with these details. If you already registered, log in or reset your password.';

export async function registerUser(input: RegisterInput, meta: RequestMeta): Promise<string> {
  const verdict = await checkEmail(input.email);
  if (verdict === 'disposable') throw new ValidationError({ email: 'Temporary email addresses are not accepted. Use your regular email address.' });
  if (verdict === 'unreachable') throw new ValidationError({ email: 'We could not find a mail server for this email domain. Check the spelling.' });

  const weak = await assertPasswordAcceptable(input.password, { email: input.email, name: input.name, phone: input.phone });
  if (weak) throw new ValidationError({ password: weak });

  const passwordHash = await hashPassword(input.password);

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const row = await db.one<{ id: string }>(
        `INSERT INTO users (public_id, name, dob, email, phone, password_hash, signup_method, marketing_opt_in, terms_accepted_at, signup_ip)
         VALUES ($1, $2, $3, $4, $5, $6, 'email', $7, now(), $8)
         RETURNING id`,
        [newPublicId(), input.name, input.dob, input.email, input.phone, passwordHash, input.marketingOptIn, meta.ip],
      );
      return row!.id;
    } catch (err) {
      if (isUniqueViolation(err, 'public_id')) continue; // ID collision, pick another
      if (isUniqueViolation(err)) throw new HttpError(409, 'cannot_create', CANNOT_CREATE);
      throw err;
    }
  }
  throw new HttpError(500, 'server_error', 'Something went wrong on our side. Please try again.');
}

/** Sign the person in on this browser: new session, last-login details, guest cart merge, audit trail. */
export async function finishLogin(userId: string, method: LoginMethod, meta: RequestMeta): Promise<void> {
  await createSession(userId, meta);
  await db.query(`UPDATE users SET last_login_at = now(), last_login_ip = $2, failed_logins = 0, updated_at = now() WHERE id = $1`, [userId, meta.ip]);
  await logLoginEvent(userId, method, true, null, meta);
  try {
    await mergeGuestCart(userId);
  } catch (err) {
    console.error('[auth] guest cart merge failed', (err as Error).message);
  }
}

// ---------------------------------------------------------------- email verify

export async function sendVerificationEmail(user: { id: string; name: string; email: string }): Promise<boolean> {
  const token = await createLinkToken(user.id, 'verify_email', user.email, VERIFY_EMAIL_HOURS * 60);
  const mail = verifyEmailMail({ name: user.name, link: absoluteUrl(`/verify-email?token=${encodeURIComponent(token)}`), hours: VERIFY_EMAIL_HOURS });
  return sendMail({ to: user.email, ...mail });
}

export async function confirmEmailToken(token: string): Promise<boolean> {
  const t = await consumeLinkToken(token, 'verify_email');
  if (!t || !t.target) return false;
  const row = await db.one<{ id: string }>(
    `UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now()
      WHERE id = $1 AND email = $2 AND status = 'active' RETURNING id`,
    [t.user_id, t.target],
  );
  return !!row;
}

// ----------------------------------------------------------------- password login

interface UserLookup {
  id: string;
  name: string;
  email: string | null;
  password_hash: string | null;
  status: string;
}

async function findByIdentifier(identifier: string): Promise<{ user: UserLookup | null; normalized: string | null }> {
  const raw = identifier.trim();
  if (raw.includes('@')) {
    const email = raw.toLowerCase();
    if (email.length > 254) return { user: null, normalized: null };
    const user = await db.one<UserLookup>(`SELECT id, name, email, password_hash, status FROM users WHERE email = $1`, [email]);
    return { user, normalized: email };
  }
  const phone = normalizeIN(raw);
  if (!phone) return { user: null, normalized: null };
  const user = await db.one<UserLookup>(`SELECT id, name, email, password_hash, status FROM users WHERE phone = $1`, [phone]);
  return { user, normalized: phone };
}

/** Verifies an email-or-mobile plus password. Every failure returns the same generic error. */
export async function authenticate(identifier: string, password: string, meta: RequestMeta): Promise<string> {
  const { user, normalized } = await findByIdentifier(identifier);

  // Throttle per identifier whether or not the account exists, so responses reveal nothing.
  const rl = await consume('login-id', bucket(normalized ?? identifier.trim().slice(0, 100)), 10, 900);
  if (!rl.allowed) {
    throw new HttpError(429, 'rate_limited', 'Too many attempts. Please wait a few minutes and try again.', undefined, { 'Retry-After': String(rl.retryAfterSec) });
  }

  if (!user || user.status !== 'active' || !user.password_hash) {
    await burnPasswordCheck(password);
    await logLoginEvent(null, 'password', false, 'unknown_or_ineligible', meta);
    throw new HttpError(401, 'invalid_credentials', GENERIC_AUTH_ERROR);
  }
  const ok = await verifyPassword(user.password_hash, password);
  if (!ok) {
    await db.query(`UPDATE users SET failed_logins = failed_logins + 1 WHERE id = $1`, [user.id]);
    await logLoginEvent(user.id, 'password', false, 'bad_password', meta);
    throw new HttpError(401, 'invalid_credentials', GENERIC_AUTH_ERROR);
  }
  return user.id;
}

// ---------------------------------------------------------------- password reset

/** Always completes quietly so the response never reveals whether an account exists. */
export async function requestPasswordReset(identifier: string, meta: RequestMeta): Promise<void> {
  const { user, normalized } = await findByIdentifier(identifier);
  const rl = await consume('reset-id', bucket(normalized ?? identifier.trim().slice(0, 100)), 3, 3600);
  if (!rl.allowed || !user || user.status !== 'active' || !user.email) return;
  const token = await createLinkToken(user.id, 'reset_password', user.email, RESET_MINUTES);
  const mail = resetPasswordMail({ name: user.name, link: absoluteUrl(`/reset-password?token=${encodeURIComponent(token)}`), minutes: RESET_MINUTES });
  await sendMail({ to: user.email, ...mail });
  await logLoginEvent(user.id, 'reset', true, 'reset_requested', meta);
}

export async function completePasswordReset(token: string, newPassword: string, meta: RequestMeta): Promise<void> {
  const peek = await peekLinkToken(token, 'reset_password');
  if (!peek) throw new HttpError(400, 'invalid_token', 'This reset link is no longer valid. Request a new one.');
  const user = await db.one<{ id: string; name: string; email: string | null; phone: string | null }>(
    `SELECT id, name, email, phone FROM users WHERE id = $1 AND status = 'active'`,
    [peek.user_id],
  );
  if (!user) throw new HttpError(400, 'invalid_token', 'This reset link is no longer valid. Request a new one.');

  const weak = await assertPasswordAcceptable(newPassword, { email: user.email, name: user.name, phone: user.phone });
  if (weak) throw new ValidationError({ password: weak });
  const hash = await hashPassword(newPassword);

  const spent = await consumeLinkToken(token, 'reset_password');
  if (!spent) throw new HttpError(400, 'invalid_token', 'This reset link is no longer valid. Request a new one.');

  await db.query(
    `UPDATE users SET password_hash = $2, failed_logins = 0,
            email_verified_at = CASE WHEN email = $3 THEN COALESCE(email_verified_at, now()) ELSE email_verified_at END,
            updated_at = now()
      WHERE id = $1`,
    [user.id, hash, spent.target],
  );
  await revokeAllSessions(user.id);
  await logLoginEvent(user.id, 'reset', true, 'password_changed', meta);
  if (user.email) await sendMail({ to: user.email, ...passwordChangedMail({ name: user.name }) });
}

export async function changePassword(
  user: { id: string; name: string; email: string | null; phone: string | null; sessionId: string },
  currentPassword: string,
  newPassword: string,
  meta: RequestMeta,
): Promise<void> {
  const row = await db.one<{ password_hash: string | null }>(`SELECT password_hash FROM users WHERE id = $1`, [user.id]);
  // Accounts created through Truecaller have no password yet; they may set one without a current password.
  if (row?.password_hash) {
    const ok = await verifyPassword(row.password_hash, currentPassword);
    if (!ok) throw new ValidationError({ currentPassword: 'Your current password is not correct.' });
  }
  const weak = await assertPasswordAcceptable(newPassword, { email: user.email, name: user.name, phone: user.phone });
  if (weak) throw new ValidationError({ newPassword: weak });
  const hash = await hashPassword(newPassword);
  await db.query(`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, [user.id, hash]);
  await revokeAllSessions(user.id, user.sessionId);
  await logLoginEvent(user.id, 'password', true, 'password_changed', meta);
  if (user.email) await sendMail({ to: user.email, ...passwordChangedMail({ name: user.name }) });
}

// ------------------------------------------------------------ mobile verification

export async function startPhoneVerification(userId: string, phone: string): Promise<string> {
  const code = randomCode(6);
  await db.query(`UPDATE auth_tokens SET used_at = now() WHERE user_id = $1 AND purpose = 'verify_phone' AND used_at IS NULL`, [userId]);
  await db.query(
    `INSERT INTO auth_tokens (user_id, purpose, token_hash, target, expires_at)
     VALUES ($1, 'verify_phone', $2, $3, now() + ($4 || ' minutes')::interval)`,
    [userId, sha256(`${userId}:${code}`), phone, String(PHONE_CODE_MINUTES)],
  );
  return code;
}

export async function confirmPhoneCode(userId: string, code: string): Promise<boolean> {
  return tx(async (q) => {
    const t = await q.one<{ id: string; token_hash: string; target: string | null; attempts: number }>(
      `SELECT id, token_hash, target, attempts FROM auth_tokens
        WHERE user_id = $1 AND purpose = 'verify_phone' AND used_at IS NULL AND expires_at > now()
        ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [userId],
    );
    if (!t || t.attempts >= PHONE_CODE_MAX_ATTEMPTS) return false;
    if (!safeEqual(t.token_hash, sha256(`${userId}:${code}`))) {
      await q.query(`UPDATE auth_tokens SET attempts = attempts + 1 WHERE id = $1`, [t.id]);
      return false;
    }
    await q.query(`UPDATE auth_tokens SET used_at = now() WHERE id = $1`, [t.id]);
    const r = await q.one(`UPDATE users SET phone_verified_at = now(), updated_at = now() WHERE id = $1 AND phone = $2 RETURNING id`, [userId, t.target]);
    return !!r;
  });
}
