import { destroyAdminSession } from '@/lib/admin-auth';
import { adminRoute } from '@/lib/admin-route';

export const POST = adminRoute({}, async ({ log, base }) => {
  await log('admin.logout');
  await destroyAdminSession();
  return { ok: true, next: base };
});

export const dynamic = 'force-dynamic';
