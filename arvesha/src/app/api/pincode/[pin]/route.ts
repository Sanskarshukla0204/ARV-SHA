import { HttpError, route } from '@/lib/http';
import { lookupPincode } from '@/lib/pincode';

// Lets the checkout form fill in city and state as soon as a PIN code is typed.
export const GET = route({ limits: [{ name: 'pincode', max: 60, windowSec: 60 }] }, async ({ params }) => {
  const pin = (params.pin ?? '').trim();
  if (!/^[1-9]\d{5}$/.test(pin)) throw new HttpError(422, 'validation', 'Enter a valid 6 digit PIN code.');
  const info = await lookupPincode(pin);
  return { found: info.found, state: info.state ?? null, district: info.district ?? null };
});

export const dynamic = 'force-dynamic';
