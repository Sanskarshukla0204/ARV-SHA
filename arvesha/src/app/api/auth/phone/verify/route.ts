import { confirmPhoneCode } from '@/lib/auth';
import { HttpError, route } from '@/lib/http';
import { v } from '@/lib/validate';

const schema = v.object({ code: v.string({ min: 6, max: 6, pattern: /^\d{6}$/, label: 'Code', patternMessage: 'Enter the 6 digit code.' }) });

export const POST = route(
  { auth: 'user', body: schema, userLimits: [{ name: 'phone-verify', max: 10, windowSec: 3600 }] },
  async ({ body, user }) => {
    const ok = await confirmPhoneCode(user!.id, body.code);
    if (!ok) throw new HttpError(400, 'invalid_code', 'That code is not correct or has expired.');
    return { ok: true };
  },
);

export const dynamic = 'force-dynamic';
