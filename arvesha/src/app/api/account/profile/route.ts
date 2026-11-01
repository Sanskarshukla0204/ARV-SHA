import { db } from '@/lib/db';
import { route } from '@/lib/http';
import { v } from '@/lib/validate';

const NAME_RE = /^[\p{L}][\p{L}\p{M} .'-]{1,79}$/u;
const schema = v.object({
  name: v.string({ min: 2, max: 80, label: 'Name', pattern: NAME_RE, patternMessage: 'Use letters only in your name.' }),
  dob: v.dob({ minAge: 18 }),
  marketingOptIn: v.bool(),
});

export const PATCH = route({ auth: 'user', body: schema, userLimits: [{ name: 'profile', max: 20, windowSec: 3600 }] }, async ({ body, user }) => {
  await db.query(`UPDATE users SET name = $2, dob = $3, marketing_opt_in = $4, updated_at = now() WHERE id = $1`, [user!.id, body.name, body.dob, body.marketingOptIn]);
  return { ok: true };
});

export const dynamic = 'force-dynamic';
