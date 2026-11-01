import { createHmac, randomBytes } from 'node:crypto';
import { safeEqual } from './crypto';

// RFC 6238 time-based one-time passwords (HMAC-SHA1, 30 second steps), compatible with
// Google Authenticator, Microsoft Authenticator, Authy, 1Password and Bitwarden.

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/[\s=-]/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function hotp(secret: Buffer, counter: number, digits: number): string {
  const msg = Buffer.alloc(8);
  msg.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  msg.writeUInt32BE(counter >>> 0, 4);
  const h = createHmac('sha1', secret).update(msg).digest();
  const offset = h[h.length - 1]! & 0x0f;
  const bin =
    ((h[offset]! & 0x7f) << 24) | ((h[offset + 1]! & 0xff) << 16) | ((h[offset + 2]! & 0xff) << 8) | (h[offset + 3]! & 0xff);
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export function totpAt(secretB32: string, timeMs: number, opts: { digits?: number; period?: number } = {}): string {
  const { digits = 6, period = 30 } = opts;
  return hotp(base32Decode(secretB32), Math.floor(timeMs / 1000 / period), digits);
}

export interface TotpResult {
  ok: boolean;
  step?: number;
}

/**
 * Checks a code against the current step and one step either side (clock drift).
 * `lastUsedStep` blocks replay: a step that was already accepted can never be accepted again.
 */
export function verifyTotp(
  secretB32: string,
  code: string,
  opts: { now?: number; window?: number; lastUsedStep?: number | null; digits?: number; period?: number } = {},
): TotpResult {
  const { now = Date.now(), window = 1, lastUsedStep = null, digits = 6, period = 30 } = opts;
  if (!new RegExp(`^\\d{${digits}}$`).test(code)) return { ok: false };
  const secret = base32Decode(secretB32);
  const current = Math.floor(now / 1000 / period);
  let matched: number | undefined;
  for (let w = -window; w <= window; w++) {
    const step = current + w;
    if (lastUsedStep !== null && step <= lastUsedStep) continue;
    // Do not exit early so timing does not reveal which step matched.
    if (safeEqual(hotp(secret, step, digits), code) && matched === undefined) matched = step;
  }
  return matched === undefined ? { ok: false } : { ok: true, step: matched };
}

export function otpauthUri(secretB32: string, account: string, issuer: string): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({ secret: secretB32, issuer, algorithm: 'SHA1', digits: '6', period: '30' });
  return `otpauth://totp/${label}?${params.toString()}`;
}
