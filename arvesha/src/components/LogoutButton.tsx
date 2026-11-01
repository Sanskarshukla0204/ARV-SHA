'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn btn--quiet"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api('/api/auth/logout', { method: 'POST', body: {} });
        } catch {
          /* the session may already be gone */
        }
        router.push('/');
        router.refresh();
      }}
    >
      {busy ? 'Logging out' : 'Log out'}
    </button>
  );
}
