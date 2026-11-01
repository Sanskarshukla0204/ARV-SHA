import { route } from '@/lib/http';
import { handleCallback } from '@/lib/truecaller';

// Called by Truecaller's servers, so there is no browser Origin header. The request is only trusted to name a
// nonce we issued; the identity itself is fetched from Truecaller with the access token and never taken from this body.
export const POST = route({ skipOriginCheck: true, limits: [{ name: 'tc-callback', max: 120, windowSec: 60 }] }, async ({ req }) => {
  try {
    const text = await req.text();
    if (text.length <= 16 * 1024) await handleCallback(JSON.parse(text));
  } catch (err) {
    console.error('[truecaller] callback error', (err as Error).message);
  }
  return { ok: true };
});

export const dynamic = 'force-dynamic';
