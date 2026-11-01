'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiRequestError, api, errorMessage } from '@/lib/client';
import { CheckField, Notice, PasswordField, SelectField, SubmitButton, TextAreaField, TextField, useApiForm } from '../forms';
import type { EditableProduct } from '@/lib/admin-data';

const apiUrl = (base: string, path: string) => `/api${base}${path}`;

function fieldMap(err: unknown): Record<string, string> | null {
  return err instanceof ApiRequestError && Object.keys(err.fields).length ? err.fields : null;
}

// ------------------------------------------------------------------ sign in

export function AdminLoginForm({ base }: { base: string }) {
  const router = useRouter();
  const f = useApiForm({ email: '', password: '', code: '' });
  return (
    <form className="stack" noValidate onSubmit={f.submit(apiUrl(base, '/login'), () => { router.push(base); router.refresh(); })}>
      {f.formError ? <Notice tone="error">{f.formError}</Notice> : null}
      <TextField label="Email" name="email" type="email" value={f.values.email} onChange={f.set('email')} error={f.errors.email} required autoComplete="username" maxLength={254} autoFocus />
      <PasswordField label="Password" name="password" value={f.values.password} onChange={f.set('password')} error={f.errors.password} />
      <TextField label="Authenticator code or recovery code" name="code" value={f.values.code} onChange={f.set('code')} error={f.errors.code} required autoComplete="one-time-code" maxLength={20} inputMode="text" />
      <SubmitButton busy={f.busy}>Sign in</SubmitButton>
    </form>
  );
}

export function AdminLogoutButton({ base }: { base: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn--quiet btn--sm"
      onClick={async () => {
        try {
          await api(apiUrl(base, '/logout'), { method: 'POST', body: {} });
        } catch {
          /* already signed out */
        }
        router.push(base);
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}

// ------------------------------------------------------------------ orders

export function OrderActions({ base, id, next, canCancel, canRefund, maxRefundRupees, carrier, trackingNumber, trackingUrl }: {
  base: string; id: string; next: ('processing' | 'shipped' | 'delivered')[]; canCancel: boolean; canRefund: boolean; maxRefundRupees: string;
  carrier: string; trackingNumber: string; trackingUrl: string;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ship, setShip] = useState({ carrier, trackingNumber, trackingUrl });
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');

  async function run(path: string, body: unknown, done: string) {
    setBusy(true);
    setMsg(null);
    setErrors({});
    try {
      await api(apiUrl(base, `/orders/${id}${path}`), { method: 'POST', body });
      setMsg({ tone: 'ok', text: done });
      router.refresh();
    } catch (e) {
      const fm = fieldMap(e);
      if (fm) setErrors(fm);
      setMsg({ tone: 'error', text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {next.includes('processing') ? (
        <div><button type="button" className="btn btn--primary" disabled={busy} onClick={() => run('/status', { to: 'processing' }, 'Marked as being packed.')}>Start packing</button></div>
      ) : null}
      {next.includes('shipped') ? (
        <form className="stack panel inset" onSubmit={(e) => { e.preventDefault(); run('/status', { to: 'shipped', ...ship }, 'Marked as shipped. The customer was emailed.'); }}>
          <h3 style={{ fontSize: '1.125rem' }}>Mark as shipped</h3>
          <TextField label="Courier" name="carrier" value={ship.carrier} onChange={(v) => setShip((s) => ({ ...s, carrier: v }))} error={errors.carrier} required maxLength={60} />
          <TextField label="Tracking number" name="trackingNumber" value={ship.trackingNumber} onChange={(v) => setShip((s) => ({ ...s, trackingNumber: v }))} error={errors.trackingNumber} required maxLength={60} />
          <TextField label="Tracking link (optional)" name="trackingUrl" value={ship.trackingUrl} onChange={(v) => setShip((s) => ({ ...s, trackingUrl: v }))} error={errors.trackingUrl} maxLength={300} hint="Starts with https://" />
          <div><SubmitButton busy={busy} block={false}>Mark as shipped</SubmitButton></div>
        </form>
      ) : null}
      {next.includes('delivered') ? (
        <div><button type="button" className="btn btn--primary" disabled={busy} onClick={() => run('/status', { to: 'delivered' }, 'Marked as delivered.')}>Mark as delivered</button></div>
      ) : null}
      {canCancel || canRefund ? (
        <div className="panel inset stack">
          <TextField label="Reason (required for cancel or refund)" name="reason" value={reason} onChange={setReason} error={errors.reason} maxLength={200} />
          {canRefund ? (
            <TextField label="Refund amount in rupees (leave empty for the full remaining amount)" name="amount" value={amount} onChange={setAmount} error={errors.amount} inputMode="decimal" hint={`Up to ${maxRefundRupees}`} />
          ) : null}
          <div className="row">
            {canRefund ? (
              <button type="button" className="btn btn--danger" disabled={busy} onClick={() => { if (confirm('Send this refund to the customer? It cannot be undone.')) run('/refund', { amount: amount.trim() || null, reason }, 'Refund started with Razorpay.'); }}>Refund</button>
            ) : null}
            {canCancel ? (
              <button type="button" className="btn btn--danger" disabled={busy} onClick={() => { if (confirm('Cancel this order? A paid order is refunded in full.')) run('/cancel', { reason }, 'Order cancelled.'); }}>Cancel order</button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ support

export function TicketStatus({ base, id, status }: { base: string; id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <>
      <label className="sr-only" htmlFor={`t-${id}`}>Ticket status</label>
      <select
        id={`t-${id}`}
        className="select"
        value={status}
        disabled={busy}
        onChange={async (e) => {
          setBusy(true);
          try {
            await api(apiUrl(base, `/tickets/${id}`), { method: 'PATCH', body: { status: e.target.value } });
            router.refresh();
          } catch (err) {
            alert(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <option value="open">Open</option>
        <option value="answered">Answered</option>
        <option value="closed">Closed</option>
      </select>
    </>
  );
}

// ------------------------------------------------------------------ categories

interface Cat { id: string; parent_id: string | null; slug: string; name: string; description: string | null; sort_order: number; active: boolean; products: number }

function CategoryForm({ base, cat, parents, onDone, onCancel }: { base: string; cat: Cat | null; parents: Cat[]; onDone: () => void; onCancel: () => void }) {
  const f = useApiForm({ name: cat?.name ?? '', slug: cat?.slug ?? '', parentId: cat?.parent_id ?? '', description: cat?.description ?? '', sortOrder: String(cat?.sort_order ?? 0), active: cat?.active ?? true });
  return (
    <form
      className="stack"
      noValidate
      onSubmit={f.submit(
        cat ? apiUrl(base, `/categories/${cat.id}`) : apiUrl(base, '/categories'),
        onDone,
        () => ({ parentId: f.values.parentId || null, sortOrder: Number(f.values.sortOrder || 0) }),
        cat ? 'PATCH' : 'POST',
      )}
    >
      {f.formError ? <Notice tone="error">{f.formError}</Notice> : null}
      <div className="form-grid">
        <TextField label="Name" name="name" value={f.values.name} onChange={f.set('name')} error={f.errors.name} required maxLength={60} />
        <TextField label="Page address (optional)" name="slug" value={f.values.slug} onChange={f.set('slug')} error={f.errors.slug} maxLength={80} hint="Lower-case letters, numbers and hyphens. Made from the name when empty." />
        <SelectField label="Inside category" name="parentId" value={f.values.parentId} onChange={f.set('parentId')} error={f.errors.parentId} options={[{ value: '', label: 'Top level' }, ...parents.filter((p) => p.id !== cat?.id).map((p) => ({ value: p.id, label: p.name }))]} />
        <TextField label="Order" name="sortOrder" value={f.values.sortOrder} onChange={f.set('sortOrder')} error={f.errors.sortOrder} inputMode="numeric" maxLength={4} />
        <div className="span-2"><TextField label="Description (optional)" name="description" value={f.values.description} onChange={f.set('description')} error={f.errors.description} maxLength={300} /></div>
      </div>
      <CheckField name="active" checked={f.values.active} onChange={f.set('active')}>Show this category in the store</CheckField>
      <div className="row">
        <SubmitButton busy={f.busy} block={false}>{cat ? 'Save category' : 'Add category'}</SubmitButton>
        <button type="button" className="btn btn--quiet" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export function CategoryManager({ base, categories }: { base: string; categories: Cat[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<string>('none');
  const [error, setError] = useState<string | null>(null);
  const done = () => { setMode('none'); router.refresh(); };
  const byParent = (pid: string | null) => categories.filter((c) => c.parent_id === pid);
  const tops = byParent(null);
  async function remove(c: Cat) {
    if (!confirm(`Delete "${c.name}"? Products in it become uncategorised.`)) return;
    setError(null);
    try {
      await api(apiUrl(base, `/categories/${c.id}`), { method: 'DELETE' });
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  const row = (c: Cat, depth: number): React.ReactNode => (
    <li key={c.id} style={{ marginLeft: `${depth * 1.5}rem` }} className="panel inset stack stack--sm">
      {mode === c.id ? (
        <CategoryForm base={base} cat={c} parents={categories} onDone={done} onCancel={() => setMode('none')} />
      ) : (
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <p>
            <strong>{c.name}</strong> <span className="muted small">/{c.slug} · {c.products} products · order {c.sort_order}</span>{' '}
            {c.active ? null : <span className="tag tag--plain">Hidden</span>}
          </p>
          <span className="row">
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => setMode(c.id)}>Edit</button>
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => remove(c)}>Delete</button>
          </span>
        </div>
      )}
    </li>
  );
  const render = (pid: string | null, depth: number): React.ReactNode[] =>
    byParent(pid).flatMap((c) => [row(c, depth), ...render(c.id, depth + 1)]);
  return (
    <div className="stack">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {tops.length === 0 ? <p className="muted">No categories yet. Add the first one below.</p> : <ul className="stack stack--sm" style={{ listStyle: 'none', padding: 0 }}>{render(null, 0)}</ul>}
      {mode === 'new' ? (
        <div className="panel inset"><CategoryForm base={base} cat={null} parents={categories} onDone={done} onCancel={() => setMode('none')} /></div>
      ) : (
        <div><button type="button" className="btn btn--primary" onClick={() => setMode('new')}>Add a category</button></div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ settings

export type SettingsValues = {
  legalName: string; address: string; gstin: string; supportEmail: string; supportPhone: string; grievanceName: string; grievanceEmail: string; grievancePhone: string;
  flat: string; freeAbove: string; dispatchDays: string; deliveryMinDays: string; deliveryMaxDays: string;
  returnWindowDays: string; cancelBeforeDispatch: boolean; refundDays: string; requireVerifiedPhone: boolean; maxOrder: string;
};

export function SettingsForm({ base, initial }: { base: string; initial: SettingsValues }) {
  const router = useRouter();
  const f = useApiForm(initial);
  const [saved, setSaved] = useState(false);
  const n = (s: string) => (s.trim() === '' ? 0 : Number(s));
  const t = <K extends keyof SettingsValues>(k: K) => (v: string) => { setSaved(false); (f.set(k) as (v: string) => void)(v); };
  const body = () => {
    const v = f.values;
    return {
      business: { legalName: v.legalName, address: v.address, gstin: v.gstin.toUpperCase(), supportEmail: v.supportEmail, supportPhone: v.supportPhone, grievanceName: v.grievanceName, grievanceEmail: v.grievanceEmail, grievancePhone: v.grievancePhone },
      shipping: { flatPaise: v.flat, freeAbovePaise: v.freeAbove.trim() === '' ? null : v.freeAbove, dispatchDays: n(v.dispatchDays), deliveryMinDays: n(v.deliveryMinDays), deliveryMaxDays: n(v.deliveryMaxDays) },
      policies: { returnWindowDays: n(v.returnWindowDays), cancelBeforeDispatch: v.cancelBeforeDispatch, refundDays: n(v.refundDays) },
      checkout: { requireVerifiedPhone: v.requireVerifiedPhone, maxOrderPaise: v.maxOrder },
    };
  };
  return (
    <form
      className="stack stack--lg"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        f.setBusy(true);
        f.setFormError(null);
        f.setErrors({});
        try {
          await api(apiUrl(base, '/settings'), { method: 'PATCH', body: body() });
          setSaved(true);
          router.refresh();
        } catch (err) {
          const fm = fieldMap(err);
          if (fm) f.setErrors(Object.fromEntries(Object.entries(fm).map(([k, m]) => [k.split('.').pop() as string, m])));
          f.setFormError(errorMessage(err));
        } finally {
          f.setBusy(false);
        }
      }}
    >
      {f.formError ? <Notice tone="error">{f.formError}</Notice> : null}
      {saved ? <Notice tone="ok">Settings saved. Policy pages and the Help Center now use these values.</Notice> : null}
      <fieldset className="stack panel glass"><legend className="h3">Business details (shown on policy pages)</legend>
        <div className="form-grid">
          <TextField label="Legal business name" name="legalName" value={f.values.legalName} onChange={t('legalName')} error={f.errors.legalName} maxLength={200} />
          <TextField label="GSTIN (optional)" name="gstin" value={f.values.gstin} onChange={t('gstin')} error={f.errors.gstin} maxLength={15} />
          <div className="span-2"><TextField label="Registered address" name="address" value={f.values.address} onChange={t('address')} error={f.errors.address} maxLength={300} /></div>
          <TextField label="Support email" name="supportEmail" type="email" value={f.values.supportEmail} onChange={t('supportEmail')} error={f.errors.supportEmail} maxLength={254} />
          <TextField label="Support phone" name="supportPhone" type="tel" value={f.values.supportPhone} onChange={t('supportPhone')} error={f.errors.supportPhone} maxLength={20} />
          <TextField label="Grievance officer name" name="grievanceName" value={f.values.grievanceName} onChange={t('grievanceName')} error={f.errors.grievanceName} maxLength={80} />
          <TextField label="Grievance officer email" name="grievanceEmail" type="email" value={f.values.grievanceEmail} onChange={t('grievanceEmail')} error={f.errors.grievanceEmail} maxLength={254} />
          <TextField label="Grievance officer phone" name="grievancePhone" type="tel" value={f.values.grievancePhone} onChange={t('grievancePhone')} error={f.errors.grievancePhone} maxLength={20} />
        </div>
      </fieldset>
      <fieldset className="stack panel glass"><legend className="h3">Shipping</legend>
        <div className="form-grid">
          <TextField label="Shipping fee (rupees)" name="flat" value={f.values.flat} onChange={t('flat')} error={f.errors.flatPaise} inputMode="decimal" />
          <TextField label="Free shipping from (rupees, empty for never)" name="freeAbove" value={f.values.freeAbove} onChange={t('freeAbove')} error={f.errors.freeAbovePaise} inputMode="decimal" />
          <TextField label="Days to hand over to courier" name="dispatchDays" value={f.values.dispatchDays} onChange={t('dispatchDays')} error={f.errors.dispatchDays} inputMode="numeric" />
          <TextField label="Fastest delivery (days)" name="deliveryMinDays" value={f.values.deliveryMinDays} onChange={t('deliveryMinDays')} error={f.errors.deliveryMinDays} inputMode="numeric" />
          <TextField label="Slowest delivery (days)" name="deliveryMaxDays" value={f.values.deliveryMaxDays} onChange={t('deliveryMaxDays')} error={f.errors.deliveryMaxDays} inputMode="numeric" />
        </div>
      </fieldset>
      <fieldset className="stack panel glass"><legend className="h3">Returns, refunds and checkout</legend>
        <div className="form-grid">
          <TextField label="Return window (days after delivery)" name="returnWindowDays" value={f.values.returnWindowDays} onChange={t('returnWindowDays')} error={f.errors.returnWindowDays} inputMode="numeric" />
          <TextField label="Refund time (business days)" name="refundDays" value={f.values.refundDays} onChange={t('refundDays')} error={f.errors.refundDays} inputMode="numeric" />
          <TextField label="Largest online order (rupees)" name="maxOrder" value={f.values.maxOrder} onChange={t('maxOrder')} error={f.errors.maxOrderPaise} inputMode="decimal" />
        </div>
        <CheckField name="cancelBeforeDispatch" checked={f.values.cancelBeforeDispatch} onChange={(v) => { setSaved(false); f.set('cancelBeforeDispatch')(v); }}>Customers can cancel until the order ships</CheckField>
        <CheckField name="requireVerifiedPhone" checked={f.values.requireVerifiedPhone} onChange={(v) => { setSaved(false); f.set('requireVerifiedPhone')(v); }}>Require a verified mobile number at checkout (needs the SMS provider)</CheckField>
      </fieldset>
      <div><SubmitButton busy={f.busy} block={false}>Save settings</SubmitButton></div>
    </form>
  );
}

// ------------------------------------------------------------------ security

export function AdminSecurity({ base, otherSessions }: { base: string; otherSessions: number }) {
  const router = useRouter();
  const f = useApiForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="stack stack--lg">
      <form className="stack panel glass" noValidate onSubmit={f.submit(apiUrl(base, '/password'), () => { f.setValues({ currentPassword: '', newPassword: '', confirmPassword: '' }); setDone(true); })}>
        <h2 style={{ fontSize: '1.5rem' }}>Change password</h2>
        {f.formError ? <Notice tone="error">{f.formError}</Notice> : null}
        {done ? <Notice tone="ok">Password changed.</Notice> : null}
        <PasswordField label="Current password" name="currentPassword" value={f.values.currentPassword} onChange={f.set('currentPassword')} error={f.errors.currentPassword} />
        <PasswordField label="New password" name="newPassword" value={f.values.newPassword} onChange={f.set('newPassword')} error={f.errors.newPassword} autoComplete="new-password" hint="At least 12 characters." />
        <PasswordField label="Confirm new password" name="confirmPassword" value={f.values.confirmPassword} onChange={f.set('confirmPassword')} error={f.errors.confirmPassword} autoComplete="new-password" />
        <div><SubmitButton busy={f.busy} block={false}>Change password</SubmitButton></div>
      </form>
      <div className="panel glass stack">
        <h2 style={{ fontSize: '1.5rem' }}>Other sessions</h2>
        {msg ? <Notice tone="ok">{msg}</Notice> : null}
        <p>{otherSessions === 0 ? 'No other devices are signed in.' : `${otherSessions} other ${otherSessions === 1 ? 'device is' : 'devices are'} signed in.`}</p>
        {otherSessions > 0 ? (
          <div>
            <button type="button" className="btn btn--quiet" onClick={async () => { try { await api(apiUrl(base, '/sessions'), { method: 'DELETE' }); setMsg('Other devices were signed out.'); router.refresh(); } catch (e) { setMsg(null); alert(errorMessage(e)); } }}>Sign out other devices</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ products

type Draft = EditableProduct;
interface Cat2 { id: string; name: string; parent: string | null }

export function ProductEditor({ base, initial, categories }: { base: string; initial: Draft; categories: Cat2[] }) {
  const router = useRouter();
  const [p, setP] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setOk(null); setP((x) => ({ ...x, [k]: v })); };
  const setVariant = (i: number, patch: Partial<Draft['variants'][number]>) => { setOk(null); setP((x) => ({ ...x, variants: x.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) })); };

  const catOptions = [{ value: '', label: 'No category' }, ...categories.map((c) => ({ value: c.id, label: c.parent ? `${c.parent} / ${c.name}` : c.name }))];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    setOk(null);
    const body = {
      name: p.name, slug: p.slug, shortDesc: p.shortDesc, description: p.description, fabric: p.fabric, fit: p.fit, care: p.care, origin: p.origin,
      details: p.details.filter((d) => d.label.trim() || d.value.trim()),
      price: p.price, comparePrice: p.comparePrice.trim() ? p.comparePrice : null, categoryId: p.categoryId || null, status: p.status,
      tags: p.tags.split(',').map((t) => t.trim()).filter(Boolean), seoTitle: p.seoTitle, seoDescription: p.seoDescription,
      variants: p.variants.map((v) => ({ id: v.id, sku: v.sku, size: v.size, color: v.color, colorHex: v.colorHex.trim() || null, price: v.price.trim() ? v.price : null, stock: v.stock.trim() === '' ? 0 : v.stock, active: v.active })),
    };
    try {
      if (p.id) {
        await api(apiUrl(base, `/products/${p.id}`), { method: 'PATCH', body });
        setOk('Product saved.');
        router.refresh();
      } else {
        const r = await api<{ id: string }>(apiUrl(base, '/products'), { method: 'POST', body });
        router.push(`${base}/products/${r.id}`);
      }
    } catch (err) {
      const fm = fieldMap(err);
      if (fm) setErrors(fm);
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const E = (k: string) => errors[k];
  return (
    <form className="stack stack--lg" noValidate onSubmit={save}>
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      {ok ? <Notice tone="ok">{ok}</Notice> : null}

      <fieldset className="stack panel glass"><legend className="h3">Basics</legend>
        <TextField label="Name" name="name" value={p.name} onChange={(v) => set('name', v)} error={E('name')} required maxLength={120} />
        <div className="form-grid">
          <TextField label="Price (rupees)" name="price" value={p.price} onChange={(v) => set('price', v)} error={E('price')} required inputMode="decimal" hint="Including tax." />
          <TextField label="Compare at price (optional)" name="comparePrice" value={p.comparePrice} onChange={(v) => set('comparePrice', v)} error={E('comparePrice')} inputMode="decimal" hint="The old price, shown struck through. Must be higher than the price." />
          <SelectField label="Category" name="categoryId" value={p.categoryId} onChange={(v) => set('categoryId', v)} error={E('categoryId')} options={catOptions} />
          <SelectField label="Status" name="status" value={p.status} onChange={(v) => set('status', v as Draft['status'])} error={E('status')} required options={[{ value: 'draft', label: 'Draft (hidden)' }, { value: 'active', label: 'Active (for sale)' }, { value: 'archived', label: 'Archived' }]} />
        </div>
        <TextField label="Short description (optional)" name="shortDesc" value={p.shortDesc} onChange={(v) => set('shortDesc', v)} error={E('shortDesc')} maxLength={200} />
        <TextAreaField label="Description" name="description" value={p.description} onChange={(v) => set('description', v)} error={E('description')} maxLength={5000} rows={7} hint="Required to publish. Describe the item honestly: cut, feel, how it is worn." />
      </fieldset>

      <fieldset className="stack panel glass"><legend className="h3">More information</legend>
        <div className="form-grid">
          <TextField label="Fabric" name="fabric" value={p.fabric} onChange={(v) => set('fabric', v)} error={E('fabric')} maxLength={120} />
          <TextField label="Fit" name="fit" value={p.fit} onChange={(v) => set('fit', v)} error={E('fit')} maxLength={120} />
          <TextField label="Made in" name="origin" value={p.origin} onChange={(v) => set('origin', v)} error={E('origin')} maxLength={80} />
          <TextField label="Tags (comma separated)" name="tags" value={p.tags} onChange={(v) => set('tags', v)} error={E('tags')} maxLength={300} />
        </div>
        <TextAreaField label="Care instructions" name="care" value={p.care} onChange={(v) => set('care', v)} error={E('care')} maxLength={300} rows={3} />
        <div className="stack stack--sm">
          <p><strong>Extra details</strong> <span className="muted small">for example Neckline, Sleeve, Pattern</span></p>
          {p.details.map((d, i) => (
            <div key={i} className="form-grid">
              <TextField label={`Detail ${i + 1} name`} name={`dl${i}`} value={d.label} onChange={(v) => set('details', p.details.map((x, j) => (j === i ? { ...x, label: v } : x)))} error={E(`details.${i}.label`)} maxLength={40} />
              <TextField label={`Detail ${i + 1} value`} name={`dv${i}`} value={d.value} onChange={(v) => set('details', p.details.map((x, j) => (j === i ? { ...x, value: v } : x)))} error={E(`details.${i}.value`)} maxLength={200} />
              <div><button type="button" className="btn btn--quiet btn--sm" onClick={() => set('details', p.details.filter((_, j) => j !== i))}>Remove detail</button></div>
            </div>
          ))}
          {p.details.length < 12 ? <div><button type="button" className="btn btn--quiet btn--sm" onClick={() => set('details', [...p.details, { label: '', value: '' }])}>Add a detail</button></div> : null}
        </div>
      </fieldset>

      <fieldset className="stack panel glass"><legend className="h3">Sizes, colours and stock</legend>
        {E('variants') ? <Notice tone="error">{E('variants')}</Notice> : null}
        {p.variants.map((v, i) => (
          <div key={i} className="panel inset stack stack--sm">
            <div className="form-grid">
              <TextField label="SKU" name={`sku${i}`} value={v.sku} onChange={(x) => setVariant(i, { sku: x })} error={E(`variants.${i}.sku`)} required maxLength={40} />
              <TextField label="Size" name={`size${i}`} value={v.size} onChange={(x) => setVariant(i, { size: x })} error={E(`variants.${i}.size`)} required maxLength={20} />
              <TextField label="Colour name (optional)" name={`color${i}`} value={v.color} onChange={(x) => setVariant(i, { color: x })} error={E(`variants.${i}.color`)} maxLength={40} />
              <TextField label="Colour code (optional)" name={`hex${i}`} value={v.colorHex} onChange={(x) => setVariant(i, { colorHex: x })} error={E(`variants.${i}.colorHex`)} maxLength={7} hint="Like #247BA0" />
              <TextField label="Stock" name={`stock${i}`} value={v.stock} onChange={(x) => setVariant(i, { stock: x })} error={E(`variants.${i}.stock`)} inputMode="numeric" maxLength={6} />
              <TextField label="Own price (optional)" name={`vprice${i}`} value={v.price} onChange={(x) => setVariant(i, { price: x })} error={E(`variants.${i}.price`)} inputMode="decimal" hint="Leave empty to use the product price." />
            </div>
            <CheckField name={`active${i}`} checked={v.active} onChange={(x) => setVariant(i, { active: x })}>On sale</CheckField>
            {p.variants.length > 1 ? <div><button type="button" className="btn btn--quiet btn--sm" onClick={() => set('variants', p.variants.filter((_, j) => j !== i))}>Remove this size</button></div> : null}
          </div>
        ))}
        {p.variants.length < 60 ? (
          <div><button type="button" className="btn btn--quiet" onClick={() => set('variants', [...p.variants, { id: null, sku: '', size: '', color: p.variants.at(-1)?.color ?? '', colorHex: p.variants.at(-1)?.colorHex ?? '', price: '', stock: '0', active: true }])}>Add a size or colour</button></div>
        ) : null}
        <p className="small muted">Removing a size that already appears in an order keeps the order history and takes the size off sale.</p>
      </fieldset>

      <fieldset className="stack panel glass"><legend className="h3">Search listing</legend>
        <TextField label="Search title (optional)" name="seoTitle" value={p.seoTitle} onChange={(v) => set('seoTitle', v)} error={E('seoTitle')} maxLength={70} />
        <TextField label="Search description (optional)" name="seoDescription" value={p.seoDescription} onChange={(v) => set('seoDescription', v)} error={E('seoDescription')} maxLength={160} />
        <TextField label="Page address (optional)" name="slug" value={p.slug} onChange={(v) => set('slug', v)} error={E('slug')} maxLength={80} hint="Lower-case letters, numbers and hyphens. Made from the name when empty." />
      </fieldset>

      <div className="row">
        <SubmitButton busy={busy} block={false}>{p.id ? 'Save product' : 'Create product'}</SubmitButton>
        {!p.id ? <span className="muted small">You can add photos right after creating it.</span> : null}
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ product images

interface Img { id: string; url: string; alt: string; color: string }

export function ProductImages({ base, productId, images, colors }: { base: string; productId: string; images: Img[]; colors: string[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [alt, setAlt] = useState<Record<string, string>>(Object.fromEntries(images.map((i) => [i.id, i.alt])));
  const [color, setColor] = useState<Record<string, string>>(Object.fromEntries(images.map((i) => [i.id, i.color])));

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setMsg(null);
    let done = 0;
    const failed: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData();
        fd.set('file', file);
        const res = await fetch(apiUrl(base, `/products/${productId}/images`), { method: 'POST', body: fd, credentials: 'same-origin' });
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          failed.push(`${file.name}: ${j?.error?.message ?? 'upload failed'}`);
        } else done++;
      } catch {
        failed.push(`${file.name}: network error`);
      }
    }
    setBusy(false);
    setMsg({ tone: failed.length ? 'error' : 'ok', text: `${done} uploaded.${failed.length ? ` ${failed.join(' ')}` : ''}` });
    router.refresh();
  }
  async function move(i: number, d: -1 | 1) {
    const order = images.map((x) => x.id);
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j]!, order[i]!];
    try { await api(apiUrl(base, `/products/${productId}/images`), { method: 'PATCH', body: { order } }); router.refresh(); } catch (e) { setMsg({ tone: 'error', text: errorMessage(e) }); }
  }
  async function saveMeta(id: string) {
    try { await api(apiUrl(base, `/products/${productId}/images/${id}`), { method: 'PATCH', body: { alt: alt[id] ?? '', color: color[id] ?? '' } }); setMsg({ tone: 'ok', text: 'Photo details saved.' }); } catch (e) { setMsg({ tone: 'error', text: errorMessage(e) }); }
  }
  async function remove(id: string) {
    if (!confirm('Delete this photo?')) return;
    try { await api(apiUrl(base, `/products/${productId}/images/${id}`), { method: 'DELETE' }); router.refresh(); } catch (e) { setMsg({ tone: 'error', text: errorMessage(e) }); }
  }
  return (
    <section className="panel glass stack" aria-labelledby="img-h">
      <h2 id="img-h" style={{ fontSize: '1.5rem' }}>Photos</h2>
      <p className="small muted">JPEG, PNG or WebP, at least 400 pixels on the short side and 4 MB or less each. Up to 10. The first photo is the cover. Photos are re-encoded and location data is removed.</p>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <ul className="stack" style={{ listStyle: 'none', padding: 0 }}>
        {images.map((im, i) => (
          <li key={im.id} className="panel inset" style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: '1rem' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={im.url} alt={im.alt} width={96} height={120} style={{ width: 96, height: 120, objectFit: 'cover' }} />
            <div className="stack stack--sm">
              <TextField label={i === 0 ? 'Description (cover photo)' : 'Description'} name={`alt-${im.id}`} value={alt[im.id] ?? ''} onChange={(v) => setAlt((a) => ({ ...a, [im.id]: v }))} maxLength={140} />
              {colors.length ? (
                <SelectField label="Shown for colour" name={`col-${im.id}`} value={color[im.id] ?? ''} onChange={(v) => setColor((a) => ({ ...a, [im.id]: v }))} options={[{ value: '', label: 'Every colour' }, ...colors.map((c) => ({ value: c, label: c }))]} />
              ) : null}
              <div className="row">
                <button type="button" className="btn btn--quiet btn--sm" onClick={() => saveMeta(im.id)}>Save details</button>
                <button type="button" className="btn btn--quiet btn--sm" onClick={() => move(i, -1)} disabled={i === 0}>Move earlier</button>
                <button type="button" className="btn btn--quiet btn--sm" onClick={() => move(i, 1)} disabled={i === images.length - 1}>Move later</button>
                <button type="button" className="btn btn--quiet btn--sm" onClick={() => remove(im.id)}>Delete</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {images.length < 10 ? (
        <div className="field">
          <label htmlFor="img-up">Add photos</label>
          <input id="img-up" className="input" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={(e) => { void upload(e.target.files); e.target.value = ''; }} />
          {busy ? <p className="small muted" aria-live="polite">Uploading</p> : null}
        </div>
      ) : null}
    </section>
  );
}
