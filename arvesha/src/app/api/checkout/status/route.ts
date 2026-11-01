import { HttpError, route } from '@/lib/http';
import { getOrderForUser, reconcileOrder } from '@/lib/orders';

// Used by the "payment pending" page. Asks Razorpay directly, so a missed webhook never leaves a paid order stuck.
export const GET = route({ auth: 'user', userLimits: [{ name: 'pay-status', max: 60, windowSec: 600 }] }, async ({ query, user }) => {
  const number = (query.get('order') ?? '').trim();
  if (!/^ARV-\d{6}-[A-Z0-9]{4}$/.test(number)) throw new HttpError(404, 'not_found', 'We could not find that order.');
  const found = await getOrderForUser(number, user!.id);
  if (!found) throw new HttpError(404, 'not_found', 'We could not find that order.');
  const order = (await reconcileOrder(found.id)) ?? found;
  return { number: order.number, status: order.status, paymentStatus: order.paymentStatus };
});

export const dynamic = 'force-dynamic';
