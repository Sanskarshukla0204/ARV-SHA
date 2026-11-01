import { requestPasswordReset } from '@/lib/auth';
import { route } from '@/lib/http';
import { v } from '@/lib/validate';

const schema = v.object({ identifier: v.string({ min: 3, max: 254, label: 'Email or mobile number' }) });

// The answer is identical whether or not an account exists.
export const POST = route(
  { body: schema, turnstile: true, limits: [{ name: 'forgot-ip', max: 10, windowSec: 3600 }] },
  async ({ body, ip, ua }) => {
    await requestPasswordReset(body.identifier, { ip, ua }).catch((e) => console.error('[auth] reset request failed', (e as Error).message));
    return { ok: true, message: 'If an account matches, we have sent a reset link to its email address.' };
  },
);

export const dynamic = 'force-dynamic';
