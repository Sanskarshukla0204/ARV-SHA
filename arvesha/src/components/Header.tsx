import Link from 'next/link';
import { HeaderTools } from './HeaderTools';
import { Logo } from './Logo';

export function Header({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Logo priority />
        <nav className="main-nav" aria-label="Main">
          <Link href="/shop">Shop</Link>
          <Link href="/categories">Categories</Link>
        </nav>
        <HeaderTools signedIn={signedIn} />
      </div>
    </header>
  );
}
