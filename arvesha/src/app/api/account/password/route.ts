import { changePassword } from '@/lib/auth';
import { route } from '@/lib/http';
import { ValidationError, v } from '@/lib/validate';

const schema = v.object({
  currentPassword: v.optionalString({ max: 128 }),
  newPassword: v.password({ label: 'New password' }),
  confirmPassword: v.password({ label: 'Confirm password' }),
});

export const POST = route({ auth: 'user', body: schema, userLimits: [{ name: 'pw-change', max: 6, windowSec: 3600 }] }, async ({ body, user, ip, ua }) => {
  if (body.newPassword !== body.confirmPassword) throw new ValidationError({ confirmPassword: 'The two passwords do not match.' });
  const row = user!;
  await changePassword({ id: row.id, name: row.name, email: row.email, phone: row.phone, sessionId: row.sessionId }, body.currentPassword ?? '', body.newPassword, { ip, ua });
  return { ok: true };
});

export const dynamic = 'force-dynamic';
