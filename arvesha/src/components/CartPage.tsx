'use client';

import Link from 'next/link';
import { formatINR } from '@/lib/format';
import { useCart } from './CartProvider';
import { Icon } from './icons';

export function CartPage({ flatPaise, freeAbovePaise }: { flatPaise: number; freeAbovePaise: number | null }) {
  const { cart, setQty, message } = useCart();
  const shipping = cart.subtotalPaise === 0 ? 0 : freeAbovePaise !== null && cart.subtotalPaise >= freeAbovePaise ? 0 : flatPaise;
  const total = cart.subtotalPaise + shipping;

  if (cart.lines.length === 0) {
    return (
      <div className="empty raised">
        <h2 style={{ fontSize: '1.75rem' }}>Your bag is empty</h2>
        <p>Items you add stay saved to your bag, even if you close the browser.</p>
        <Link href="/shop" className="btn btn--primary">
          Browse the shop
        </Link>
      </div>
    );
  }

  return (
    <div className="split">
      <section aria-label="Items in your bag">
        {message ? (
          <p className="notice notice--error" role="alert">
            {message}
          </p>
        ) : null}
        {cart.lines.map((l) => (
          <div className="cart-line" key={l.variantId}>
            <div className="cart-line__img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {l.imageUrl ? <img src={l.imageUrl} alt="" width={84} height={105} loading="lazy" /> : null}
            </div>
            <div className="stack stack--sm">
              <Link href={`/products/${l.slug}`} style={{ color: 'var(--ink-strong)', fontWeight: 500, textDecoration: 'none' }}>
                {l.name}
              </Link>
              <span className="small muted">{[l.size, l.color].filter(Boolean).join(', ')}</span>
              {l.issue ? (
                <span className="small" role="alert" style={{ color: 'var(--danger)' }}>
                  {l.issue}
                </span>
              ) : null}
              <div className="row">
                <div className="qty">
                  <button type="button" onClick={() => setQty(l.variantId, l.qty - 1)} aria-label={`Decrease quantity of ${l.name}`}>
                    <Icon name="minus" size={16} />
                  </button>
                  <output aria-live="polite">{l.qty}</output>
                  <button type="button" onClick={() => setQty(l.variantId, l.qty + 1)} aria-label={`Increase quantity of ${l.name}`} disabled={l.qty >= Math.min(10, l.stock)}>
                    <Icon name="plus" size={16} />
                  </button>
                </div>
                <button type="button" className="link-btn small" onClick={() => setQty(l.variantId, 0)}>
                  Remove
                </button>
              </div>
            </div>
            <div className="stack stack--sm" style={{ alignItems: 'flex-end' }}>
              <span className="price">{formatINR(l.lineTotalPaise)}</span>
              {l.qty > 1 ? <span className="small muted">{formatINR(l.unitPaise)} each</span> : null}
            </div>
          </div>
        ))}
      </section>

      <aside className="summary glass" aria-label="Order summary">
        <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>Summary</h2>
        <dl className="totals">
          <dt>Subtotal</dt>
          <dd>{formatINR(cart.subtotalPaise)}</dd>
          <dt>Shipping</dt>
          <dd>{shipping === 0 ? 'Free' : formatINR(shipping)}</dd>
          <dt className="grand">Total</dt>
          <dd className="grand">{formatINR(total)}</dd>
        </dl>
        {freeAbovePaise !== null && shipping > 0 ? <p className="small muted" style={{ marginTop: '0.75rem' }}>Add {formatINR(freeAbovePaise - cart.subtotalPaise)} more for free shipping.</p> : null}
        {cart.hasIssues ? (
          <p className="notice notice--warn" style={{ marginTop: '1rem' }}>
            Some items need attention before you can check out. Remove them or change the quantity.
          </p>
        ) : null}
        <Link href="/checkout" className="btn btn--primary btn--block" style={{ marginTop: '1.25rem' }} aria-disabled={cart.hasIssues} onClick={(e) => cart.hasIssues && e.preventDefault()}>
          Checkout
        </Link>
        <p className="small muted" style={{ marginTop: '0.75rem' }}>
          You will confirm your address and pay securely with Razorpay on the next step.
        </p>
      </aside>
    </div>
  );
}
