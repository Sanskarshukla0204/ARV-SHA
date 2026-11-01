import { route } from '@/lib/http';
import { verifyClientPayment } from '@/lib/orders';
import { v } from '@/lib/validate';

const schema = v.object({
  razorpayOrderId: v.string({ min: 8, max: 60, pattern: /^order_[A-Za-z0-9]+$/, label: 'Order' }),
  razorpayPaymentId: v.string({ min: 8, max: 60, pattern: /^pay_[A-Za-z0-9]+$/, label: 'Payment' }),
  signature: v.string({ min: 32, max: 128, pattern: /^[a-f0-9]+$/, label: 'Signature' }),
});

export const POST = route({ auth: 'user', body: schema, userLimits: [{ name: 'pay-verify', max: 30, windowSec: 600 }] }, async ({ body, user }) => {
  const r = await verifyClientPayment(user!, { razorpayOrderId: body.razorpayOrderId, razorpayPaymentId: body.razorpayPaymentId, signature: body.signature });
  return { ok: true, ...r };
});

export const dynamic = 'force-dynamic';
