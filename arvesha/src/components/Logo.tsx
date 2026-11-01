import Link from 'next/link';
import { SITE } from '@/lib/site';

/** The supplied wordmark, cut out of your logo file so it sits cleanly on any surface. */
export function Logo({ href = '/', priority = false }: { href?: string | null; priority?: boolean }) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/logo.png" alt={SITE.name} width={960} height={320} decoding="async" fetchPriority={priority ? 'high' : undefined} />
  );
  if (href === null) return <span className="logo">{img}</span>;
  return (
    <Link href={href} className="logo" aria-label={`${SITE.name}, home`}>
      {img}
    </Link>
  );
}
