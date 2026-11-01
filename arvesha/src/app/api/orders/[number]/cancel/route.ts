import { HttpError, route } from '@/lib/http';
import { cancelOrder, getOrderForUser } from '@/lib/orders';
import { v } from '@/lib/validate';

const schema = v.object({ reason: v.optionalString({ max: 200, label: 'Reason' }) });

export const POST = route({ auth: 'user', body: schema, userLimits: [{ name: 'order-cancel', max: 10, windowSec: 3600 }] }, async ({ body, user, params }) => {
  const order = await getOrderForUser(params.number ?? '', user!.id);
  if (!order) throw new HttpError(404, 'not_found', 'We could not find that order.');
  const after = await cancelOrder(order.id, { actor: 'customer', byCustomer: true, userId: user!.id, reason: body.reason ?? 'Cancelled by customer' });
  return { ok: true, status: after.status, paymentStatus: after.paymentStatus };
});

export const dynamic = 'force-dynamic';
