import Link from 'next/link';
import { LEGAL_GROUPS, LEGAL_PAGES } from '@/lib/site';

export function LegalNav({ current }: { current: string }) {
  return (
    <nav className="legal-nav" aria-label="Legal pages">
      {LEGAL_GROUPS.map((g) => (
        <div key={g}>
          <p className="small muted">{g}</p>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {LEGAL_PAGES.filter((p) => p.group === g).map((p) => (
              <li key={p.slug}>
                <Link href={`/legal/${p.slug}`} aria-current={p.slug === current ? 'page' : undefined}>{p.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
