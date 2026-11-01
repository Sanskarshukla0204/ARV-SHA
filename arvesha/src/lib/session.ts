import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { db } from './db';
import { randomToken, sha256 } from './crypto';
import { isProd } from './env';

// Opaque random session tokens. Only the SHA-256 hash is stored, so a database leak cannot be
// replayed as a login. The cookie is httpOnly, Secure and SameSite=Lax.

export const SESSION_COOKIE = isProd ? '__Host-arv_session' : 'arv_session';
const ABSOLUTE_MS = 30 * 24 * 3600 * 1000;
const IDLE_MS = 14 * 24 * 3600 * 1000;
const TOUCH_AFTER_MS = 10 * 60 * 1000;

export interface SessionUser {
  id: string;
  publicId: string;
  name: string;
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  profileComplete: boolean;
  sessionId: string;
}

export async function createSession(userId: string, meta: { ip: string; ua: string }): Promise<void> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + ABSOLUTE_MS);
  await db.query(`INSERT INTO sessions (user_id, token_hash, ip, user_agent, expires_at) VALUES ($1, $2, $3, $4, $5)`, [
    userId,
    sha256(token),
    meta.ip,
    meta.ua.slice(0, 300),
    expiresAt,
  ]);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', expires: expiresAt });
}

interface SessionRow {
  session_id: string;
  last_seen_at: Date;
  id: string;
  public_id: string;
  name: string;
  email: string | null;
  email_verified_at: Date | null;
  phone: string | null;
  phone_verified_at: Date | null;
  profile_complete: boolean;
}

/** The signed-in customer for this request, or null. Cached for the duration of one request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length < 20 || token.length > 200) return null;

  const row = await db.one<SessionRow>(
    `SELECT s.id AS session_id, s.last_seen_at,
            u.id, u.public_id, u.name, u.email, u.email_verified_at, u.phone, u.phone_verified_at, u.profile_complete
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
        AND u.status = 'active'`,
    [sha256(token)],
  );
  if (!row) return null;

  const now = Date.now();
  const lastSeen = new Date(row.last_seen_at).getTime();
  if (now - lastSeen > IDLE_MS) return null;
  if (now - lastSeen > TOUCH_AFTER_MS) {
    await db.query(`UPDATE sessions SET last_seen_at = now() WHERE id = $1`, [row.session_id]);
  }

  return {
    id: row.id,
    publicId: row.public_id,
    name: row.name,
    email: row.email,
    emailVerified: !!row.email_verified_at,
    phone: row.phone,
    phoneVerified: !!row.phone_verified_at,
    profileComplete: row.profile_complete,
    sessionId: row.session_id,
  };
});

/** For server components: send signed-out visitors to the login page and come back afterwards. */
export async function requireUser(returnTo = '/account'): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.query(`UPDATE sessions SET revoked_at = now() WHERE token_hash = $1`, [sha256(token)]);
  jar.set(SESSION_COOKIE, '', { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge: 0 });
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  await db.query(`UPDATE sessions SET revoked_at = now() WHERE id = $1 AND user_id = $2`, [sessionId, userId]);
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await db.query(
    `UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL AND ($2::uuid IS NULL OR id <> $2::uuid)`,
    [userId, exceptSessionId ?? null],
  );
}

export interface SessionListItem {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  current: boolean;
}

export async function listSessions(userId: string, currentSessionId: string): Promise<SessionListItem[]> {
  const rows = await db.query<{ id: string; ip: string | null; user_agent: string | null; created_at: Date; last_seen_at: Date }>(
    `SELECT id, ip, user_agent, created_at, last_seen_at FROM sessions
      WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
      ORDER BY last_seen_at DESC LIMIT 20`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    ip: r.ip,
    userAgent: r.user_agent,
    createdAt: r.created_at,
    lastSeenAt: r.last_seen_at,
    current: r.id === currentSessionId,
  }));
}
