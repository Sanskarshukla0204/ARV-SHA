import { adminRoute } from '@/lib/admin-route';
import { HttpError } from '@/lib/http';
import { refundOrder } from '@/lib/orders';
import { v } from '@/lib/validate';

const schema = v.object({ amount: v.nullable(v.rupees({ min: 100, label: 'Refund amount' })), reason: v.string({ min: 3, max: 200, label: 'Reason' }) });

export const POST = adminRoute({ body: schema, perMinute: 30 }, async ({ body, params, admin, log }) => {
  const id = v.uuid('Order').run(params.id);
  if (!id.ok) throw new HttpError(404, 'not_found', 'Order not found.');
  const r = await refundOrder(id.value, body.amount, body.reason, admin.id, `admin:${admin.email}`);
  await log('order.refund', 'order', id.value, { amountPaise: r.amountPaise, refundId: r.refundId, reason: body.reason });
  return { ok: true, ...r };
});

export const dynamic = 'force-dynamic';
