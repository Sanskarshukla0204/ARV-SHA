import { db } from './db';
import type { OrderStatus, PaymentStatus } from './orders';

// Read queries for the admin panel. Only imported by pages under app/admin-internal.

export interface DayRevenue {
  day: string; // YYYY-MM-DD in India time
  paise: number;
  orders: number;
}

export interface Dashboard {
  revenue30: number;
  orders30: number;
  revenueToday: number;
  ordersToday: number;
  toShip: number;
  awaitingPayment: number;
  openTickets: number;
  series: DayRevenue[];
  lowStock: { productId: string; name: string; size: string; color: string; stock: number }[];
  topItems: { name: string; units: number; paise: number }[];
  recent: { id: string; number: string; contactName: string; status: OrderStatus; totalPaise: number; placedAt: Date }[];
}

// Revenue counts orders whose payment was received and that were not fully cancelled or refunded.
const REVENUE = `payment_status IN ('paid', 'partially_refunded') AND status NOT IN ('cancelled', 'expired')`;

export async function getDashboard(): Promise<Dashboard> {
  const [totals, series, low, top, recent] = await Promise.all([
    db.one<{ revenue30: string; orders30: number; revenue_today: string; orders_today: number; to_ship: number; awaiting: number; tickets: number }>(
      `SELECT
         COALESCE(SUM(total_paise) FILTER (WHERE ${REVENUE} AND paid_at >= now() - interval '30 days'), 0) AS revenue30,
         COUNT(*) FILTER (WHERE ${REVENUE} AND paid_at >= now() - interval '30 days')::int AS orders30,
         COALESCE(SUM(total_paise) FILTER (WHERE ${REVENUE} AND (paid_at AT TIME ZONE 'Asia/Kolkata')::date = (now() AT TIME ZONE 'Asia/Kolkata')::date), 0) AS revenue_today,
         COUNT(*) FILTER (WHERE ${REVENUE} AND (paid_at AT TIME ZONE 'Asia/Kolkata')::date = (now() AT TIME ZONE 'Asia/Kolkata')::date)::int AS orders_today,
         COUNT(*) FILTER (WHERE status IN ('new', 'processing'))::int AS to_ship,
         COUNT(*) FILTER (WHERE status = 'pending_payment')::int AS awaiting,
         (SELECT COUNT(*)::int FROM support_tickets WHERE status = 'open') AS tickets
       FROM orders`,
    ),
    db.query<{ day: string; paise: string; orders: number }>(
      `SELECT to_char(d::date, 'YYYY-MM-DD') AS day, COALESCE(x.paise, 0) AS paise, COALESCE(x.orders, 0)::int AS orders
         FROM generate_series((now() AT TIME ZONE 'Asia/Kolkata')::date - 29, (now() AT TIME ZONE 'Asia/Kolkata')::date, interval '1 day') d
         LEFT JOIN (
           SELECT (paid_at AT TIME ZONE 'Asia/Kolkata')::date AS day, SUM(total_paise) AS paise, COUNT(*) AS orders
             FROM orders WHERE ${REVENUE} AND paid_at >= now() - interval '31 days' GROUP BY 1
         ) x ON x.day = d::date
        ORDER BY d`,
    ),
    db.query<{ product_id: string; name: string; size: string; color: string; stock: number }>(
      `SELECT p.id AS product_id, p.name, v.size, v.color, v.stock
         FROM product_variants v JOIN products p ON p.id = v.product_id
        WHERE p.status = 'active' AND v.active AND v.stock <= 3 ORDER BY v.stock, p.name LIMIT 10`,
    ),
    db.query<{ name: string; units: string; paise: string }>(
      `SELECT oi.name, SUM(oi.qty) AS units, SUM(oi.line_total_paise) AS paise
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.payment_status IN ('paid', 'partially_refunded') AND o.status NOT IN ('cancelled', 'expired') AND o.paid_at >= now() - interval '30 days'
        GROUP BY oi.name ORDER BY units DESC, paise DESC LIMIT 5`,
    ),
    db.query<{ id: string; number: string; contact_name: string; status: OrderStatus; total_paise: number; placed_at: Date }>(
      `SELECT id, number, contact_name, status, total_paise, placed_at FROM orders WHERE status <> 'pending_payment' ORDER BY placed_at DESC LIMIT 8`,
    ),
  ]);
  const t = totals!;
  return {
    revenue30: Number(t.revenue30),
    orders30: t.orders30,
    revenueToday: Number(t.revenue_today),
    ordersToday: t.orders_today,
    toShip: t.to_ship,
    awaitingPayment: t.awaiting,
    openTickets: t.tickets,
    series: series.map((r) => ({ day: r.day, paise: Number(r.paise), orders: r.orders })),
    lowStock: low.map((r) => ({ productId: r.product_id, name: r.name, size: r.size, color: r.color, stock: r.stock })),
    topItems: top.map((r) => ({ name: r.name, units: Number(r.units), paise: Number(r.paise) })),
    recent: recent.map((r) => ({ id: r.id, number: r.number, contactName: r.contact_name, status: r.status, totalPaise: r.total_paise, placedAt: r.placed_at })),
  };
}

// ------------------------------------------------------------------ orders list

export interface OrderFilters {
  status?: string;
  q?: string; // order number, customer name, phone or email
  item?: string; // product name inside the order
  from?: string; // YYYY-MM-DD
  to?: string;
  page?: number;
}

export const ADMIN_PAGE_SIZE = 25;
const STATUSES = ['pending_payment', 'new', 'processing', 'shipped', 'delivered', 'cancelled', 'expired'];

export interface AdminOrderRow {
  id: string;
  number: string;
  contactName: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalPaise: number;
  placedAt: Date;
  items: string;
}

export async function listAdminOrders(f: OrderFilters): Promise<{ rows: AdminOrderRow[]; total: number }> {
  const where: string[] = [];
  const args: unknown[] = [];
  const add = (sql: string, val: unknown) => {
    args.push(val);
    where.push(sql.replace('?', `$${args.length}`));
  };
  if (f.status === 'to_ship') where.push(`o.status IN ('new', 'processing')`);
  else if (f.status && STATUSES.includes(f.status)) add('o.status = ?', f.status);
  if (f.q) {
    const like = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    args.push(like);
    const n = `$${args.length}`;
    where.push(`(o.number ILIKE ${n} OR o.contact_name ILIKE ${n} OR o.contact_phone ILIKE ${n} OR o.contact_email ILIKE ${n})`);
  }
  if (f.item) {
    const like = `%${f.item.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    args.push(like);
    where.push(`EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id AND (i.name ILIKE $${args.length} OR i.sku ILIKE $${args.length}))`);
  }
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) add(`(o.placed_at AT TIME ZONE 'Asia/Kolkata')::date >= ?::date`, f.from);
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) add(`(o.placed_at AT TIME ZONE 'Asia/Kolkata')::date <= ?::date`, f.to);
  // Orders nobody paid for are noise unless the admin asks for them.
  if (!f.status) where.push(`o.status <> 'pending_payment'`);
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const page = Math.max(1, Math.min(f.page ?? 1, 10_000));
  const [rows, count] = await Promise.all([
    db.query<{ id: string; number: string; contact_name: string; status: OrderStatus; payment_status: PaymentStatus; total_paise: number; placed_at: Date; items: string }>(
      `SELECT o.id, o.number, o.contact_name, o.status, o.payment_status, o.total_paise, o.placed_at,
              (SELECT string_agg(i.name || ' ' || i.size || ' x' || i.qty, ', ' ORDER BY i.name) FROM order_items i WHERE i.order_id = o.id) AS items
         FROM orders o ${w} ORDER BY o.placed_at DESC LIMIT ${ADMIN_PAGE_SIZE} OFFSET ${(page - 1) * ADMIN_PAGE_SIZE}`,
      args,
    ),
    db.one<{ n: number }>(`SELECT COUNT(*)::int AS n FROM orders o ${w}`, args),
  ]);
  return {
    total: count?.n ?? 0,
    rows: rows.map((r) => ({ id: r.id, number: r.number, contactName: r.contact_name, status: r.status, paymentStatus: r.payment_status, totalPaise: r.total_paise, placedAt: r.placed_at, items: r.items ?? '' })),
  };
}

export async function getOrderExtras(orderId: string) {
  const [payments, refunds, customer] = await Promise.all([
    db.query<{ razorpay_payment_id: string | null; amount_paise: number; status: string; method: string | null; error_description: string | null; created_at: Date }>(
      `SELECT razorpay_payment_id, amount_paise, status, method, error_description, created_at FROM payments WHERE order_id = $1 ORDER BY created_at`,
      [orderId],
    ),
    db.query<{ razorpay_refund_id: string | null; amount_paise: number; status: string; reason: string | null; created_at: Date }>(
      `SELECT razorpay_refund_id, amount_paise, status, reason, created_at FROM refunds WHERE order_id = $1 ORDER BY created_at`,
      [orderId],
    ),
    db.one<{ public_id: string; email: string | null }>(`SELECT u.public_id, u.email FROM users u JOIN orders o ON o.user_id = u.id WHERE o.id = $1`, [orderId]),
  ]);
  return { payments, refunds, customer };
}

// ------------------------------------------------------------------ products

export interface AdminProductRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  pricePaise: number;
  stock: number;
  variants: number;
  image: string | null;
  category: string | null;
  updatedAt: Date;
}

export async function listAdminProducts(opts: { status?: string; q?: string }): Promise<AdminProductRow[]> {
  const args: unknown[] = [];
  const where: string[] = [];
  if (opts.status && ['draft', 'active', 'archived'].includes(opts.status)) {
    args.push(opts.status);
    where.push(`p.status = $${args.length}`);
  } else where.push(`p.status <> 'archived'`);
  if (opts.q) {
    args.push(`%${opts.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
    where.push(`(p.name ILIKE $${args.length} OR EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.sku ILIKE $${args.length}))`);
  }
  const rows = await db.query<{ id: string; name: string; slug: string; status: string; price_paise: number; stock: number; variants: number; image: string | null; category: string | null; updated_at: Date }>(
    `SELECT p.id, p.name, p.slug, p.status, p.price_paise, p.updated_at,
            COALESCE((SELECT SUM(stock) FROM product_variants v WHERE v.product_id = p.id AND v.active), 0)::int AS stock,
            (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id)::int AS variants,
            (SELECT url_sm FROM product_images i WHERE i.product_id = p.id ORDER BY sort_order LIMIT 1) AS image,
            (SELECT name FROM categories c WHERE c.id = p.category_id) AS category
       FROM products p WHERE ${where.join(' AND ')} ORDER BY p.updated_at DESC LIMIT 200`,
    args,
  );
  return rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, status: r.status, pricePaise: r.price_paise, stock: r.stock, variants: r.variants, image: r.image, category: r.category, updatedAt: r.updated_at }));
}

export interface EditableProduct {
  id: string | null;
  name: string;
  slug: string;
  shortDesc: string;
  description: string;
  fabric: string;
  fit: string;
  care: string;
  origin: string;
  details: { label: string; value: string }[];
  price: string; // rupees as typed
  comparePrice: string;
  categoryId: string;
  status: 'draft' | 'active' | 'archived';
  tags: string;
  seoTitle: string;
  seoDescription: string;
  variants: { id: string | null; sku: string; size: string; color: string; colorHex: string; price: string; stock: string; active: boolean }[];
  images: { id: string; url: string; alt: string; color: string }[];
}

const rupees = (paise: number | null) => (paise === null ? '' : paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2));

export function blankProduct(): EditableProduct {
  return {
    id: null, name: '', slug: '', shortDesc: '', description: '', fabric: '', fit: '', care: '', origin: '', details: [], price: '', comparePrice: '',
    categoryId: '', status: 'draft', tags: '', seoTitle: '', seoDescription: '', variants: [{ id: null, sku: '', size: '', color: '', colorHex: '', price: '', stock: '0', active: true }], images: [],
  };
}

export async function getEditableProduct(id: string): Promise<EditableProduct | null> {
  const p = await db.one<any>(`SELECT * FROM products WHERE id = $1`, [id]);
  if (!p) return null;
  const [variants, images] = await Promise.all([
    db.query<any>(`SELECT * FROM product_variants WHERE product_id = $1 ORDER BY sort_order, created_at`, [id]),
    db.query<any>(`SELECT id, url_md, alt, color FROM product_images WHERE product_id = $1 ORDER BY sort_order`, [id]),
  ]);
  return {
    id: p.id, name: p.name, slug: p.slug, shortDesc: p.short_desc ?? '', description: p.description ?? '', fabric: p.fabric ?? '', fit: p.fit ?? '', care: p.care ?? '', origin: p.origin ?? '',
    details: Array.isArray(p.details) ? p.details.map((d: any) => ({ label: String(d.label ?? ''), value: String(d.value ?? '') })) : [],
    price: rupees(p.price_paise), comparePrice: rupees(p.compare_at_paise), categoryId: p.category_id ?? '', status: p.status, tags: (p.tags ?? []).join(', '),
    seoTitle: p.seo_title ?? '', seoDescription: p.seo_description ?? '',
    variants: variants.map((v: any) => ({ id: v.id, sku: v.sku, size: v.size, color: v.color ?? '', colorHex: v.color_hex ?? '', price: rupees(v.price_paise), stock: String(v.stock), active: v.active })),
    images: images.map((i: any) => ({ id: i.id, url: i.url_md, alt: i.alt, color: i.color ?? '' })),
  };
}

export async function listAdminCategories() {
  return db.query<{ id: string; parent_id: string | null; slug: string; name: string; description: string | null; sort_order: number; active: boolean; products: number }>(
    `SELECT c.id, c.parent_id, c.slug, c.name, c.description, c.sort_order, c.active,
            (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id AND p.status <> 'archived') AS products
       FROM categories c ORDER BY c.parent_id NULLS FIRST, c.sort_order, c.name`,
  );
}

export async function listTickets(status?: string) {
  const args: unknown[] = [];
  let w = '';
  if (status && ['open', 'answered', 'closed'].includes(status)) {
    args.push(status);
    w = 'WHERE t.status = $1';
  }
  return db.query<{ id: string; reference: string; name: string; email: string; phone: string | null; order_number: string | null; topic: string; message: string; status: string; created_at: Date; public_id: string | null }>(
    `SELECT t.id, t.reference, t.name, t.email, t.phone, t.order_number, t.topic, t.message, t.status, t.created_at, u.public_id
       FROM support_tickets t LEFT JOIN users u ON u.id = t.user_id ${w} ORDER BY (t.status = 'open') DESC, t.created_at DESC LIMIT 100`,
    args,
  );
}

export async function listAudit(limit = 100) {
  return db.query<{ id: string; admin_email: string | null; action: string; entity: string | null; entity_id: string | null; meta: Record<string, unknown> | null; ip: string | null; created_at: Date }>(
    `SELECT id, admin_email, action, entity, entity_id, meta, ip, created_at FROM admin_audit_log ORDER BY created_at DESC, id DESC LIMIT $1`,
    [limit],
  );
}

export async function listAdminSessions(adminId: string) {
  return db.query<{ id: string; ip: string | null; user_agent: string | null; created_at: Date; last_seen_at: Date }>(
    `SELECT id, ip, user_agent, created_at, last_seen_at FROM admin_sessions WHERE admin_id = $1 AND revoked_at IS NULL AND expires_at > now() ORDER BY last_seen_at DESC`,
    [adminId],
  );
}
