import { authenticate, finishLogin } from '@/lib/auth';
import { route } from '@/lib/http';
import { safeNext, v } from '@/lib/validate';

const schema = v.object({
  identifier: v.string({ min: 3, max: 254, label: 'Email or mobile number' }),
  password: v.password({ min: 1 }),
  next: v.optionalString({ max: 300 }),
});

export const POST = route(
  {
    body: schema,
    turnstile: true,
    limits: [
      { name: 'login-ip', max: 30, windowSec: 900 },
      { name: 'login-ip-burst', max: 6, windowSec: 60 },
    ],
  },
  async ({ body, ip, ua }) => {
    const userId = await authenticate(body.identifier, body.password, { ip, ua });
    await finishLogin(userId, 'password', { ip, ua });
    return { ok: true, next: safeNext(body.next, '/account') };
  },
);

export const dynamic = 'force-dynamic';
