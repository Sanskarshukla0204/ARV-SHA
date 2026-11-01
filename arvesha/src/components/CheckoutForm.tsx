'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { SavedAddress } from '@/lib/address';
import { ApiRequestError, api, errorMessage } from '@/lib/client';
import { formatINR } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import { useCart } from './CartProvider';
import { CheckField, Notice, SelectField, TextAreaField, TextField } from './forms';
import { PhoneVerify } from './PhoneVerify';

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (ev: string, cb: (r: any) => void) => void };
  }
}

interface Props {
  user: { name: string; email: string | null; phone: string | null; phoneVerified: boolean };
  addresses: SavedAddress[];
  states: readonly string[];
  flatPaise: number;
  freeAbovePaise: number | null;
  requireVerifiedPhone: boolean;
  paymentsReady: boolean;
}

interface StartResult {
  orderNumber: string;
  razorpayOrderId: string;
  keyId: string;
  amountPaise: number;
  prefill: { name: string; email: string; contact: string };
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Razorpay failed to load'));
    document.head.appendChild(s);
  });
}

const EMPTY = { name: '', phone: '', line1: '', line2: '', landmark: '', city: '', state: '', pincode: '' };

export function CheckoutForm({ user, addresses, states, flatPaise, freeAbovePaise, requireVerifiedPhone, paymentsReady }: Props) {
  const router = useRouter();
  const { cart, refresh } = useCart();
  const [choice, setChoice] = useState<string>(addresses[0]?.id ?? 'new');
  const [f, setF] = useState({ ...EMPTY, name: user.name === 'Customer' ? '' : user.name, phone: user.phone ?? '' });
  const [saveIt, setSaveIt] = useState(addresses.length === 0);
  const [email, setEmail] = useState(user.email ?? '');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pinHint, setPinHint] = useState<string | null>(null);

  const shipping = cart.subtotalPaise === 0 ? 0 : freeAbovePaise !== null && cart.subtotalPaise >= freeAbovePaise ? 0 : flatPaise;
  const total = cart.subtotalPaise + shipping;
  const saved = useMemo(() => addresses.find((a) => a.id === choice) ?? null, [addresses, choice]);
  const needsPhone = requireVerifiedPhone && !user.phoneVerified;

  const set = (k: keyof typeof EMPTY) => (v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    setErrors((e) => {
      const { [k]: _d, ...rest } = e;
      return rest;
    });
  };

  // Fill city and state from the PIN code as soon as six digits are typed.
  useEffect(() => {
    if (choice !== 'new' || !/^[1-9]\d{5}$/.test(f.pincode)) {
      setPinHint(null);
      return;
    }
    let live = true;
    api<{ found: boolean | 'unknown'; state: string | null; district: string | null }>(`/api/pincode/${f.pincode}`)
      .then((r) => {
        if (!live) return;
        if (r.found === false) setPinHint('This PIN code was not found. Check it before continuing.');
        else if (r.found === true) {
          setPinHint(null);
          setF((x) => ({ ...x, state: states.includes(r.state ?? '') ? (r.state as string) : x.state, city: x.city || r.district || '' }));
        } else setPinHint(null);
      })
      .catch(() => live && setPinHint(null));
    return () => {
      live = false;
    };
  }, [f.pincode, choice, states]);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrors({});
    setFormError(null);
    const address = saved
      ? { name: saved.name, phone: saved.phone, line1: saved.line1, line2: saved.line2 ?? '', landmark: saved.landmark ?? '', city: saved.city, state: saved.state, pincode: saved.pincode }
      : f;
    try {
      const start = await api<StartResult & { ok: true }>('/api/checkout', {
        method: 'POST',
        body: { address, saveAddress: !saved && saveIt, contactEmail: email || null, note },
      });
      await openRazorpay(start);
    } catch (err) {
      if (err instanceof ApiRequestError && Object.keys(err.fields).length) {
        const mapped: Record<string, string> = {};
        for (const [k, msg] of Object.entries(err.fields)) mapped[k.replace(/^address\./, '')] = msg;
        setErrors(mapped);
        setFormError(mapped[''] ?? 'Check the highlighted fields.');
      } else {
        setFormError(errorMessage(err));
        if (err instanceof ApiRequestError && (err.code === 'cart_changed' || err.code === 'out_of_stock' || err.code === 'cart_empty')) void refresh();
      }
      setBusy(false);
    }
  }

  async function openRazorpay(start: StartResult) {
    try {
      await loadRazorpay();
    } catch {
      setFormError('The payment window could not load. Check your connection and try again. Your bag is saved.');
      setBusy(false);
      return;
    }
    const rzp = new window.Razorpay!({
      key: start.keyId,
      amount: start.amountPaise,
      currency: 'INR',
      name: 'Arvésha Clothing',
      description: `Order ${start.orderNumber}`,
      order_id: start.razorpayOrderId,
      prefill: start.prefill,
      theme: { color: '#247BA0' },
      modal: {
        confirm_close: true,
        ondismiss: () => {
          setBusy(false);
          setFormError('The payment was not completed. Your bag is saved and nothing was charged. You can try again.');
        },
      },
      handler: async (res: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        try {
          const r = await api<{ status: 'paid' | 'pending'; orderNumber: string }>('/api/checkout/verify', {
            method: 'POST',
            body: { razorpayOrderId: res.razorpay_order_id, razorpayPaymentId: res.razorpay_payment_id, signature: res.razorpay_signature },
          });
          router.push(`/payment/${r.status === 'paid' ? 'success' : 'pending'}?order=${encodeURIComponent(r.orderNumber)}`);
        } catch {
          // The payment may still have gone through. The pending page asks Razorpay directly.
          router.push(`/payment/pending?order=${encodeURIComponent(start.orderNumber)}`);
        }
      },
    });
    rzp.on('payment.failed', () => {
      router.push(`/payment/failed?order=${encodeURIComponent(start.orderNumber)}`);
    });
    rzp.open();
  }

  if (!paymentsReady) {
    return <Notice tone="warn">Online payment is not switched on yet, so orders cannot be placed. Please check back soon.</Notice>;
  }

  return (
    <form className="split" onSubmit={pay} noValidate>
      <div className="stack stack--lg">
        <ol className="steps" aria-label="Checkout steps">
          <li aria-current="step">Delivery</li>
          <li>Payment</li>
        </ol>

        <section className="stack" aria-labelledby="addr-h">
          <h2 id="addr-h" style={{ fontSize: '1.75rem' }}>
            Delivery address
          </h2>
          {addresses.length > 0 ? (
            <div className="addr-choice" role="radiogroup" aria-label="Saved addresses">
              {addresses.map((a) => (
                <label key={a.id}>
                  <input type="radio" name="addr" checked={choice === a.id} onChange={() => setChoice(a.id)} />
                  <span>
                    <strong>{a.name}</strong>, {formatPhone(a.phone)}
                    <br />
                    <span className="small">
                      {[a.line1, a.line2, a.landmark, a.city, a.state].filter(Boolean).join(', ')} {a.pincode}
                    </span>
                  </span>
                </label>
              ))}
              <label>
                <input type="radio" name="addr" checked={choice === 'new'} onChange={() => setChoice('new')} />
                <span>Use a new address</span>
              </label>
            </div>
          ) : null}

          {choice === 'new' ? (
            <div className="form-grid">
              <div className="span-2">
                <TextField label="Full name" name="name" value={f.name} onChange={set('name')} error={errors.name} required autoComplete="name" maxLength={80} />
              </div>
              <TextField label="Mobile number" name="phone" value={f.phone} onChange={set('phone')} error={errors.phone} required type="tel" autoComplete="tel-national" inputMode="tel" maxLength={16} hint="The courier will call this number." />
              <TextField label="PIN code" name="pincode" value={f.pincode} onChange={set('pincode')} error={errors.pincode ?? (pinHint ?? undefined)} required inputMode="numeric" autoComplete="postal-code" maxLength={6} />
              <div className="span-2">
                <TextField label="Address line 1" name="line1" value={f.line1} onChange={set('line1')} error={errors.line1} required autoComplete="address-line1" maxLength={120} hint="House number, building and street." />
              </div>
              <div className="span-2">
                <TextField label="Address line 2" name="line2" value={f.line2} onChange={set('line2')} error={errors.line2} autoComplete="address-line2" maxLength={120} />
              </div>
              <TextField label="Landmark" name="landmark" value={f.landmark} onChange={set('landmark')} error={errors.landmark} maxLength={80} />
              <TextField label="City" name="city" value={f.city} onChange={set('city')} error={errors.city} required autoComplete="address-level2" maxLength={60} />
              <div className="span-2">
                <SelectField label="State" name="state" value={f.state} onChange={set('state')} error={errors.state} required options={states} placeholder="Choose a state" autoComplete="address-level1" />
              </div>
              <div className="span-2">
                <CheckField name="saveAddress" checked={saveIt} onChange={setSaveIt}>
                  Save this address for next time
                </CheckField>
              </div>
            </div>
          ) : null}
        </section>

        <section className="stack" aria-labelledby="contact-h">
          <h2 id="contact-h" style={{ fontSize: '1.75rem' }}>
            Contact
          </h2>
          {user.email ? (
            <p>
              Order updates go to <strong>{user.email}</strong>.
            </p>
          ) : (
            <TextField label="Email" name="email" type="email" value={email} onChange={setEmail} error={errors.contactEmail} required autoComplete="email" hint="We send your order confirmation and tracking here." />
          )}
          <TextAreaField label="Note for the courier or for us" name="note" value={note} onChange={setNote} error={errors.note} maxLength={300} rows={3} />
        </section>

        {needsPhone ? (
          <section className="stack" aria-labelledby="verify-h">
            <h2 id="verify-h" style={{ fontSize: '1.75rem' }}>
              Verify your mobile number
            </h2>
            {user.phone ? <PhoneVerify phone={user.phone} /> : <Notice tone="warn">Add a mobile number in your <Link href="/account">account</Link> first.</Notice>}
          </section>
        ) : null}
      </div>

      <aside className="summary glass" aria-label="Order summary">
        <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>Order summary</h2>
        {cart.lines.map((l) => (
          <div className="row row--between" key={l.variantId} style={{ flexWrap: 'nowrap', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
            <span className="small">
              {l.name} <span className="muted">({[l.size, l.color].filter(Boolean).join(', ')}) x {l.qty}</span>
              {l.issue ? <span style={{ color: 'var(--danger)' }}> {l.issue}</span> : null}
            </span>
            <span className="small num nowrap">{formatINR(l.lineTotalPaise)}</span>
          </div>
        ))}
        <hr className="hr" style={{ margin: '1rem 0' }} />
        <dl className="totals">
          <dt>Subtotal</dt>
          <dd>{formatINR(cart.subtotalPaise)}</dd>
          <dt>Shipping</dt>
          <dd>{shipping === 0 ? 'Free' : formatINR(shipping)}</dd>
          <dt className="grand">Total</dt>
          <dd className="grand">{formatINR(total)}</dd>
        </dl>
        {formError ? (
          <p className="notice notice--error" role="alert" style={{ marginTop: '1rem' }}>
            {formError}
          </p>
        ) : null}
        <button type="submit" className="btn btn--primary btn--block" style={{ marginTop: '1.25rem' }} aria-busy={busy} disabled={busy || cart.hasIssues || cart.lines.length === 0 || needsPhone}>
          Pay {formatINR(total)}
        </button>
        <p className="small muted" style={{ marginTop: '0.75rem' }}>
          By paying you agree to the <Link href="/legal/terms-of-service">Terms of Service</Link> and the <Link href="/legal/refund-policy">Refund Policy</Link>. Payment is handled by Razorpay.
        </p>
      </aside>
    </form>
  );
}
