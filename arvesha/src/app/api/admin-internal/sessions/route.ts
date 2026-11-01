import { revokeOtherAdminSessions } from '@/lib/admin-auth';
import { adminRoute } from '@/lib/admin-route';

export const DELETE = adminRoute({}, async ({ admin, log }) => {
  await revokeOtherAdminSessions(admin.id, admin.sessionId);
  await log('admin.sessions_revoked');
  return { ok: true };
});

export const dynamic = 'force-dynamic';
