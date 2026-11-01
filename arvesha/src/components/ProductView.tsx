'use client';

import { useMemo, useState, type ReactNode } from 'react';
import type { ImageRef, VariantRef } from '@/lib/catalog';
import { formatINR, percentOff } from '@/lib/format';
import { useCart } from './CartProvider';

interface Props {
  name: string;
  shortDesc: string | null;
  pricePaise: number;
  comparePaise: number | null;
  images: ImageRef[];
  variants: VariantRef[];
  children?: ReactNode;
}

const LOW_STOCK = 5;

export function ProductView({ name, shortDesc, pricePaise, comparePaise, images, variants, children }: Props) {
  const { add } = useCart();
  const colors = useMemo(() => [...new Map(variants.filter((v) => v.color).map((v) => [v.color, v.colorHex])).entries()].map(([n, hex]) => ({ name: n, hex })), [variants]);
  const sizeOrder = useMemo(() => [...new Set(variants.map((v) => v.size))], [variants]);

  const firstAvailable = variants.find((v) => v.stock > 0);
  const [color, setColor] = useState<string>(colors.length ? (firstAvailable?.color ?? colors[0]!.name) : '');
  const [size, setSize] = useState<string>('');
  const [img, setImg] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const variant = variants.find((v) => v.size === size && v.color === color) ?? null;
  const price = variant?.pricePaise ?? pricePaise;
  const off = percentOff(price, comparePaise);

  function pickColor(c: string) {
    setColor(c);
    const current = variants.find((v) => v.size === size && v.color === c);
    if (!current || current.stock <= 0) setSize('');
    const at = images.findIndex((i) => i.color && i.color.toLowerCase() === c.toLowerCase());
    if (at >= 0) setImg(at);
    setError(null);
    setAdded(false);
  }

  async function addToBag() {
    if (!variant) {
      setError(sizeOrder.length > 1 || sizeOrder[0] ? 'Choose a size first.' : 'Choose an option first.');
      return;
    }
    setBusy(true);
    setError(null);
    const msg = await add(variant.id, 1);
    setBusy(false);
    if (msg) setError(msg);
    else setAdded(true);
  }

  const current = images[img] ?? null;

  return (
    <div className="pdp">
      <div className="gallery">
        {images.length > 1 ? (
          <div className="thumbs" role="group" aria-label="Product photos">
            {images.map((im, i) => (
              <button key={im.md + i} type="button" aria-current={i === img} aria-label={`Show photo ${i + 1} of ${images.length}`} onClick={() => setImg(i)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.sm} alt="" width={76} height={95} loading="lazy" />
              </button>
            ))}
          </div>
        ) : null}
        <div className="stage">
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.lg ?? current.md} alt={current.alt || name} width={current.width} height={current.height} fetchPriority="high" />
          ) : (
            <span className="card__none" aria-hidden="true">
              A
            </span>
          )}
        </div>
      </div>

      <div className="pdp-info glass">
        <div className="stack">
          <h1 style={{ fontSize: 'clamp(2rem, 1.6rem + 1.6vw, 3rem)' }}>{name}</h1>
          {shortDesc ? <p className="muted">{shortDesc}</p> : null}
          <p className="row" style={{ gap: '0.25rem 0.9rem', fontSize: '1.25rem' }}>
            <span className="price">{formatINR(price)}</span>
            {comparePaise && comparePaise > price ? <span className="price price--was">{formatINR(comparePaise)}</span> : null}
            {off ? <span className="tag tag--ok">{off}% off</span> : null}
          </p>
          <p className="small muted">Inclusive of taxes. Shipping is shown at checkout.</p>

          {colors.length > 0 ? (
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="small" style={{ fontWeight: 600, color: 'var(--ink-strong)', marginBottom: '0.5rem' }}>
                Colour: {color}
              </legend>
              <div className="size-grid">
                {colors.map((c) => (
                  <label className="opt" key={c.name}>
                    <input type="radio" name="color" value={c.name} checked={color === c.name} onChange={() => pickColor(c.name)} />
                    <span>
                      {c.hex ? <i className="swatch" style={{ background: c.hex }} aria-hidden="true" /> : null}
                      {c.name}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="small" style={{ fontWeight: 600, color: 'var(--ink-strong)', marginBottom: '0.5rem' }}>
              Size
            </legend>
            <div className="size-grid">
              {sizeOrder.map((s) => {
                const v = variants.find((x) => x.size === s && x.color === color);
                const out = !v || v.stock <= 0;
                return (
                  <label className="opt" key={s}>
                    <input type="radio" name="size" value={s} checked={size === s} disabled={out} onChange={() => { setSize(s); setError(null); setAdded(false); }} />
                    <span>
                      {s}
                      {out ? <span className="sr-only"> (out of stock)</span> : null}
                    </span>
                  </label>
                );
              })}
            </div>
            {variant && variant.stock > 0 && variant.stock <= LOW_STOCK ? (
              <p className="small" style={{ marginTop: '0.5rem', color: 'var(--warn)' }}>
                Only {variant.stock} left in this size.
              </p>
            ) : null}
          </fieldset>

          {error ? (
            <p className="notice notice--error" role="alert">
              {error}
            </p>
          ) : null}
          {added ? (
            <p className="notice notice--ok" role="status">
              Added to your bag.
            </p>
          ) : null}
          <button type="button" className="btn btn--primary btn--block" onClick={addToBag} aria-busy={busy} disabled={busy || variants.every((v) => v.stock <= 0)}>
            {variants.every((v) => v.stock <= 0) ? 'Sold out' : 'Add to bag'}
          </button>
          {children}
        </div>
      </div>
    </div>
  );
}
