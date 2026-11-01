import { route } from '@/lib/http';
import { destroyCurrentSession } from '@/lib/session';

export const POST = route({ limits: [{ name: 'logout-ip', max: 30, windowSec: 60 }] }, async () => {
  await destroyCurrentSession();
  return { ok: true };
});

export const dynamic = 'force-dynamic';
