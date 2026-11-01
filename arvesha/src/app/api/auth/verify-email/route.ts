import { confirmEmailToken } from '@/lib/auth';
import { HttpError, route } from '@/lib/http';
import { v } from '@/lib/validate';

const schema = v.object({ token: v.string({ min: 20, max: 200, label: 'Verification link' }) });

export const POST = route({ body: schema, limits: [{ name: 'verify-ip', max: 20, windowSec: 3600 }] }, async ({ body }) => {
  const ok = await confirmEmailToken(body.token);
  if (!ok) throw new HttpError(400, 'invalid_token', 'This verification link is no longer valid. Request a new one from your account.');
  return { ok: true };
});

export const dynamic = 'force-dynamic';
