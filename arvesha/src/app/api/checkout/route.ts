import { addressSchema, saveAddress, verifyAddress } from '@/lib/address';
import { checkEmail } from '@/lib/emailcheck';
import { HttpError, route } from '@/lib/http';
import { startCheckout } from '@/lib/orders';
import { getSettings } from '@/lib/settings';
import { ValidationError, v } from '@/lib/validate';

const schema = v.object({
  address: addressSchema,
  saveAddress: v.bool(),
  contactEmail: v.nullable(v.email({ label: 'Email' })),
  note: v.optionalString({ max: 300, multiline: true, label: 'Note' }),
});

// Creates the order, reserves stock and opens a Razorpay order. Prices come from the database, never from this request.
export const POST = route(
  { auth: 'user', body: schema, userLimits: [{ name: 'checkout', max: 12, windowSec: 600 }], limits: [{ name: 'checkout-ip', max: 40, windowSec: 600 }] },
  async ({ body, user, ip }) => {
    const settings = await getSettings();
    if (settings.checkout.requireVerifiedPhone && !user!.phoneVerified) {
      throw new HttpError(403, 'phone_unverified', 'Verify your mobile number to place an order.');
    }
    const verified = await verifyAddress(body.address);

    const email = body.contactEmail ?? user!.email;
    if (!email) throw new ValidationError({ contactEmail: 'Enter an email address so we can send your order confirmation.' });
    if (email !== user!.email) {
      const verdict = await checkEmail(email);
      if (verdict !== 'ok') throw new ValidationError({ contactEmail: 'Enter a working email address. Temporary addresses are not accepted.' });
    }

    const a = body.address;
    const start = await startCheckout(
      user!,
      { address: { name: a.name, phone: a.phone, line1: a.line1, line2: a.line2 ?? null, landmark: a.landmark ?? null, city: a.city, state: a.state, pincode: a.pincode }, contactEmail: email, note: body.note },
      ip,
    );
    if (body.saveAddress) await saveAddress(user!.id, a, verified).catch(() => undefined);
    return { ok: true, ...start };
  },
);

export const dynamic = 'force-dynamic';
