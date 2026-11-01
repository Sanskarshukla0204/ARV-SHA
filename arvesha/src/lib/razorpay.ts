import { createHmac } from 'node:crypto';
import { safeEqual } from './crypto';
import { env } from './env';

// Thin Razorpay REST client plus the two signature checks the integration depends on.
// Docs: https://razorpay.com/docs/api/ . Keys come from RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.
// RAZORPAY_API_BASE exists so automated tests can point at a local mock; leave it unset in production.

export class RazorpayError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'RazorpayError';
  }
}

export interface RzpOrder {
  id: string;
  amount: number;
  amount_paid: number;
  currency: string;
  receipt: string | null;
  status: 'created' | 'attempted' | 'paid';
  attempts: number;
  notes?: Record<string, string>;
}

export interface RzpPayment {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  method?: string;
  captured?: boolean;
  amount_refunded?: number;
  email?: string;
  contact?: string;
  error_code?: string | null;
  error_description?: string | null;
  created_at?: number;
}

export interface RzpRefund {
  id: string;
  payment_id: string;
  amount: number;
  status: 'pending' | 'processed' | 'failed';
}

function base(): string {
  return (env('RAZORPAY_API_BASE') ?? 'https://api.razorpay.com/v1').replace(/\/+$/, '');
}

export function razorpayConfigured(): boolean {
  return !!env('RAZORPAY_KEY_ID') && !!env('RAZORPAY_KEY_SECRET');
}

export function razorpayKeyId(): string {
  const id = env('RAZORPAY_KEY_ID');
  if (!id) throw new RazorpayError(503, 'not_configured', 'Payments are not set up yet.');
  return id;
}

function secret(): string {
  const s = env('RAZORPAY_KEY_SECRET');
  if (!s) throw new RazorpayError(503, 'not_configured', 'Payments are not set up yet.');
  return s;
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const auth = Buffer.from(`${razorpayKeyId()}:${secret()}`).toString('base64');
  let res: Response;
  try {
    res = await fetch(`${base()}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });
  } catch (err) {
    throw new RazorpayError(502, 'network', `Could not reach Razorpay: ${(err as Error).message}`);
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non JSON error page */
  }
  if (!res.ok) {
    const e = data?.error ?? {};
    throw new RazorpayError(res.status, e.code ?? 'razorpay_error', e.description ?? `Razorpay returned ${res.status}`);
  }
  return data as T;
}

export const razorpay = {
  createOrder(input: { amountPaise: number; receipt: string; notes?: Record<string, string> }): Promise<RzpOrder> {
    return call<RzpOrder>('POST', '/orders', {
      amount: input.amountPaise,
      currency: 'INR',
      receipt: input.receipt.slice(0, 40),
      notes: input.notes ?? {},
    });
  },
  fetchOrder(orderId: string): Promise<RzpOrder> {
    return call<RzpOrder>('GET', `/orders/${encodeURIComponent(orderId)}`);
  },
  async fetchOrderPayments(orderId: string): Promise<RzpPayment[]> {
    const res = await call<{ items: RzpPayment[] }>('GET', `/orders/${encodeURIComponent(orderId)}/payments`);
    return res.items ?? [];
  },
  fetchPayment(paymentId: string): Promise<RzpPayment> {
    return call<RzpPayment>('GET', `/payments/${encodeURIComponent(paymentId)}`);
  },
  capture(paymentId: string, amountPaise: number): Promise<RzpPayment> {
    return call<RzpPayment>('POST', `/payments/${encodeURIComponent(paymentId)}/capture`, { amount: amountPaise, currency: 'INR' });
  },
  refund(paymentId: string, amountPaise: number, notes: Record<string, string> = {}): Promise<RzpRefund> {
    return call<RzpRefund>('POST', `/payments/${encodeURIComponent(paymentId)}/refund`, { amount: amountPaise, speed: 'normal', notes });
  },
};

/**
 * Checkout signature from the browser handler: HMAC_SHA256(order_id + "|" + payment_id, key_secret).
 * A valid signature proves the payment belongs to this order and was returned by Razorpay.
 */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  if (!orderId || !paymentId || !signature) return false;
  const expected = createHmac('sha256', secret()).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqual(expected, signature);
}

/** Webhook signature: HMAC_SHA256(raw request body, webhook secret) sent in X-Razorpay-Signature. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const whSecret = env('RAZORPAY_WEBHOOK_SECRET');
  if (!whSecret || !signature) return false;
  const expected = createHmac('sha256', whSecret).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}
