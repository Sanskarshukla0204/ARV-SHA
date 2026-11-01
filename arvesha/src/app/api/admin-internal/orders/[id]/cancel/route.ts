import { adminRoute } from '@/lib/admin-route';
import { HttpError } from '@/lib/http';
import { cancelOrder } from '@/lib/orders';
import { v } from '@/lib/validate';

const schema = v.object({ reason: v.string({ min: 3, max: 200, label: 'Reason' }) });

export const POST = adminRoute({ body: schema }, async ({ body, params, admin, log }) => {
  const id = v.uuid('Order').run(params.id);
  if (!id.ok) throw new HttpError(404, 'not_found', 'Order not found.');
  const order = await cancelOrder(id.value, { actor: `admin:${admin.email}`, reason: body.reason });
  await log('order.cancel', 'order', id.value, { number: order.number, reason: body.reason });
  return { ok: true, status: order.status, paymentStatus: order.paymentStatus };
});

export const dynamic = 'force-dynamic';
