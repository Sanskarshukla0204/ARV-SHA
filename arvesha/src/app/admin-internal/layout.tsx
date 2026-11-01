import type { ReactNode } from 'react';
import { requireGate } from '@/lib/admin-auth';
import { NOINDEX } from '@/lib/seo';

export const metadata = { ...NOINDEX, title: { absolute: 'Admin' } };
export const dynamic = 'force-dynamic';

// No shop header or footer here. Every page below also calls requireGate or requireAdmin, so a request that did not
// come through the secret path gets the ordinary 404.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireGate();
  return <>{children}</>;
}
