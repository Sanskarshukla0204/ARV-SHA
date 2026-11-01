import { db } from '@/lib/db';
import { HttpError, route } from '@/lib/http';
import { applyPayment, applyRefundUpdate, reconcileOrder, reconcilePayment } from '@/lib/orders';
import { verifyWebhookSignature, type RzpPayment } from '@/lib/razorpay';

interface Event {
  event?: string;
  payload?: { payment?: { entity?: RzpPayment }; refund?: { entity?: { id: string; payment_id: string; amount: number; status: string } }; order?: { entity?: { id: string } } };
}

// Razorpay retries any non 2xx answer, so every step here is idempotent and a failure is recorded and returned as 500.
export const POST = route({ skipOriginCheck: true, limits: [{ name: 'rzp-webhook', max: 600, windowSec: 60 }] }, async ({ req }) => {
  const raw = await req.text();
  if (raw.length > 256 * 1024) throw new HttpError(413, 'too_large', 'Too large.');
  if (!verifyWebhookSignature(raw, req.headers.get('x-razorpay-signature'))) throw new HttpError(400, 'bad_signature', 'Invalid request.');

  let ev: Event;
  try {
    ev = JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'bad_json', 'Invalid request.');
  }
  const type = ev.event ?? 'unknown';
  const eventId = req.headers.get('x-razorpay-event-id') ?? `body:${(await import('node:crypto')).createHash('sha256').update(raw).digest('hex')}`;

  const stored = await db.one<{ processed_at: Date | null }>(
    `INSERT INTO webhook_events (id, type, payload) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id RETURNING processed_at`,
    [eventId, type, raw],
  );
  if (stored?.processed_at) return { ok: true, duplicate: true };

  try {
    const payment = ev.payload?.payment?.entity;
    const refund = ev.payload?.refund?.entity;
    if ((type === 'payment.authorized' || type === 'payment.captured') && payment?.id) await reconcilePayment(payment.id);
    else if (type === 'payment.failed' && payment) await applyPayment(payment);
    else if (type === 'order.paid') {
      const rzpOrderId = ev.payload?.order?.entity?.id ?? payment?.order_id;
      const row = rzpOrderId ? await db.one<{ id: string }>(`SELECT id FROM orders WHERE razorpay_order_id = $1`, [rzpOrderId]) : null;
      if (row) await reconcileOrder(row.id);
    } else if (type.startsWith('refund.') && refund) await applyRefundUpdate(refund);
    await db.query(`UPDATE webhook_events SET processed_at = now(), error = NULL WHERE id = $1`, [eventId]);
  } catch (err) {
    await db.query(`UPDATE webhook_events SET error = $2 WHERE id = $1`, [eventId, (err as Error).message.slice(0, 500)]);
    throw err;
  }
  return { ok: true };
});

export const dynamic = 'force-dynamic';
