import { adminRoute } from '@/lib/admin-route';
import { db } from '@/lib/db';
import { HttpError } from '@/lib/http';
import { v } from '@/lib/validate';

const schema = v.object({ status: v.oneOf(['open', 'answered', 'closed'] as const, 'Status') });

export const PATCH = adminRoute({ body: schema }, async ({ body, params, log }) => {
  const id = v.uuid('Ticket').run(params.id);
  if (!id.ok) throw new HttpError(404, 'not_found', 'Ticket not found.');
  const r = await db.one(`UPDATE support_tickets SET status = $2, updated_at = now() WHERE id = $1 RETURNING id`, [id.value, body.status]);
  if (!r) throw new HttpError(404, 'not_found', 'Ticket not found.');
  await log('ticket.status', 'ticket', id.value, { status: body.status });
  return { ok: true };
});

export const dynamic = 'force-dynamic';
