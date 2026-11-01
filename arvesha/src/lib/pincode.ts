import { db } from './db';

// PIN codes are checked against India Post data so an address cannot pair a PIN with the wrong state.
// Results are cached in Postgres. If India Post cannot be reached the PIN is accepted on format alone
// and the address is stored with pincode_verified = false.

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
] as const;

const ALIASES: Record<string, string> = {
  'daman and diu': 'dadra and nagar haveli and daman and diu',
  'dadra and nagar haveli': 'dadra and nagar haveli and daman and diu',
  orissa: 'odisha',
  uttaranchal: 'uttarakhand',
  pondicherry: 'puducherry',
  'andaman and nicobar': 'andaman and nicobar islands',
  'jammu and kashmir ': 'jammu and kashmir',
  'nct of delhi': 'delhi',
  'new delhi': 'delhi',
};

export function normalizeState(s: string): string {
  const n = s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return ALIASES[n] ?? n;
}

export interface PincodeInfo {
  pincode: string;
  /** true: PIN exists. false: India Post has no such PIN. 'unknown': lookup service unavailable. */
  found: boolean | 'unknown';
  state?: string;
  district?: string;
  places?: string[];
}

interface CacheRow {
  found: boolean;
  state: string | null;
  district: string | null;
  places: string[] | null;
  fetched_at: Date;
}

const CACHE_DAYS = 30;

export async function lookupPincode(pincode: string): Promise<PincodeInfo> {
  if (!/^[1-9]\d{5}$/.test(pincode)) return { pincode, found: false };

  const cached = await db.one<CacheRow>(
    `SELECT found, state, district, places, fetched_at FROM pincode_cache
      WHERE pincode = $1 AND fetched_at > now() - ($2 || ' days')::interval`,
    [pincode, String(CACHE_DAYS)],
  );
  if (cached) {
    return {
      pincode,
      found: cached.found,
      state: cached.state ?? undefined,
      district: cached.district ?? undefined,
      places: cached.places ?? undefined,
    };
  }

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { pincode, found: 'unknown' };
    const data = (await res.json()) as Array<{
      Status?: string;
      PostOffice?: Array<{ Name?: string; District?: string; State?: string }> | null;
    }>;
    const first = data?.[0];
    const offices = first?.PostOffice ?? [];
    if (first?.Status === 'Success' && offices.length > 0) {
      const state = offices[0]!.State ?? '';
      const district = offices[0]!.District ?? '';
      const places = [...new Set(offices.map((o) => o.Name).filter((n): n is string => !!n))].slice(0, 30);
      await saveCache(pincode, true, state, district, places);
      return { pincode, found: true, state, district, places };
    }
    if (first?.Status === 'Error' || first?.Status === '404') {
      await saveCache(pincode, false, null, null, null);
      return { pincode, found: false };
    }
    return { pincode, found: 'unknown' };
  } catch {
    return { pincode, found: 'unknown' };
  }
}

async function saveCache(pincode: string, found: boolean, state: string | null, district: string | null, places: string[] | null) {
  await db.query(
    `INSERT INTO pincode_cache (pincode, found, state, district, places, fetched_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (pincode) DO UPDATE SET found = $2, state = $3, district = $4, places = $5, fetched_at = now()`,
    [pincode, found, state, district, places],
  );
}

export interface AddressCheck {
  ok: boolean;
  verified: boolean;
  errors: Record<string, string>;
}

/** Confirms the PIN exists and belongs to the state the customer entered. */
export async function checkPincodeAgainstState(pincode: string, state: string): Promise<AddressCheck> {
  const info = await lookupPincode(pincode);
  if (info.found === false) {
    return { ok: false, verified: false, errors: { pincode: 'This PIN code does not exist. Check it and try again.' } };
  }
  if (info.found === 'unknown') return { ok: true, verified: false, errors: {} };
  if (info.state && normalizeState(info.state) !== normalizeState(state)) {
    return { ok: false, verified: true, errors: { state: `This PIN code belongs to ${info.state}. Check the state or the PIN code.` } };
  }
  return { ok: true, verified: true, errors: {} };
}
