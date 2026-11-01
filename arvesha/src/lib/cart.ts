import { cookies } from 'next/headers';
import { db, tx, type Queryable } from './db';
import { randomToken, sha256 } from './crypto';
import { isProd } from './env';
import { HttpError } from './http';
import type { SessionUser } from './session';

// Carts are stored in Postgres, so what a visitor adds survives closing the browser.
// Signed-out visitors get a random httpOnly cookie; signing in merges that cart into the account cart.

export const CART_COOKIE = isProd ? '__Host-arv_cart' : 'arv_cart';
const CART_TTL_DAYS = 30;
export const MAX_QTY_PER_LINE = 10;
export const MAX_LINES = 30;

export interface CartLine {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  size: string;
  color: string;
  imageUrl: string | null;
  unitPaise: number;
  qty: number;
  stock: number;
  lineTotalPaise: number;
  /** false when the product was unpublished, the variant switched off, or stock is below the requested quantity */
  available: boolean;
  issue: string | null;
}

export interface CartView {
  lines: CartLine[];
  /** total units in the cart */
  count: number;
  subtotalPaise: number;
  hasIssues: boolean;
}

export const EMPTY_CART: CartView = { lines: [], count: 0, subtotalPaise: 0, hasIssues: false };

interface LineRow {
  variant_id: string;
  product_id: string;
  slug: string;
  name: string;
  size: string;
  color: string;
  image_url: string | null;
  unit_price: number;
  qty: number;
  stock: number;
  v_active: boolean;
  p_status: string;
}

async function findCartId(user: SessionUser | null): Promise<string | null> {
  if (user) {
    const row = await db.one<{ id: string }>(`SELECT id FROM carts WHERE user_id = $1`, [user.id]);
    return row?.id ?? null;
  }
  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (!token || token.length < 20 || token.length > 200) return null;
  const row = await db.one<{ id: string }>(`SELECT id FROM carts WHERE token_hash = $1 AND user_id IS NULL AND expires_at > now()`, [sha256(token)]);
  return row?.id ?? null;
}

/** Only call from route handlers: it may create the cart and set the cookie. */
async function findOrCreateCartId(user: SessionUser | null): Promise<string> {
  const existing = await findCartId(user);
  if (existing) return existing;
  if (user) {
    const row = await db.one<{ id: string }>(
      `INSERT INTO carts (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET updated_at = now() RETURNING id`,
      [user.id],
    );
    return row!.id;
  }
  const token = randomToken(32);
  const row = await db.one<{ id: string }>(`INSERT INTO carts (token_hash) VALUES ($1) RETURNING id`, [sha256(token)]);
  (await cookies()).set(CART_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: CART_TTL_DAYS * 24 * 3600,
  });
  return row!.id;
}

export async function loadCartLines(q: Queryable, cartId: string, lock = false): Promise<CartLine[]> {
  const rows = await q.query<LineRow>(
    `SELECT ci.variant_id, p.id AS product_id, p.slug, p.name, v.size, v.color,
            (SELECT pi.url_sm FROM product_images pi WHERE pi.product_id = p.id
              ORDER BY CASE WHEN pi.color = v.color THEN 0 WHEN pi.color IS NULL THEN 1 ELSE 2 END, pi.sort_order, pi.created_at LIMIT 1) AS image_url,
            COALESCE(v.price_paise, p.price_paise) AS unit_price,
            ci.qty, v.stock, v.active AS v_active, p.status AS p_status
       FROM cart_items ci
       JOIN product_variants v ON v.id = ci.variant_id
       JOIN products p ON p.id = v.product_id
      WHERE ci.cart_id = $1
      ORDER BY ${lock ? 'ci.variant_id' : 'ci.added_at'}${lock ? ' FOR UPDATE OF v' : ''}`,
    [cartId],
  );
  return rows.map((r) => {
    const sellable = r.v_active && r.p_status === 'active';
    let issue: string | null = null;
    if (!sellable) issue = 'No longer available';
    else if (r.stock <= 0) issue = 'Out of stock';
    else if (r.stock < r.qty) issue = `Only ${r.stock} left`;
    return {
      variantId: r.variant_id,
      productId: r.product_id,
      slug: r.slug,
      name: r.name,
      size: r.size,
      color: r.color,
      imageUrl: r.image_url,
      unitPaise: r.unit_price,
      qty: r.qty,
      stock: r.stock,
      lineTotalPaise: r.unit_price * r.qty,
      available: issue === null,
      issue,
    };
  });
}

export function summarize(lines: CartLine[]): CartView {
  return {
    lines,
    count: lines.reduce((s, l) => s + l.qty, 0),
    subtotalPaise: lines.filter((l) => l.available).reduce((s, l) => s + l.lineTotalPaise, 0),
    hasIssues: lines.some((l) => !l.available),
  };
}

/** Read-only: safe to call while rendering a page. */
export async function getCartView(user: SessionUser | null): Promise<CartView> {
  try {
    const id = await findCartId(user);
    if (!id) return EMPTY_CART;
    return summarize(await loadCartLines(db, id));
  } catch (err) {
    console.error('[cart] could not load cart', (err as Error).message);
    return EMPTY_CART;
  }
}

async function touch(cartId: string) {
  await db.query(`UPDATE carts SET updated_at = now(), expires_at = now() + ($2 || ' days')::interval WHERE id = $1`, [cartId, String(CART_TTL_DAYS)]);
}

export async function addToCart(user: SessionUser | null, variantId: string, qty: number): Promise<CartView> {
  const variant = await db.one<{ stock: number; active: boolean; status: string }>(
    `SELECT v.stock, v.active, p.status FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.id = $1`,
    [variantId],
  );
  if (!variant || !variant.active || variant.status !== 'active') {
    throw new HttpError(404, 'unavailable', 'This item is no longer available.');
  }
  if (variant.stock <= 0) throw new HttpError(409, 'out_of_stock', 'This size is out of stock.');

  const cartId = await findOrCreateCartId(user);
  const lineCount = await db.one<{ n: number }>(`SELECT count(*)::int AS n FROM cart_items WHERE cart_id = $1`, [cartId]);
  const existing = await db.one<{ qty: number }>(`SELECT qty FROM cart_items WHERE cart_id = $1 AND variant_id = $2`, [cartId, variantId]);
  if (!existing && (lineCount?.n ?? 0) >= MAX_LINES) throw new HttpError(409, 'cart_full', 'Your cart is full. Remove an item to add another.');

  const cap = Math.min(MAX_QTY_PER_LINE, variant.stock);
  const target = Math.min(cap, (existing?.qty ?? 0) + qty);
  await db.query(
    `INSERT INTO cart_items (cart_id, variant_id, qty) VALUES ($1, $2, $3)
     ON CONFLICT (cart_id, variant_id) DO UPDATE SET qty = $3`,
    [cartId, variantId, target],
  );
  await touch(cartId);
  return summarize(await loadCartLines(db, cartId));
}

export async function setCartQty(user: SessionUser | null, variantId: string, qty: number): Promise<CartView> {
  const cartId = await findCartId(user);
  if (!cartId) return EMPTY_CART;
  if (qty <= 0) {
    await db.query(`DELETE FROM cart_items WHERE cart_id = $1 AND variant_id = $2`, [cartId, variantId]);
  } else {
    const v = await db.one<{ stock: number }>(`SELECT stock FROM product_variants WHERE id = $1`, [variantId]);
    const cap = Math.min(MAX_QTY_PER_LINE, Math.max(v?.stock ?? 0, 1));
    await db.query(`UPDATE cart_items SET qty = $3 WHERE cart_id = $1 AND variant_id = $2`, [cartId, variantId, Math.min(qty, cap)]);
  }
  await touch(cartId);
  return summarize(await loadCartLines(db, cartId));
}

export async function clearCartById(q: Queryable, cartId: string): Promise<void> {
  await q.query(`DELETE FROM cart_items WHERE cart_id = $1`, [cartId]);
}

export async function getCartIdForUser(userId: string): Promise<string | null> {
  const row = await db.one<{ id: string }>(`SELECT id FROM carts WHERE user_id = $1`, [userId]);
  return row?.id ?? null;
}

/** After sign-in or registration: fold the guest cart into the customer's cart and retire the cookie. */
export async function mergeGuestCart(userId: string): Promise<void> {
  const jar = await cookies();
  const token = jar.get(CART_COOKIE)?.value;
  if (!token) return;
  try {
    await tx(async (q) => {
      const guest = await q.one<{ id: string }>(`SELECT id FROM carts WHERE token_hash = $1 AND user_id IS NULL`, [sha256(token)]);
      if (!guest) return;
      const mine = await q.one<{ id: string }>(
        `INSERT INTO carts (user_id) VALUES ($1) ON CONFLICT (user_id) DO UPDATE SET updated_at = now() RETURNING id`,
        [userId],
      );
      await q.query(
        `INSERT INTO cart_items (cart_id, variant_id, qty)
         SELECT $1, gi.variant_id, gi.qty FROM cart_items gi WHERE gi.cart_id = $2
         ON CONFLICT (cart_id, variant_id) DO UPDATE SET qty = LEAST($3, cart_items.qty + EXCLUDED.qty)`,
        [mine!.id, guest.id, MAX_QTY_PER_LINE],
      );
      await q.query(`DELETE FROM carts WHERE id = $1`, [guest.id]);
    });
  } finally {
    jar.set(CART_COOKIE, '', { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge: 0 });
  }
}

export async function deleteExpiredCarts(): Promise<number> {
  const rows = await db.query(`DELETE FROM carts WHERE expires_at < now() RETURNING 1`);
  return rows.length;
}
