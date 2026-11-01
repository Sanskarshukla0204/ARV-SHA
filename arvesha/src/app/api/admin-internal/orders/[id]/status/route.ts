import { adminRoute } from '@/lib/admin-route';
import { HttpError } from '@/lib/http';
import { advanceOrder } from '@/lib/orders';
import { ValidationError, v } from '@/lib/validate';

const schema = v.object({
  to: v.oneOf(['processing', 'shipped', 'delivered'] as const, 'Status'),
  carrier: v.optionalString({ max: 60, label: 'Courier' }),
  trackingNumber: v.optionalString({ max: 60, label: 'Tracking number' }),
  trackingUrl: v.optionalString({ max: 300, pattern: /^https:\/\/[^\s]+$/, patternMessage: 'Use a full link starting with https://', label: 'Tracking link' }),
});

export const POST = adminRoute({ body: schema }, async ({ body, params, admin, log }) => {
  const id = v.uuid('Order').run(params.id);
  if (!id.ok) throw new HttpError(404, 'not_found', 'Order not found.');
  if (body.to === 'shipped' && (!body.carrier || !body.trackingNumber)) {
    throw new ValidationError({ carrier: body.carrier ? '' : 'Enter the courier name.', trackingNumber: body.trackingNumber ? '' : 'Enter the tracking number.' });
  }
  const order = await advanceOrder(id.value, body.to, `admin:${admin.email}`, { carrier: body.carrier, trackingNumber: body.trackingNumber, trackingUrl: body.trackingUrl });
  await log(`order.${body.to}`, 'order', id.value, { number: order.number });
  return { ok: true, status: order.status };
});

export const dynamic = 'force-dynamic';
