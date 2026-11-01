'use client';

import Link from 'next/link';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, errorMessage } from '@/lib/client';
import { formatINR } from '@/lib/format';
import { Icon } from './icons';
import { useFocusTrap } from './useFocusTrap';

// The cart lives in Postgres. This provider only mirrors it for the header count and the drawer,
// and every change goes through the API so prices and stock always come from the server.

export interface ClientCartLine {
  variantId: string;
  slug: string;
  name: string;
  size: string;
  color: string;
  imageUrl: string | null;
  unitPaise: number;
  qty: number;
  stock: number;
  lineTotalPaise: number;
  available: boolean;
  issue: string | null;
}

export interface ClientCart {
  lines: ClientCartLine[];
  count: number;
  subtotalPaise: number;
  hasIssues: boolean;
}

interface CartApi {
  cart: ClientCart;
  open: boolean;
  setOpen: (v: boolean) => void;
  add: (variantId: string, qty?: number) => Promise<string | null>;
  setQty: (variantId: string, qty: number) => Promise<void>;
  refresh: () => Promise<void>;
  message: string | null;
}

const CartContext = createContext<CartApi | null>(null);

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}

export function CartProvider({ initial, children }: { initial: ClientCart; children: ReactNode }) {
  const [cart, setCart] = useState<ClientCart>(initial);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ cart: ClientCart }>('/api/cart');
      setCart(r.cart);
    } catch {
      /* keep what we have */
    }
  }, []);

  const add = useCallback(async (variantId: string, qty = 1) => {
    const my = ++seq.current;
    setMessage(null);
    try {
      const r = await api<{ cart: ClientCart }>('/api/cart/items', { method: 'POST', body: { variantId, qty } });
      if (my === seq.current) setCart(r.cart);
      setOpen(true);
      return null;
    } catch (err) {
      const msg = errorMessage(err);
      setMessage(msg);
      return msg;
    }
  }, []);

  const setQty = useCallback(async (variantId: string, qty: number) => {
    const my = ++seq.current;
    setMessage(null);
    try {
      const r = await api<{ cart: ClientCart }>('/api/cart/items', { method: 'PATCH', body: { variantId, qty } });
      if (my === seq.current) setCart(r.cart);
    } catch (err) {
      setMessage(errorMessage(err));
    }
  }, []);

  const value = useMemo(() => ({ cart, open, setOpen, add, setQty, refresh, message }), [cart, open, add, setQty, refresh, message]);

  return (
    <CartContext.Provider value={value}>
      {children}
      <CartDrawer />
    </CartContext.Provider>
  );
}

function CartDrawer() {
  const { cart, open, setOpen, setQty, message } = useCart();
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), [setOpen]);
  useFocusTrap(ref, open, close);
  if (!open) return null;

  return (
    <>
      <div className="scrim" onClick={close} aria-hidden="true" />
      <div ref={ref} className="drawer" role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title">
        <div className="drawer__head">
          <h2 id="cart-drawer-title" style={{ fontSize: '1.75rem' }}>
            Your bag
          </h2>
          <button type="button" className="icon-btn" onClick={close} aria-label="Close bag" data-autofocus>
            <Icon name="close" />
          </button>
        </div>

        <div className="drawer__body">
          {message ? (
            <p className="notice notice--error" role="alert" style={{ marginTop: '0.75rem' }}>
              {message}
            </p>
          ) : null}
          {cart.lines.length === 0 ? (
            <div className="stack" style={{ padding: '2rem 0' }}>
              <p>Your bag is empty.</p>
              <Link href="/shop" className="btn" onClick={close}>
                Browse the shop
              </Link>
            </div>
          ) : (
            cart.lines.map((l) => (
              <div className="cart-line" key={l.variantId} style={{ gridTemplateColumns: '68px minmax(0,1fr) auto' }}>
                <div className="cart-line__img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {l.imageUrl ? <img src={l.imageUrl} alt="" width={68} height={85} loading="lazy" /> : null}
                </div>
                <div className="stack stack--sm">
                  <Link href={`/products/${l.slug}`} onClick={close} style={{ color: 'var(--ink-strong)', fontWeight: 500, textDecoration: 'none' }}>
                    {l.name}
                  </Link>
                  <span className="small muted">{[l.size, l.color].filter(Boolean).join(', ')}</span>
                  {l.issue ? (
                    <span className="small" style={{ color: 'var(--danger)' }}>
                      {l.issue}
                    </span>
                  ) : null}
                  <div className="qty" style={{ alignSelf: 'flex-start' }}>
                    <button type="button" onClick={() => setQty(l.variantId, l.qty - 1)} aria-label={`Decrease quantity of ${l.name}`}>
                      <Icon name="minus" size={16} />
                    </button>
                    <output aria-live="polite">{l.qty}</output>
                    <button type="button" onClick={() => setQty(l.variantId, l.qty + 1)} aria-label={`Increase quantity of ${l.name}`} disabled={l.qty >= Math.min(10, l.stock)}>
                      <Icon name="plus" size={16} />
                    </button>
                  </div>
                </div>
                <div className="stack stack--sm" style={{ alignItems: 'flex-end' }}>
                  <span className="price">{formatINR(l.lineTotalPaise)}</span>
                  <button type="button" className="link-btn small" onClick={() => setQty(l.variantId, 0)}>
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.lines.length > 0 ? (
          <div className="drawer__foot stack">
            <div className="row row--between">
              <span>Subtotal</span>
              <span className="price">{formatINR(cart.subtotalPaise)}</span>
            </div>
            <p className="small muted">Shipping and the final total are shown at checkout.</p>
            <Link href="/checkout" className="btn btn--primary btn--block" onClick={close} aria-disabled={cart.hasIssues}>
              Checkout
            </Link>
            <Link href="/cart" className="btn btn--block" onClick={close}>
              View bag
            </Link>
          </div>
        ) : null}
      </div>
    </>
  );
}
