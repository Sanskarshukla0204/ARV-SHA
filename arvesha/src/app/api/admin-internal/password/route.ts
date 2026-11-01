import { changeAdminPassword } from '@/lib/admin-auth';
import { adminRoute } from '@/lib/admin-route';
import { ValidationError, v } from '@/lib/validate';

const schema = v.object({ currentPassword: v.password({ min: 1, label: 'Current password' }), newPassword: v.password({ min: 12, label: 'New password' }), confirmPassword: v.password({ min: 1, label: 'Confirm password' }) });

export const POST = adminRoute({ body: schema, perMinute: 10 }, async ({ body, admin, log }) => {
  if (body.newPassword !== body.confirmPassword) throw new ValidationError({ confirmPassword: 'The two passwords do not match.' });
  await changeAdminPassword(admin, body.currentPassword, body.newPassword);
  await log('admin.password_change');
  return { ok: true };
});

export const dynamic = 'force-dynamic';
