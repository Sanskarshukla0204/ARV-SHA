import Link from 'next/link';
import { Pagination } from './Pagination';
import { ProductCard } from './ProductCard';
import { FilterShell } from './FilterShell';
import { getFacets, listProducts, type SortKey } from '@/lib/catalog';
import { formatINR } from '@/lib/format';
import { first, many, safe } from '@/lib/safe';

type SP = Record<string, string | string[] | undefined>;

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'new', label: 'Newest' },
  { value: 'price-asc', label: 'Price, low to high' },
  { value: 'price-desc', label: 'Price, high to low' },
  { value: 'name', label: 'Name' },
];

function rupeesToPaise(v: string | undefined): number | undefined {
  if (!v || !/^\d{1,7}$/.test(v)) return undefined;
  return Number(v) * 100;
}

/** Product grid with GET-based filters. Works without JavaScript, and every filtered view has its own URL. */
export async function CatalogView({ basePath, categoryIds, searchParams, emptyText }: { basePath: string; categoryIds?: string[]; searchParams: SP; emptyText?: string }) {
  const q = first(searchParams.q)?.trim().slice(0, 80) || undefined;
  const sizes = many(searchParams.size);
  const colors = many(searchParams.color);
  const min = first(searchParams.min);
  const max = first(searchParams.max);
  const inStock = first(searchParams.instock) === '1';
  const sort = (SORTS.find((s) => s.value === first(searchParams.sort))?.value ?? 'new') as SortKey;
  const page = Math.max(1, Number.parseInt(first(searchParams.page) ?? '1', 10) || 1);

  const [result, facets] = await Promise.all([
    safe(
      listProducts({ categoryIds, q, sizes, colors, minPaise: rupeesToPaise(min), maxPaise: rupeesToPaise(max), inStockOnly: inStock, sort, page, pageSize: 24 }),
      { items: [], total: 0, page: 1, pageSize: 24, pages: 1 },
      'products',
    ),
    safe(getFacets(categoryIds), { sizes: [], colors: [], minPaise: 0, maxPaise: 0 }, 'filters'),
  ]);

  const active = sizes.length + colors.length + (min ? 1 : 0) + (max ? 1 : 0) + (inStock ? 1 : 0);
  const keep: Record<string, string | string[] | undefined> = { q, sort: sort === 'new' ? undefined : sort, size: sizes, color: colors, min, max, instock: inStock ? '1' : undefined };

  return (
    <div className="catalog">
      <form method="get" action={basePath} aria-label="Filter and sort">
        {q ? <input type="hidden" name="q" value={q} /> : null}
        <FilterShell activeCount={active}>
          <fieldset>
            <legend>Sort by</legend>
            <select name="sort" className="select" defaultValue={sort} aria-label="Sort by">
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </fieldset>
          {facets.sizes.length > 0 ? (
            <fieldset>
              <legend>Size</legend>
              <div className="chips">
                {facets.sizes.map((s) => (
                  <label className="chip" key={s}>
                    <input type="checkbox" name="size" value={s} defaultChecked={sizes.includes(s)} />
                    <span>{s}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          {facets.colors.length > 0 ? (
            <fieldset>
              <legend>Colour</legend>
              <div className="chips">
                {facets.colors.map((c) => (
                  <label className="chip" key={c.name}>
                    <input type="checkbox" name="color" value={c.name} defaultChecked={colors.includes(c.name)} />
                    <span>
                      {c.hex ? <i className="swatch" style={{ background: c.hex }} /> : null}
                      {c.name}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <fieldset>
            <legend>Price in rupees</legend>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <label className="sr-only" htmlFor="f-min">
                Lowest price
              </label>
              <input id="f-min" className="input" name="min" inputMode="numeric" pattern="[0-9]*" placeholder={facets.maxPaise ? String(Math.floor(facets.minPaise / 100)) : 'Min'} defaultValue={min} maxLength={7} />
              <label className="sr-only" htmlFor="f-max">
                Highest price
              </label>
              <input id="f-max" className="input" name="max" inputMode="numeric" pattern="[0-9]*" placeholder={facets.maxPaise ? String(Math.ceil(facets.maxPaise / 100)) : 'Max'} defaultValue={max} maxLength={7} />
            </div>
          </fieldset>
          <fieldset>
            <label className="check">
              <input type="checkbox" name="instock" value="1" defaultChecked={inStock} />
              <span>In stock only</span>
            </label>
          </fieldset>
          <div className="row">
            <button type="submit" className="btn btn--primary btn--sm">
              Apply
            </button>
            {active > 0 || q ? (
              <Link href={basePath} className="btn btn--quiet btn--sm">
                Clear all
              </Link>
            ) : null}
          </div>
        </FilterShell>
      </form>

      <section aria-label="Products">
        <p className="small muted" role="status" style={{ marginBottom: '1rem' }}>
          {result.total} {result.total === 1 ? 'item' : 'items'}
          {q ? ` for "${q}"` : ''}
          {facets.maxPaise > 0 && !min && !max ? `, ${formatINR(facets.minPaise)} to ${formatINR(facets.maxPaise)}` : ''}
        </p>
        {result.items.length === 0 ? (
          <div className="empty raised">
            <h2 style={{ fontSize: '1.75rem' }}>{active > 0 || q ? 'Nothing matches these filters' : 'No items here yet'}</h2>
            <p>{active > 0 || q ? 'Remove a filter or search for something else.' : (emptyText ?? 'New pieces are added from time to time. Check back soon.')}</p>
            {active > 0 || q ? (
              <Link href={basePath} className="btn">
                Clear filters
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="grid-products">
            {result.items.map((p, i) => (
              <ProductCard key={p.id} p={p} priority={i < 4} />
            ))}
          </div>
        )}
        <Pagination basePath={basePath} params={keep} page={result.page} pages={result.pages} />
      </section>
    </div>
  );
}
