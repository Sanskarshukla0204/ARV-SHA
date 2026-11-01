import Link from 'next/link';
import type { ProductCard as Card } from '@/lib/catalog';
import { formatINR, percentOff } from '@/lib/format';

export function ProductCard({ p, priority = false }: { p: Card; priority?: boolean }) {
  const off = percentOff(p.pricePaise, p.comparePaise);
  return (
    <Link href={`/products/${p.slug}`} className="card">
      <div className="card__media">
        {p.image ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image.md} alt={p.image.alt || p.name} width={p.image.width} height={p.image.height} loading={priority ? 'eager' : 'lazy'} decoding="async" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.image2 ? <img src={p.image2.md} alt="" width={p.image2.width} height={p.image2.height} loading="lazy" decoding="async" /> : null}
          </>
        ) : (
          <span className="card__none" aria-hidden="true">
            A
          </span>
        )}
        {!p.inStock ? <span className="card__flag">Sold out</span> : off ? <span className="card__flag">{off}% off</span> : null}
      </div>
      <div>
        <p className="card__name">{p.name}</p>
        <p className="card__meta">
          <span className="price">{formatINR(p.pricePaise)}</span>
          {p.comparePaise && p.comparePaise > p.pricePaise ? <span className="price price--was">{formatINR(p.comparePaise)}</span> : null}
          {p.colors.length > 1 ? (
            <span className="swatches" role="img" aria-label={`${p.colors.length} colours`}>
              {p.colors.slice(0, 5).map((c) => (
                <span key={c.name} className="swatch" style={c.hex ? { background: c.hex } : undefined} />
              ))}
            </span>
          ) : null}
        </p>
      </div>
    </Link>
  );
}
