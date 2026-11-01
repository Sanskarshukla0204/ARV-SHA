import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import { env, requireEnv } from './env';

/** URL-safe random token. 32 bytes is 256 bits of entropy. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function hmacSha256(key: string | Buffer, message: string): string {
  return createHmac('sha256', key).update(message).digest('hex');
}

/** Constant-time string comparison that is safe for different lengths. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // Still burn comparable time, then report false.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/** Numeric one-time code, e.g. 6 digits, using a CSPRNG. */
export function randomCode(digits = 6): string {
  const max = 10 ** digits;
  return String(randomInt(0, max)).padStart(digits, '0');
}

// Crockford-style alphabet: no 0, 1, I, L, O, U so IDs are easy to read out loud.
const ID_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

export function randomFromAlphabet(length: number, alphabet = ID_ALPHABET): string {
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[randomInt(0, alphabet.length)];
  return out;
}

/** Individual customer ID shown to the customer and quoted in support, e.g. ARV-7K3QM2XP. */
export function newPublicId(): string {
  return `ARV-${randomFromAlphabet(8)}`;
}

// ---------------------------------------------------------------- encryption
// AES-256-GCM for small secrets stored in the database (admin TOTP seeds).
// DATA_ENCRYPTION_KEY must be 32 random bytes, base64 encoded. `npm run setup:secrets` creates one.

function dataKey(): Buffer {
  const raw = requireEnv('DATA_ENCRYPTION_KEY');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must decode to exactly 32 bytes');
  return key;
}

export function encryptSecret(plain: string, key: Buffer = dataKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join('.');
}

export function decryptSecret(blob: string, key: Buffer = dataKey()): string {
  const [version, iv, tag, ct] = blob.split('.');
  if (version !== 'v1' || !iv || !tag || !ct) throw new Error('Unsupported ciphertext format');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8');
}

/** Keyed hash used for IP bucketing and gate tokens. Falls back to a plain hash only outside production. */
export function appHmac(message: string): string {
  const secret = env('APP_SECRET');
  if (!secret) {
    if (process.env.NODE_ENV === 'production') throw new Error('APP_SECRET is not set');
    return sha256(`dev:${message}`);
  }
  return hmacSha256(secret, message);
}
