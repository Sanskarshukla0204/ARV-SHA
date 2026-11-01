'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client';
import { formatINR } from '@/lib/format';
import { useCart } from './CartProvider';
import { Icon } from './icons';
import { useFocusTrap } from './useFocusTrap';

interface Suggest {
  products: { name: string; slug: string; pricePaise: number }[];
  categories: { name: string; slug: string }[];
}

export function SearchBox({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [data, setData] = useState<Suggest | null>(null);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const term = q.trim();
    if (term.length < 2) {
      setData(null);
      return;
    }
    const my = ++seq.current;
    timer.current = setTimeout(async () => {
      try {
        const r = await api<Suggest>(`/api/search?q=${encodeURIComponent(term)}`);
        if (my === seq.current) setData(r);
      } catch {
        if (my === seq.current) setData(null);
      }
    }, 220);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const term = q.trim();
      if (!term) return;
      setOpen(false);
      onNavigate?.();
      router.push(`/shop?q=${encodeURIComponent(term)}`);
    },
    [q, router, onNavigate],
  );

  const total = (data?.products.length ?? 0) + (data?.categories.length ?? 0);
  return (
    <form ref={wrap} className="header-search" role="search" onSubmit={submit} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <label htmlFor="site-search" className="sr-only">
        Search the shop
      </label>
      <Icon name="search" size={18} className="icon" />
      <input
        id="site-search"
        className="input"
        type="search"
        name="q"
        value={q}
        placeholder="Search"
        autoComplete="off"
        maxLength={80}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      <p className="sr-only" aria-live="polite">
        {open && data ? `${total} suggestion${total === 1 ? '' : 's'}` : ''}
      </p>
      {open && data && total > 0 ? (
        <ul className="suggest glass">
          {data.categories.map((c) => (
            <li key={`c-${c.slug}`}>
              <Link href={`/categories/${c.slug}`} onClick={() => { setOpen(false); onNavigate?.(); }}>
                <span>{c.name}</span>
                <span className="small muted">Category</span>
              </Link>
            </li>
          ))}
          {data.products.map((p) => (
            <li key={p.slug}>
              <Link href={`/products/${p.slug}`} onClick={() => { setOpen(false); onNavigate?.(); }}>
                <span>{p.name}</span>
                <span className="price small">{formatINR(p.pricePaise)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}

const MOBILE_LINKS = [
  { href: '/shop', label: 'Shop' },
  { href: '/categories', label: 'Categories' },
  { href: '/account', label: 'Account' },
  { href: '/account/orders', label: 'My orders' },
  { href: '/support', label: 'Support' },
  { href: '/help', label: 'Help' },
];

export function HeaderTools({ signedIn }: { signedIn: boolean }) {
  const { cart, setOpen } = useCart();
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setMenu(false), []);
  useFocusTrap(ref, menu, closeMenu);

  useEffect(() => {
    setMenu(false);
  }, [pathname]);

  return (
    <div className="header-tools">
      <SearchBox />
      <Link href={signedIn ? '/account' : '/login'} className="icon-btn" aria-label={signedIn ? 'Your account' : 'Log in'}>
        <Icon name="user" />
      </Link>
      <button type="button" className="icon-btn" onClick={() => setOpen(true)} aria-label={`Open bag, ${cart.count} ${cart.count === 1 ? 'item' : 'items'}`}>
        <Icon name="bag" />
        {cart.count > 0 ? (
          <span className="badge-count" aria-hidden="true">
            {cart.count > 99 ? '99+' : cart.count}
          </span>
        ) : null}
      </button>
      <button type="button" className="icon-btn only-mobile" onClick={() => setMenu(true)} aria-label="Open menu" aria-expanded={menu}>
        <Icon name="menu" />
      </button>

      {menu ? (
        <>
          <div className="scrim" onClick={closeMenu} aria-hidden="true" />
          <div ref={ref} className="drawer drawer--left" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="drawer__head">
              <span className="muted">Menu</span>
              <button type="button" className="icon-btn" onClick={closeMenu} aria-label="Close menu" data-autofocus>
                <Icon name="close" />
              </button>
            </div>
            <div className="drawer__body">
              <div style={{ padding: '1rem 0' }}>
                <SearchBox onNavigate={closeMenu} />
              </div>
              <nav className="mobile-nav" aria-label="Menu">
                {MOBILE_LINKS.map((l) => (
                  <Link key={l.href} href={l.href} aria-current={pathname === l.href ? 'page' : undefined}>
                    {l.label}
                  </Link>
                ))}
                {!signedIn ? <Link href="/login">Log in</Link> : null}
              </nav>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
