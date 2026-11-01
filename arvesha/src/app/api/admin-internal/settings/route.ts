import { adminRoute } from '@/lib/admin-route';
import { saveSetting } from '@/lib/settings';
import { v } from '@/lib/validate';

const text = (label: string, max = 200) => v.string({ max, label });
const schema = v.object({
  business: v.object({
    legalName: text('Legal name'), address: text('Address', 300), gstin: v.string({ max: 15, pattern: /^$|^[0-9A-Z]{15}$/, label: 'GSTIN', patternMessage: 'A GSTIN has 15 letters and digits.' }),
    supportEmail: v.string({ max: 254, pattern: /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, label: 'Support email', patternMessage: 'Enter a valid email address.' }),
    supportPhone: text('Support phone', 20), grievanceName: text('Grievance officer name', 80),
    grievanceEmail: v.string({ max: 254, pattern: /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, label: 'Grievance email', patternMessage: 'Enter a valid email address.' }),
    grievancePhone: text('Grievance phone', 20),
  }),
  shipping: v.object({
    flatPaise: v.rupees({ min: 0, max: 5000, label: 'Shipping fee' }), freeAbovePaise: v.nullable(v.rupees({ min: 100, label: 'Free shipping above' })),
    dispatchDays: v.int({ min: 0, max: 30, label: 'Dispatch days' }), deliveryMinDays: v.int({ min: 1, max: 60, label: 'Fastest delivery' }), deliveryMaxDays: v.int({ min: 1, max: 60, label: 'Slowest delivery' }),
  }),
  policies: v.object({ returnWindowDays: v.int({ min: 0, max: 60, label: 'Return window' }), cancelBeforeDispatch: v.bool(), refundDays: v.int({ min: 1, max: 30, label: 'Refund days' }) }),
  checkout: v.object({ requireVerifiedPhone: v.bool(), maxOrderPaise: v.rupees({ min: 100, max: 1_000_000, label: 'Largest online order' }) }),
});

export const PATCH = adminRoute({ body: schema }, async ({ body, log }) => {
  await saveSetting('business', body.business);
  await saveSetting('shipping', body.shipping);
  await saveSetting('policies', body.policies);
  await saveSetting('checkout', body.checkout);
  await log('settings.update', 'settings');
  return { ok: true };
});

export const dynamic = 'force-dynamic';
