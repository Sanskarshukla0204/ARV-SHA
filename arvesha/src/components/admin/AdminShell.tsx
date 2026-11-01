import Link from 'next/link';
import type { ReactNode } from 'react';
import { AdminLogoutButton } from './AdminForms';

const LINKS: { href: string; label: string }[] = [
  { href: '', label: 'Overview' },
  { href: '/orders', label: 'Orders' },
  { href: '/products', label: 'Products' },
  { href: '/categories', label: 'Categories' },
  { href: '/support', label: 'Support inbox' },
  { href: '/settings', label: 'Store settings' },
  { href: '/security', label: 'Security' },
  { href: '/audit', label: 'Audit log' },
  { href: '/launch', label: 'Launch checklist' },
];

export function AdminShell({ base, current, email, title, children }: { base: string; current: string; email: string; title: string; children: ReactNode }) {
  return (
    <>
      <header className="admin-bar">
        <div className="admin-bar__inner">
          <span className="admin-bar__name">Arvésha admin</span>
          <nav className="admin-nav" aria-label="Admin sections">
            {LINKS.map((l) => (
              <Link key={l.href} href={`${base}${l.href}`} aria-current={current === l.href ? 'page' : undefined}>
                {l.label}
              </Link>
            ))}
          </nav>
          <span className="muted small">{email}</span>
          <AdminLogoutButton base={base} />
        </div>
      </header>
      <main id="main" className="admin-main">
        <h1>{title}</h1>
        {children}
      </main>
    </>
  );
}

export function Pager({ base, path, params, page, total, size }: { base: string; path: string; params: Record<string, string | undefined>; page: number; total: number; size: number }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set('page', String(p));
    return `${base}${path}?${sp.toString()}`;
  };
  return (
    <nav className="pager" aria-label="Pages">
      {page > 1 ? <Link className="btn btn--quiet btn--sm" href={href(page - 1)}>Previous</Link> : null}
      <span className="small muted">Page {page} of {pages}</span>
      {page < pages ? <Link className="btn btn--quiet btn--sm" href={href(page + 1)}>Next</Link> : null}
    </nav>
  );
}
