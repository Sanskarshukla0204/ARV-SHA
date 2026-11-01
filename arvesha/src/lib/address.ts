import { db } from './db';
import { INDIAN_STATES, checkPincodeAgainstState } from './pincode';
import { ValidationError, v } from './validate';

const NAME_RE = /^[\p{L}][\p{L}\p{M} .'-]{1,79}$/u;

export const addressSchema = v.object({
  name: v.string({ min: 2, max: 80, label: 'Full name', pattern: NAME_RE, patternMessage: 'Use letters only in the name.' }),
  phone: v.phoneIN({ label: 'Mobile number' }),
  line1: v.string({ min: 5, max: 120, label: 'Address line 1' }),
  line2: v.optionalString({ max: 120, label: 'Address line 2' }),
  landmark: v.optionalString({ max: 80, label: 'Landmark' }),
  city: v.string({ min: 2, max: 60, label: 'City', pattern: /^[\p{L}][\p{L}\p{M} .'()-]*$/u, patternMessage: 'Enter a valid city name.' }),
  state: v.oneOf(INDIAN_STATES, 'State'),
  pincode: v.pincode(),
});

export type AddressInput = { name: string; phone: string; line1: string; line2?: string; landmark?: string; city: string; state: (typeof INDIAN_STATES)[number]; pincode: string };

/** Throws a field-level error when the PIN code does not exist or belongs to another state. Returns whether India Post confirmed it. */
export async function verifyAddress(a: AddressInput): Promise<boolean> {
  // A street line made only of digits or punctuation is not an address.
  if (!/[\p{L}]/u.test(a.line1)) throw new ValidationError({ line1: 'Enter the house number and street name.' });
  const check = await checkPincodeAgainstState(a.pincode, a.state);
  if (!check.ok) throw new ValidationError(check.errors);
  return check.verified;
}

export const MAX_SAVED_ADDRESSES = 10;

export async function saveAddress(userId: string, a: AddressInput, verified: boolean, opts: { label?: string; makeDefault?: boolean } = {}): Promise<string> {
  const count = await db.one<{ n: number }>(`SELECT count(*)::int AS n FROM addresses WHERE user_id = $1`, [userId]);
  if ((count?.n ?? 0) >= MAX_SAVED_ADDRESSES) throw new ValidationError({ '': `You can save up to ${MAX_SAVED_ADDRESSES} addresses. Delete one first.` });
  const first = (count?.n ?? 0) === 0;
  const makeDefault = opts.makeDefault || first;
  if (makeDefault) await db.query(`UPDATE addresses SET is_default = false WHERE user_id = $1`, [userId]);
  const row = await db.one<{ id: string }>(
    `INSERT INTO addresses (user_id, label, full_name, phone, line1, line2, landmark, city, state, pincode, pincode_verified, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
    [userId, opts.label ?? 'Home', a.name, a.phone, a.line1, a.line2 ?? null, a.landmark ?? null, a.city, a.state, a.pincode, verified, makeDefault],
  );
  return row!.id;
}

export interface SavedAddress {
  id: string;
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export async function listAddresses(userId: string): Promise<SavedAddress[]> {
  const rows = await db.query<{ id: string; label: string; full_name: string; phone: string; line1: string; line2: string | null; landmark: string | null; city: string; state: string; pincode: string; is_default: boolean }>(
    `SELECT id, label, full_name, phone, line1, line2, landmark, city, state, pincode, is_default FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`,
    [userId],
  );
  return rows.map((r) => ({ id: r.id, label: r.label, name: r.full_name, phone: r.phone, line1: r.line1, line2: r.line2, landmark: r.landmark, city: r.city, state: r.state, pincode: r.pincode, isDefault: r.is_default }));
}
