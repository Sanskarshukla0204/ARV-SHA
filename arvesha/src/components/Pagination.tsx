import Link from 'next/link';

/** Previous and next links that keep every other filter in the query string. */
export function Pagination({ basePath, params, page, pages }: { basePath: string; params: Record<string, string | string[] | undefined>; page: number; pages: number }) {
  if (pages <= 1) return null;
  const href = (n: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (!v || k === 'page') continue;
      for (const item of Array.isArray(v) ? v : [v]) sp.append(k, item);
    }
    if (n > 1) sp.set('page', String(n));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <nav className="pager" aria-label="Pages">
      {page > 1 ? (
        <Link className="btn btn--sm" href={href(page - 1)} rel="prev">
          Previous
        </Link>
      ) : null}
      <span className="small num">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link className="btn btn--sm" href={href(page + 1)} rel="next">
          Next
        </Link>
      ) : null}
    </nav>
  );
}
