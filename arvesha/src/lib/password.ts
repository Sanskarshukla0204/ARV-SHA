import { createHash } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import type { Algorithm } from '@node-rs/argon2';
import { env } from './env';

// Argon2id with 64 MiB memory, 3 passes. This exceeds the OWASP minimum and the RFC 9106
// "low memory" profile. An optional server-side pepper (PASSWORD_PEPPER) is mixed in as the
// Argon2 secret, so a leaked database alone cannot be attacked offline.

const ARGON2ID = 2 as Algorithm; // Argon2d = 0, Argon2i = 1, Argon2id = 2

const PARAMS = {
  algorithm: ARGON2ID,
  memoryCost: 65_536, // KiB
  timeCost: 3,
  parallelism: 1,
  outputLen: 32,
} as const;

function pepper(): Buffer | undefined {
  const p = env('PASSWORD_PEPPER');
  if (!p) {
    if (process.env.NODE_ENV === 'production') throw new Error('PASSWORD_PEPPER is not set');
    return undefined;
  }
  return Buffer.from(p, 'utf8');
}

export async function hashPassword(password: string): Promise<string> {
  const secret = pepper();
  const out = await hash(password, secret ? { ...PARAMS, secret } : { ...PARAMS });
  if (!out.startsWith('$argon2id$')) throw new Error('Password hash is not Argon2id');
  return out;
}

export async function verifyPassword(stored: string | null | undefined, password: string): Promise<boolean> {
  if (!stored || !stored.startsWith('$argon2id$')) return false;
  try {
    const secret = pepper();
    return await verify(stored, password, secret ? { secret } : undefined);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/** Spend the same time as a real check when the account does not exist, so timing does not reveal it. */
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword('not-a-real-password-for-timing-only');
  await verifyPassword(await dummyHash, password);
}

// ------------------------------------------------------------------- policy

const COMMON = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234', 'passw0rd123', 'qwertyuiop', 'qwerty12345',
  'qwerty123456', '1234567890', '12345678910', '0123456789', 'iloveyou123', 'welcome1234', 'letmein1234', 'admin12345',
  'abcd123456', 'abcdefghij', 'india12345', 'india123456', 'arvesha123', 'arvesha1234', 'clothing123', 'shopping123',
  'password@123', 'pass@12345', 'p@ssw0rd123', 'changeme123', 'welcome@123', 'iloveyou@123',
]);

export interface PasswordContext {
  email?: string | null;
  name?: string | null;
  phone?: string | null;
}

/** Returns a message when the password is not acceptable, otherwise null. */
export function checkPasswordPolicy(password: string, ctx: PasswordContext = {}): string | null {
  if (password.length < 10) return 'Use at least 10 characters.';
  if (password.length > 128) return 'Use at most 128 characters.';
  if (/^(.)\1+$/.test(password)) return 'Do not repeat a single character.';

  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return 'This password is too common. Choose something less guessable.';

  const classes =
    Number(/[a-z]/.test(password)) + Number(/[A-Z]/.test(password)) + Number(/\d/.test(password)) + Number(/[^A-Za-z0-9]/.test(password));
  if (classes < 2 && password.length < 16) return 'Mix letters with numbers or symbols, or use 16 or more characters.';

  const bits: string[] = [];
  if (ctx.email) bits.push(ctx.email.split('@')[0] ?? '');
  if (ctx.name) bits.push(...ctx.name.toLowerCase().split(/\s+/));
  if (ctx.phone) bits.push(ctx.phone.replace(/\D/g, '').slice(-10));
  for (const b of bits) {
    const t = b.toLowerCase();
    if (t.length >= 4 && lower.includes(t)) return 'Do not include your name, email or phone number in the password.';
  }
  return null;
}

/**
 * Checks the Have I Been Pwned range API using k-anonymity: only the first 5 characters of the
 * SHA-1 hash leave the server. Fails open (returns false) if the service cannot be reached.
 */
export async function isPwnedPassword(password: string): Promise<boolean> {
  try {
    const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'arvesha-clothing' },
      signal: AbortSignal.timeout(2500),
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const body = await res.text();
    for (const line of body.split('\n')) {
      const [s, count] = line.trim().split(':');
      if (s === suffix && Number(count) > 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Full check used when a password is created or changed. Returns a message or null. */
export async function assertPasswordAcceptable(password: string, ctx: PasswordContext = {}): Promise<string | null> {
  const policy = checkPasswordPolicy(password, ctx);
  if (policy) return policy;
  if (await isPwnedPassword(password)) return 'This password appeared in a known data breach. Choose a different one.';
  return null;
}
