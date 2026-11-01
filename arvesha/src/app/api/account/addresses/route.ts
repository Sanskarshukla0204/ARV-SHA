import { addressSchema, saveAddress, verifyAddress } from '@/lib/address';
import { route } from '@/lib/http';
import { v } from '@/lib/validate';

const schema = v.object({
  address: addressSchema,
  label: v.optionalString({ max: 30, label: 'Label' }),
  makeDefault: v.bool(),
});

export const POST = route({ auth: 'user', body: schema, userLimits: [{ name: 'addr-write', max: 30, windowSec: 3600 }] }, async ({ body, user }) => {
  const verified = await verifyAddress(body.address);
  const id = await saveAddress(user!.id, body.address, verified, { label: body.label, makeDefault: body.makeDefault });
  return { ok: true, id };
});

export const dynamic = 'force-dynamic';
