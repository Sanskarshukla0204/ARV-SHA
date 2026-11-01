import { db, tx, type Queryable } from './db';
import { randomFromAlphabet, sha256 } from './crypto';
import { HttpError } from './http';
import { getSettings, shippingFor } from './settings';
import { loadCartLines, getCartIdForUser } from './cart';
import { razorpay, razorpayConfigured, razorpayKeyId, RazorpayError, verifyCheckoutSignature, type RzpPayment } from './razorpay';
import { sendMail } from './mail';
import { orderPlacedMail, orderStatusMail, type OrderMail, type OrderStatusKind } from './email-templates';
import { formatINR } from './format';
import type { SessionUser } from './session';

// All order state changes go through this file. Rules it enforces:
//  - prices and totals always come from the database, never from the browser
//  - stock is reserved when the order is created and released when it expires or is cancelled
//  - a payment is only accepted when Razorpay confirms it for the same order id and the same amount
//  - every settlement path (browser, webhook, reconcile job) is idempotent, so running twice is harmless

export const PAYMENT_WINDOW_MINUTES = 30;

export interface ShippingAddress {
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
}

export type OrderStatus = 'pending_payment' | 'new' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'expired';
export type PaymentStatus = 'unpaid' | 'paid' | 'failed' | 'partially_refunded' | 'refunded';

interface OrderDb {
  id: string;
  number: string;
  user_id: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  subtotal_paise: number;
  shipping_paise: number;
  discount_paise: number;
  total_paise: number;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string;
  shipping_address: ShippingAddress;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  stock_reserved: boolean;
  expires_at: Date | null;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  customer_note: string | null;
  placed_at: Date;
  paid_at: Date | null;
  processing_at: Date | null;
  shipped_at: Date | null;
  delivered_at: Date | null;
  cancelled_at: Date | null;
}

interface ItemDb {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  name: string;
  sku: string;
  size: string;
  color: string;
  image_url: string | null;
  unit_price_paise: number;
  qty: number;
  line_total_paise: number;
}

export interface OrderItem {
  id: string;
  productId: string | null;
  name: string;
  sku: string;
  size: string;
  color: string;
  imageUrl: string | null;
  unitPaise: number;
  qty: number;
  lineTotalPaise: number;
}

export interface Order {
  id: string;
  number: string;
  userId: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotalPaise: number;
  shippingPaise: number;
  discountPaise: number;
  totalPaise: number;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string;
  address: ShippingAddress;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  expiresAt: Date | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  customerNote: string | null;
  placedAt: Date;
  paidAt: Date | null;
  processingAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  items: OrderItem[];
}

function mapOrder(o: OrderDb, items: ItemDb[]): Order {
  return {
    id: o.id,
    number: o.number,
    userId: o.user_id,
    status: o.status,
    paymentStatus: o.payment_status,
    subtotalPaise: o.subtotal_paise,
    shippingPaise: o.shipping_paise,
    discountPaise: o.discount_paise,
    totalPaise: o.total_paise,
    contactName: o.contact_name,
    contactEmail: o.contact_email,
    contactPhone: o.contact_phone,
    address: o.shipping_address,
    razorpayOrderId: o.razorpay_order_id,
    razorpayPaymentId: o.razorpay_payment_id,
    expiresAt: o.expires_at,
    carrier: o.carrier,
    trackingNumber: o.tracking_number,
    trackingUrl: o.tracking_url,
    customerNote: o.customer_note,
    placedAt: o.placed_at,
    paidAt: o.paid_at,
    processingAt: o.processing_at,
    shippedAt: o.shipped_at,
    deliveredAt: o.delivered_at,
    cancelledAt: o.cancelled_at,
    items: items.map((i) => ({
      id: i.id,
      productId: i.product_id,
      name: i.name,
      sku: i.sku,
      size: i.size,
      color: i.color,
      imageUrl: i.image_url,
      unitPaise: i.unit_price_paise,
      qty: i.qty,
      lineTotalPaise: i.line_total_paise,
    })),
  };
}

async function loadItems(q: Queryable, orderId: string): Promise<ItemDb[]> {
  return q.query<ItemDb>(
    `SELECT id, product_id, variant_id, name, sku, size, color, image_url, unit_price_paise, qty, line_total_paise
       FROM order_items WHERE order_id = $1 ORDER BY name, size`,
    [orderId],
  );
}

export async function getOrderById(id: string, q: Queryable = db): Promise<Order | null> {
  const o = await q.one<OrderDb>(`SELECT * FROM orders WHERE id = $1`, [id]);
  return o ? mapOrder(o, await loadItems(q, o.id)) : null;
}

/** Customers can only ever load their own orders. */
export async function getOrderForUser(number: string, userId: string): Promise<Order | null> {
  const o = await db.one<OrderDb>(`SELECT * FROM orders WHERE number = $1 AND user_id = $2`, [number, userId]);
  return o ? mapOrder(o, await loadItems(db, o.id)) : null;
}

export async function listOrdersForUser(userId: string, limit = 50): Promise<Order[]> {
  const rows = await db.query<OrderDb>(`SELECT * FROM orders WHERE user_id = $1 ORDER BY placed_at DESC LIMIT $2`, [userId, limit]);
  if (!rows.length) return [];
  const items = await db.query<ItemDb & { order_id: string }>(
    `SELECT order_id, id, product_id, variant_id, name, sku, size, color, image_url, unit_price_paise, qty, line_total_paise
       FROM order_items WHERE order_id = ANY($1::uuid[]) ORDER BY name, size`,
    [rows.map((r) => r.id)],
  );
  return rows.map((o) => mapOrder(o, items.filter((i) => i.order_id === o.id)));
}

export async function listOrderEvents(orderId: string): Promise<{ type: string; note: string | null; actor: string; createdAt: Date }[]> {
  const rows = await db.query<{ type: string; note: string | null; actor: string; created_at: Date }>(
    `SELECT type, note, actor, created_at FROM order_events WHERE order_id = $1 ORDER BY created_at, id`,
    [orderId],
  );
  return rows.map((r) => ({ type: r.type, note: r.note, actor: r.actor, createdAt: r.created_at }));
}

async function addEvent(q: Queryable, orderId: string, type: string, note: string | null, actor = 'system') {
  await q.query(`INSERT INTO order_events (order_id, type, note, actor) VALUES ($1, $2, $3, $4)`, [orderId, type, note, actor]);
}

function orderNumber(): string {
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  const yymmdd = ist.toISOString().slice(2, 10).replace(/-/g, '');
  return `ARV-${yymmdd}-${randomFromAlphabet(4)}`;
}

// ------------------------------------------------------------------ emails

function toMailData(o: Order): OrderMail {
  return {
    number: o.number,
    name: o.contactName,
    items: o.items.map((i) => ({ name: i.name, size: i.size, color: i.color, qty: i.qty, lineTotalPaise: i.lineTotalPaise })),
    subtotalPaise: o.subtotalPaise,
    shippingPaise: o.shippingPaise,
    discountPaise: o.discountPaise || undefined,
    totalPaise: o.totalPaise,
    address: { name: o.address.name, line1: o.address.line1, line2: o.address.line2, city: o.address.city, state: o.address.state, pincode: o.address.pincode, phone: o.address.phone },
    carrier: o.carrier,
    trackingNumber: o.trackingNumber,
    trackingUrl: o.trackingUrl,
  };
}

async function mailOrderPlaced(order: Order) {
  if (!order.contactEmail) return;
  const m = orderPlacedMail(toMailData(order));
  await sendMail({ to: order.contactEmail, ...m });
}

async function mailOrderStatus(order: Order, kind: OrderStatusKind, extra?: { refundPaise?: number; reason?: string }) {
  if (!order.contactEmail) return;
  const m = orderStatusMail(toMailData(order), kind, extra);
  await sendMail({ to: order.contactEmail, ...m });
}

// ----------------------------------------------------------- stock handling

/** Give back the inventory this order is holding. Safe to call twice. Returns true if it released anything. */
async function releaseStock(q: Queryable, orderId: string): Promise<boolean> {
  const flipped = await q.one<{ id: string }>(`UPDATE orders SET stock_reserved = false WHERE id = $1 AND stock_reserved RETURNING id`, [orderId]);
  if (!flipped) return false;
  await q.query(
    `UPDATE product_variants v SET stock = v.stock + oi.qty
       FROM order_items oi WHERE oi.order_id = $1 AND oi.variant_id = v.id`,
    [orderId],
  );
  return true;
}

/** Try to take inventory again for an order that already released it (late payment). All or nothing. */
async function reserveStockAgain(q: Queryable, orderId: string): Promise<boolean> {
  const items = await q.query<{ variant_id: string | null; qty: number }>(`SELECT variant_id, qty FROM order_items WHERE order_id = $1`, [orderId]);
  for (const it of items) {
    if (!it.variant_id) return false;
    const r = await q.one(`UPDATE product_variants SET stock = stock - $2 WHERE id = $1 AND stock >= $2 AND active RETURNING id`, [it.variant_id, it.qty]);
    if (!r) return false; // caller rolls the whole transaction back
  }
  await q.query(`UPDATE orders SET stock_reserved = true WHERE id = $1`, [orderId]);
  return true;
}

async function expireOrderTx(q: Queryable, orderId: string, note: string) {
  await releaseStock(q, orderId);
  await q.query(`UPDATE orders SET status = 'expired', updated_at = now() WHERE id = $1 AND status = 'pending_payment'`, [orderId]);
  await addEvent(q, orderId, 'expired', note);
}

// --------------------------------------------------------------- checkout

export interface CheckoutInput {
  address: ShippingAddress;
  contactEmail: string | null;
  note?: string;
}

export interface CheckoutStart {
  orderNumber: string;
  razorpayOrderId: string;
  keyId: string;
  amountPaise: number;
  prefill: { name: string; email: string; contact: string };
  expiresAt: string;
}

export async function startCheckout(user: SessionUser, input: CheckoutInput, ip: string): Promise<CheckoutStart> {
  if (!razorpayConfigured()) {
    throw new HttpError(503, 'payments_unavailable', 'Online payments are not available yet. Please try again later.');
  }
  const settings = await getSettings();
  const cartId = await getCartIdForUser(user.id);
  if (!cartId) throw new HttpError(409, 'cart_empty', 'Your cart is empty.');

  const addressKey = sha256(JSON.stringify([input.address.name, input.address.phone, input.address.line1, input.address.line2 ?? '', input.address.city, input.address.state, input.address.pincode]));

  const prepared = await tx(async (q) => {
    let lines = await loadCartLines(q, cartId, true);
    if (lines.length === 0) throw new HttpError(409, 'cart_empty', 'Your cart is empty.');

    const priceLines = (ls: typeof lines) => {
      const subtotal = ls.reduce((s, l) => s + l.lineTotalPaise, 0);
      const shipping = shippingFor(subtotal, settings.shipping);
      return { subtotal, shipping, total: subtotal + shipping };
    };
    const signatureFor = (ls: typeof lines, total: number) => sha256(JSON.stringify([ls.map((l) => [l.variantId, l.qty, l.unitPaise]).sort(), addressKey, total]));

    // Look for an order this customer already holds stock for BEFORE judging availability: that order's own
    // reservation has lowered the stock the cart sees, so a retry of the same checkout must not be blocked by it.
    let priced = priceLines(lines);
    const reuse = await q.one<OrderDb>(
      `SELECT * FROM orders WHERE user_id = $1 AND status = 'pending_payment' AND cart_signature = $2 AND expires_at > now()
        ORDER BY placed_at DESC LIMIT 1 FOR UPDATE`,
      [user.id, signatureFor(lines, priced.total)],
    );
    if (reuse) return { order: reuse, reused: true };

    // Free inventory held by this customer's earlier abandoned attempts before taking new stock.
    const stale = await q.query<{ id: string }>(
      `SELECT o.id FROM orders o
        WHERE o.user_id = $1 AND o.status = 'pending_payment'
          AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.status IN ('authorized', 'captured'))
        ORDER BY o.id
        FOR UPDATE`,
      [user.id],
    );
    for (const s of stale) await expireOrderTx(q, s.id, 'Replaced by a newer checkout attempt');
    if (stale.length > 0) {
      // Stock that those orders held is available again, so read the cart a second time.
      lines = await loadCartLines(q, cartId, true);
      if (lines.length === 0) throw new HttpError(409, 'cart_empty', 'Your cart is empty.');
      priced = priceLines(lines);
    }

    const bad = lines.find((l) => !l.available);
    if (bad) throw new HttpError(409, 'cart_changed', `${bad.name} (${bad.size}): ${bad.issue ?? 'not available'}. Update your cart to continue.`);

    const { subtotal, shipping, total } = priced;
    if (total < 100) throw new HttpError(422, 'amount_too_low', 'The order total is too low to pay online.');
    if (total > settings.checkout.maxOrderPaise) {
      throw new HttpError(422, 'amount_too_high', `Online orders are limited to ${formatINR(settings.checkout.maxOrderPaise)}. Split this order into two.`);
    }
    const signature = signatureFor(lines, total);

    // Reserve stock. The guarded UPDATE cannot oversell even under concurrent checkouts.
    for (const l of lines) {
      const r = await q.one(`UPDATE product_variants SET stock = stock - $2 WHERE id = $1 AND stock >= $2 AND active RETURNING id`, [l.variantId, l.qty]);
      if (!r) throw new HttpError(409, 'out_of_stock', `${l.name} (${l.size}) just sold out. Update your cart to continue.`);
    }

    let created: OrderDb | null = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      try {
        // A savepoint keeps one number collision from aborting the whole transaction.
        await q.query('SAVEPOINT order_number');
        created = await q.one<OrderDb>(
          `INSERT INTO orders (number, user_id, status, payment_status, subtotal_paise, shipping_paise, total_paise,
                               contact_name, contact_email, contact_phone, shipping_address, stock_reserved, cart_signature,
                               expires_at, customer_note, placed_ip)
           VALUES ($1, $2, 'pending_payment', 'unpaid', $3, $4, $5, $6, $7, $8, $9::jsonb, true, $10,
                   now() + ($11 || ' minutes')::interval, $12, $13)
           RETURNING *`,
          [
            orderNumber(),
            user.id,
            subtotal,
            shipping,
            total,
            input.address.name,
            input.contactEmail,
            input.address.phone,
            JSON.stringify(input.address),
            signature,
            String(PAYMENT_WINDOW_MINUTES),
            input.note ?? null,
            ip,
          ],
        );
        await q.query('RELEASE SAVEPOINT order_number');
      } catch (err) {
        await q.query('ROLLBACK TO SAVEPOINT order_number');
        if ((err as { code?: string }).code !== '23505') throw err;
      }
    }
    if (!created) throw new HttpError(500, 'order_number', 'Could not create the order. Please try again.');

    for (const l of lines) {
      const variant = await q.one<{ sku: string; category_id: string | null }>(
        `SELECT v.sku, p.category_id FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.id = $1`,
        [l.variantId],
      );
      await q.query(
        `INSERT INTO order_items (order_id, product_id, variant_id, category_id, name, sku, size, color, image_url, unit_price_paise, qty, line_total_paise)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [created.id, l.productId, l.variantId, variant?.category_id ?? null, l.name, variant?.sku ?? '', l.size, l.color, l.imageUrl, l.unitPaise, l.qty, l.lineTotalPaise],
      );
    }
    await addEvent(q, created.id, 'created', `Order created for ${formatINR(total)}`, 'customer');
    return { order: created, reused: false };
  });

  let order = prepared.order;

  if (!order.razorpay_order_id) {
    try {
      const rz = await razorpay.createOrder({
        amountPaise: order.total_paise,
        receipt: order.number,
        notes: { order_number: order.number, customer: user.publicId },
      });
      await db.query(`UPDATE orders SET razorpay_order_id = $2, updated_at = now() WHERE id = $1`, [order.id, rz.id]);
      await db.query(
        `INSERT INTO payments (order_id, razorpay_order_id, amount_paise, status) VALUES ($1, $2, $3, 'created')`,
        [order.id, rz.id, order.total_paise],
      );
      order = { ...order, razorpay_order_id: rz.id };
    } catch (err) {
      // Give the stock back; the customer can try again.
      await tx(async (q) => {
        await expireOrderTx(q, order.id, 'Could not start payment with Razorpay');
      });
      console.error('[orders] Razorpay order creation failed', (err as Error).message);
      if (err instanceof RazorpayError && err.code === 'not_configured') {
        throw new HttpError(503, 'payments_unavailable', 'Online payments are not available yet. Please try again later.');
      }
      throw new HttpError(502, 'payment_provider', 'We could not start the payment. Please try again in a moment.');
    }
  }

  return {
    orderNumber: order.number,
    razorpayOrderId: order.razorpay_order_id!,
    keyId: razorpayKeyId(),
    amountPaise: order.total_paise,
    prefill: { name: order.contact_name, email: order.contact_email ?? '', contact: order.contact_phone },
    expiresAt: (order.expires_at ?? new Date(Date.now() + PAYMENT_WINDOW_MINUTES * 60_000)).toISOString(),
  };
}

// ------------------------------------------------------- payment settlement

export interface SettleOutcome {
  order: Order;
  becamePaid: boolean;
  /** A payment arrived for an order that could no longer be fulfilled; the full amount must be refunded. */
  needsRefund: boolean;
}

/**
 * Records a Razorpay payment against its order. Idempotent: replaying the same payment changes nothing.
 * `payment` must come from Razorpay (API response or a verified webhook), never from the browser.
 */
export async function applyPayment(payment: RzpPayment): Promise<SettleOutcome | null> {
  if (!payment.order_id) return null;

  const result = await tx(async (q) => {
    const o = await q.one<OrderDb>(`SELECT * FROM orders WHERE razorpay_order_id = $1 FOR UPDATE`, [payment.order_id]);
    if (!o) return null;

    // The amount and currency must match what we asked Razorpay to charge.
    if (payment.amount !== o.total_paise || payment.currency !== 'INR') {
      await addEvent(q, o.id, 'payment_mismatch', `Payment ${payment.id} amount ${payment.amount} ${payment.currency} does not match order total ${o.total_paise}`);
      return { orderId: o.id, becamePaid: false, needsRefund: false };
    }

    await q.query(
      `INSERT INTO payments (order_id, razorpay_order_id, razorpay_payment_id, amount_paise, status, method, error_code, error_description, raw)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       ON CONFLICT (razorpay_payment_id) DO UPDATE
         SET status = EXCLUDED.status, method = EXCLUDED.method, error_code = EXCLUDED.error_code,
             error_description = EXCLUDED.error_description, raw = EXCLUDED.raw, updated_at = now()`,
      [o.id, payment.order_id, payment.id, payment.amount, payment.status, payment.method ?? null, payment.error_code ?? null, payment.error_description ?? null, JSON.stringify(payment)],
    );

    if (payment.status === 'captured') {
      const alreadyPaid = o.payment_status === 'paid' || o.payment_status === 'partially_refunded' || o.payment_status === 'refunded';
      if (alreadyPaid) {
        if (o.razorpay_payment_id && o.razorpay_payment_id !== payment.id) {
          await addEvent(q, o.id, 'duplicate_payment', `A second payment ${payment.id} was captured for this order and needs a manual refund`);
        }
        return { orderId: o.id, becamePaid: false, needsRefund: false };
      }

      if (o.status === 'pending_payment') {
        await q.query(
          `UPDATE orders SET status = 'new', payment_status = 'paid', razorpay_payment_id = $2, paid_at = now(), expires_at = NULL, updated_at = now() WHERE id = $1`,
          [o.id, payment.id],
        );
        await addEvent(q, o.id, 'paid', `Payment ${payment.id} captured (${payment.method ?? 'online'})`);
        return { orderId: o.id, becamePaid: true, needsRefund: false };
      }

      // Late payment on an order that already expired or was cancelled.
      if (o.status === 'expired' || o.status === 'cancelled') {
        if (o.status === 'expired') {
          const restocked = o.stock_reserved || (await reserveStockAgain(q, o.id));
          if (restocked) {
            await q.query(
              `UPDATE orders SET status = 'new', payment_status = 'paid', razorpay_payment_id = $2, paid_at = now(), expires_at = NULL, updated_at = now() WHERE id = $1`,
              [o.id, payment.id],
            );
            await addEvent(q, o.id, 'late_payment_accepted', `Payment ${payment.id} arrived after expiry and stock was still available`);
            return { orderId: o.id, becamePaid: true, needsRefund: false };
          }
        }
        await q.query(
          `UPDATE orders SET payment_status = 'paid', razorpay_payment_id = $2, paid_at = now(), status = 'cancelled', cancelled_at = COALESCE(cancelled_at, now()), updated_at = now() WHERE id = $1`,
          [o.id, payment.id],
        );
        await addEvent(q, o.id, 'late_payment_refund', `Payment ${payment.id} arrived for an order that could not be fulfilled; refunding in full`);
        return { orderId: o.id, becamePaid: false, needsRefund: true };
      }
      return { orderId: o.id, becamePaid: false, needsRefund: false };
    }

    if (payment.status === 'failed') {
      if (o.payment_status === 'unpaid') {
        await q.query(`UPDATE orders SET payment_status = 'failed', updated_at = now() WHERE id = $1`, [o.id]);
      }
      await addEvent(q, o.id, 'payment_failed', payment.error_description ?? 'Payment failed');
    }
    return { orderId: o.id, becamePaid: false, needsRefund: false };
  });

  if (!result) return null;
  const order = (await getOrderById(result.orderId))!;

  if (result.becamePaid) {
    // Emptying the cart and emailing are best effort; the order is already safely recorded.
    try {
      if (order.userId) {
        const cartId = await getCartIdForUser(order.userId);
        if (cartId) {
          await db.query(
            `DELETE FROM cart_items WHERE cart_id = $1 AND variant_id IN (SELECT variant_id FROM order_items WHERE order_id = $2 AND variant_id IS NOT NULL)`,
            [cartId, order.id],
          );
        }
      }
    } catch (err) {
      console.error('[orders] could not clear cart after payment', (err as Error).message);
    }
    mailOrderPlaced(order).catch((e) => console.error('[orders] confirmation email failed', e.message));
  }
  if (result.needsRefund) {
    await refundOrder(order.id, null, 'Payment arrived after the order could not be fulfilled', null, 'system').catch((e) =>
      console.error('[orders] automatic refund failed', e.message),
    );
  }
  return { order, becamePaid: result.becamePaid, needsRefund: result.needsRefund };
}

/** Fetch the payment from Razorpay (the source of truth), capture it if needed, then record it. */
export async function reconcilePayment(paymentId: string): Promise<SettleOutcome | null> {
  let payment = await razorpay.fetchPayment(paymentId);
  if (payment.status === 'authorized') {
    try {
      payment = await razorpay.capture(payment.id, payment.amount);
    } catch (err) {
      // Another process may have captured it already.
      payment = await razorpay.fetchPayment(paymentId);
      if (payment.status === 'authorized') throw err;
    }
  }
  return applyPayment(payment);
}

export interface ClientPaymentResult {
  status: 'paid' | 'pending';
  orderNumber: string;
}

/** Called when the customer's browser reports a finished payment. The signature proves it came from Razorpay. */
export async function verifyClientPayment(
  user: SessionUser,
  input: { razorpayOrderId: string; razorpayPaymentId: string; signature: string },
): Promise<ClientPaymentResult> {
  const row = await db.one<{ id: string; number: string; user_id: string }>(
    `SELECT id, number, user_id FROM orders WHERE razorpay_order_id = $1`,
    [input.razorpayOrderId],
  );
  if (!row || row.user_id !== user.id) throw new HttpError(404, 'not_found', 'We could not find that order.');

  if (!verifyCheckoutSignature(input.razorpayOrderId, input.razorpayPaymentId, input.signature)) {
    await db.query(`INSERT INTO order_events (order_id, type, note, actor) VALUES ($1, 'signature_invalid', $2, 'customer')`, [row.id, `Rejected payment ${input.razorpayPaymentId}`]);
    throw new HttpError(400, 'invalid_signature', 'We could not confirm this payment. If money was deducted it will be refunded automatically.');
  }

  try {
    const payment = await razorpay.fetchPayment(input.razorpayPaymentId);
    if (payment.order_id !== input.razorpayOrderId) throw new HttpError(400, 'invalid_signature', 'We could not confirm this payment.');
    const outcome = await reconcilePayment(input.razorpayPaymentId);
    const paid = !!outcome && (outcome.order.paymentStatus === 'paid' || outcome.order.status === 'new');
    return { status: paid ? 'paid' : 'pending', orderNumber: row.number };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    // Razorpay unreachable: the signature was valid, so the webhook or the reconcile job will finish the job.
    console.error('[orders] could not confirm payment right now', (err as Error).message);
    return { status: 'pending', orderNumber: row.number };
  }
}

/** Ask Razorpay about every payment on an unpaid order. Used by the pending page and the cron job. */
export async function reconcileOrder(orderId: string): Promise<Order | null> {
  const order = await getOrderById(orderId);
  if (!order || !order.razorpayOrderId) return order;
  if (order.status !== 'pending_payment' && order.status !== 'expired') return order;
  try {
    const payments = await razorpay.fetchOrderPayments(order.razorpayOrderId);
    for (const p of payments) {
      if (p.status === 'captured' || p.status === 'authorized') await reconcilePayment(p.id);
      else if (p.status === 'failed') await applyPayment(p);
    }
  } catch (err) {
    console.error('[orders] reconcile failed for', order.number, (err as Error).message);
  }
  return getOrderById(orderId);
}

/** Cron: settle or expire unpaid orders whose payment window has passed. */
export async function expireStaleOrders(limit = 50): Promise<{ checked: number; expired: number; settled: number }> {
  const stale = await db.query<{ id: string }>(
    `SELECT id FROM orders WHERE status = 'pending_payment' AND expires_at < now() ORDER BY expires_at LIMIT $1`,
    [limit],
  );
  let expired = 0;
  let settled = 0;
  for (const s of stale) {
    const after = await reconcileOrder(s.id);
    if (after && after.status !== 'pending_payment') {
      settled++;
      continue;
    }
    await tx(async (q) => {
      const locked = await q.one<{ status: string }>(`SELECT status FROM orders WHERE id = $1 FOR UPDATE`, [s.id]);
      if (locked?.status === 'pending_payment') {
        await expireOrderTx(q, s.id, 'Payment window ended without a payment');
        expired++;
      }
    });
  }
  return { checked: stale.length, expired, settled };
}

// ---------------------------------------------------- cancel, refund, status

const TRANSITIONS: Record<string, OrderStatus[]> = {
  new: ['processing', 'shipped'],
  processing: ['shipped'],
  shipped: ['delivered'],
};

export function allowedNextStatuses(status: OrderStatus): OrderStatus[] {
  return TRANSITIONS[status] ?? [];
}

export async function advanceOrder(
  orderId: string,
  to: 'processing' | 'shipped' | 'delivered',
  actor: string,
  tracking?: { carrier?: string; trackingNumber?: string; trackingUrl?: string },
): Promise<Order> {
  await tx(async (q) => {
    const o = await q.one<OrderDb>(`SELECT * FROM orders WHERE id = $1 FOR UPDATE`, [orderId]);
    if (!o) throw new HttpError(404, 'not_found', 'Order not found.');
    if (!allowedNextStatuses(o.status).includes(to)) {
      throw new HttpError(409, 'invalid_transition', `An order that is ${o.status.replace('_', ' ')} cannot be marked ${to}.`);
    }
    if (o.payment_status !== 'paid' && o.payment_status !== 'partially_refunded') {
      throw new HttpError(409, 'unpaid', 'Only paid orders can move forward.');
    }
    if (to === 'shipped') {
      await q.query(
        `UPDATE orders SET status = 'shipped', shipped_at = now(), carrier = $2, tracking_number = $3, tracking_url = $4, updated_at = now() WHERE id = $1`,
        [orderId, tracking?.carrier ?? null, tracking?.trackingNumber ?? null, tracking?.trackingUrl ?? null],
      );
    } else if (to === 'processing') {
      await q.query(`UPDATE orders SET status = 'processing', processing_at = now(), updated_at = now() WHERE id = $1`, [orderId]);
    } else {
      await q.query(`UPDATE orders SET status = 'delivered', delivered_at = now(), updated_at = now() WHERE id = $1`, [orderId]);
    }
    await addEvent(q, orderId, to, tracking?.trackingNumber ? `Tracking ${tracking.carrier ?? ''} ${tracking.trackingNumber}`.trim() : null, actor);
  });
  const order = (await getOrderById(orderId))!;
  mailOrderStatus(order, to).catch((e) => console.error('[orders] status email failed', e.message));
  return order;
}

/**
 * Cancels an order and returns its stock. A paid order is refunded in full.
 * Customers may only cancel before processing starts and only if the store allows it.
 */
export async function cancelOrder(orderId: string, opts: { actor: string; reason?: string; byCustomer?: boolean; userId?: string }): Promise<Order> {
  const settings = await getSettings();
  const wasPaid = await tx(async (q) => {
    const o = await q.one<OrderDb>(`SELECT * FROM orders WHERE id = $1 FOR UPDATE`, [orderId]);
    if (!o || (opts.byCustomer && o.user_id !== opts.userId)) throw new HttpError(404, 'not_found', 'Order not found.');
    if (opts.byCustomer) {
      if (!settings.policies.cancelBeforeDispatch || (o.status !== 'new' && o.status !== 'pending_payment')) {
        throw new HttpError(409, 'not_cancellable', 'This order can no longer be cancelled online. Contact support for help.');
      }
    } else if (!['pending_payment', 'new', 'processing'].includes(o.status)) {
      throw new HttpError(409, 'not_cancellable', `An order that is ${o.status.replace('_', ' ')} cannot be cancelled.`);
    }
    const paid = o.payment_status === 'paid' || o.payment_status === 'partially_refunded';
    await releaseStock(q, orderId);
    await q.query(`UPDATE orders SET status = 'cancelled', cancelled_at = now(), expires_at = NULL, updated_at = now() WHERE id = $1`, [orderId]);
    await addEvent(q, orderId, 'cancelled', opts.reason ?? null, opts.actor);
    return paid;
  });
  if (wasPaid) {
    await refundOrder(orderId, null, opts.reason ?? 'Order cancelled', null, opts.actor).catch((e) => {
      console.error('[orders] refund after cancellation failed', e.message);
    });
  }
  const order = (await getOrderById(orderId))!;
  mailOrderStatus(order, 'cancelled', { reason: opts.reason }).catch((e) => console.error('[orders] cancel email failed', e.message));
  return order;
}

/**
 * Refund through Razorpay. `amountPaise` null refunds whatever is still refundable.
 * The refund row is written under a row lock before calling Razorpay, so two clicks cannot refund twice.
 */
export async function refundOrder(orderId: string, amountPaise: number | null, reason: string, adminId: string | null, actor: string): Promise<{ refundId: string; amountPaise: number }> {
  const reserved = await tx(async (q) => {
    const o = await q.one<OrderDb>(`SELECT * FROM orders WHERE id = $1 FOR UPDATE`, [orderId]);
    if (!o) throw new HttpError(404, 'not_found', 'Order not found.');
    if (!o.razorpay_payment_id || !['paid', 'partially_refunded'].includes(o.payment_status)) {
      throw new HttpError(409, 'not_refundable', 'This order has no captured payment to refund.');
    }
    const done = await q.one<{ total: string | null }>(`SELECT COALESCE(sum(amount_paise), 0) AS total FROM refunds WHERE order_id = $1 AND status <> 'failed'`, [orderId]);
    const refundable = o.total_paise - Number(done?.total ?? 0);
    const amount = amountPaise ?? refundable;
    if (amount <= 0 || amount > refundable) {
      throw new HttpError(422, 'invalid_amount', `The refund must be between ${formatINR(1)} and ${formatINR(refundable)}.`);
    }
    const row = await q.one<{ id: string }>(
      `INSERT INTO refunds (order_id, razorpay_payment_id, amount_paise, status, reason, created_by_admin) VALUES ($1, $2, $3, 'pending', $4, $5) RETURNING id`,
      [orderId, o.razorpay_payment_id, amount, reason, adminId],
    );
    return { refundRowId: row!.id, paymentId: o.razorpay_payment_id, amount, total: o.total_paise, alreadyRefunded: Number(done?.total ?? 0) };
  });

  try {
    const rf = await razorpay.refund(reserved.paymentId, reserved.amount, { order_id: orderId, reason: reason.slice(0, 200) });
    const fullyRefunded = reserved.alreadyRefunded + reserved.amount >= reserved.total;
    await tx(async (q) => {
      await q.query(`UPDATE refunds SET razorpay_refund_id = $2, status = CASE WHEN status = 'processed' THEN status ELSE $3 END, updated_at = now() WHERE id = $1`, [reserved.refundRowId, rf.id, rf.status === 'processed' ? 'processed' : 'pending']);
      await q.query(`UPDATE orders SET payment_status = $2, updated_at = now() WHERE id = $1`, [orderId, fullyRefunded ? 'refunded' : 'partially_refunded']);
      await addEvent(q, orderId, 'refund_initiated', `${formatINR(reserved.amount)} refund started (${rf.id}). ${reason}`, actor);
    });
    const order = (await getOrderById(orderId))!;
    mailOrderStatus(order, 'refunded', { refundPaise: reserved.amount }).catch((e) => console.error('[orders] refund email failed', e.message));
    return { refundId: rf.id, amountPaise: reserved.amount };
  } catch (err) {
    if (err instanceof RazorpayError) {
      // Razorpay rejected the refund, so nothing was refunded and the amount becomes refundable again.
      await db.query(`UPDATE refunds SET status = 'failed', updated_at = now() WHERE id = $1`, [reserved.refundRowId]);
      await db.query(`INSERT INTO order_events (order_id, type, note, actor) VALUES ($1, 'refund_failed', $2, $3)`, [orderId, err.message.slice(0, 300), actor]);
      throw new HttpError(502, 'refund_failed', `Razorpay could not process the refund: ${err.message}`);
    }
    // Anything else (for example a database error after Razorpay accepted the refund) must NOT free the amount for a
    // second attempt. The row stays pending and the refund webhook reconciles it.
    await db.query(`INSERT INTO order_events (order_id, type, note, actor) VALUES ($1, 'refund_check_needed', $2, $3)`, [orderId, (err as Error).message.slice(0, 300), actor]).catch(() => undefined);
    throw err;
  }
}

/** Webhook: a refund finished or failed at the bank, or was started from the Razorpay dashboard. */
export async function applyRefundUpdate(refund: { id: string; payment_id: string; amount: number; status: string }): Promise<void> {
  const status = refund.status === 'processed' ? 'processed' : refund.status === 'failed' ? 'failed' : 'pending';
  let row = await db.one<{ id: string; order_id: string }>(`SELECT id, order_id FROM refunds WHERE razorpay_refund_id = $1`, [refund.id]);

  if (!row) {
    // The webhook can arrive before refundOrder has stored the Razorpay refund id. Claim that pending row first.
    row = await db.one<{ id: string; order_id: string }>(
      `UPDATE refunds SET razorpay_refund_id = $1, status = $4, updated_at = now()
        WHERE id = (SELECT id FROM refunds WHERE razorpay_payment_id = $2 AND razorpay_refund_id IS NULL AND status = 'pending' AND amount_paise = $3
                     ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
        RETURNING id, order_id`,
      [refund.id, refund.payment_id, refund.amount, status],
    );
  }
  if (!row) {
    // A refund we did not start ourselves. Attach it to the order that owns the payment.
    const o = await db.one<{ id: string }>(`SELECT id FROM orders WHERE razorpay_payment_id = $1`, [refund.payment_id]);
    if (!o) return;
    row = await db.one<{ id: string; order_id: string }>(
      `INSERT INTO refunds (order_id, razorpay_payment_id, razorpay_refund_id, amount_paise, status, reason)
       VALUES ($1, $2, $3, $4, $5, 'Started from the Razorpay dashboard')
       ON CONFLICT (razorpay_refund_id) DO UPDATE SET status = EXCLUDED.status, updated_at = now()
       RETURNING id, order_id`,
      [o.id, refund.payment_id, refund.id, refund.amount, status],
    );
  }
  if (!row) return;
  await db.query(`UPDATE refunds SET status = $2, updated_at = now() WHERE id = $1`, [row.id, status]);

  const sums = await db.one<{ refunded: string; total: number }>(
    `SELECT COALESCE((SELECT sum(amount_paise) FROM refunds WHERE order_id = $1 AND status <> 'failed'), 0) AS refunded,
            (SELECT total_paise FROM orders WHERE id = $1) AS total`,
    [row.order_id],
  );
  if (sums) {
    const refunded = Number(sums.refunded);
    const next = refunded >= sums.total ? 'refunded' : refunded > 0 ? 'partially_refunded' : 'paid';
    await db.query(`UPDATE orders SET payment_status = $2, updated_at = now() WHERE id = $1 AND payment_status IN ('paid', 'partially_refunded', 'refunded')`, [row.order_id, next]);
  }
  await db.query(`INSERT INTO order_events (order_id, type, note, actor) VALUES ($1, $2, $3, 'system')`, [
    row.order_id,
    status === 'failed' ? 'refund_failed' : 'refund_updated',
    `Refund ${refund.id} is ${refund.status}`,
  ]);
}
