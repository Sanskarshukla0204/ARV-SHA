import { completePasswordReset } from '@/lib/auth';
import { route } from '@/lib/http';
import { ValidationError, v } from '@/lib/validate';

const schema = v.object({
  token: v.string({ min: 20, max: 200, label: 'Reset link' }),
  password: v.password(),
  confirmPassword: v.password({ label: 'Confirm password' }),
});

export const POST = route({ body: schema, limits: [{ name: 'reset-ip', max: 15, windowSec: 3600 }] }, async ({ body, ip, ua }) => {
  if (body.password !== body.confirmPassword) throw new ValidationError({ confirmPassword: 'The two passwords do not match.' });
  await completePasswordReset(body.token, body.password, { ip, ua });
  return { ok: true };
});

export const dynamic = 'force-dynamic';
