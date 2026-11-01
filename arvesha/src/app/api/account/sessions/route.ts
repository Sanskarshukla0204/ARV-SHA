import { route } from '@/lib/http';
import { revokeAllSessions, revokeSession } from '@/lib/session';
import { v } from '@/lib/validate';

const schema = v.object({ sessionId: v.nullable(v.uuid('Session')), all: v.bool() });

export const DELETE = route({ auth: 'user', body: schema, userLimits: [{ name: 'sessions', max: 30, windowSec: 3600 }] }, async ({ body, user }) => {
  if (body.all) await revokeAllSessions(user!.id, user!.sessionId);
  else if (body.sessionId) await revokeSession(user!.id, body.sessionId);
  return { ok: true };
});

export const dynamic = 'force-dynamic';
