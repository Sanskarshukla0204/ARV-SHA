import { route } from '@/lib/http';
import { startTruecaller } from '@/lib/truecaller';

export const POST = route({ limits: [{ name: 'tc-start', max: 20, windowSec: 600 }] }, async ({ ip }) => {
  const s = await startTruecaller(ip);
  return { ok: true, ...s };
});

export const dynamic = 'force-dynamic';
