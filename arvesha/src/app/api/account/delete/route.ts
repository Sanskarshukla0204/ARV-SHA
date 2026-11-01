import { db, tx } from '@/lib/db';
import { HttpError, route } from '@/lib/http';
import { verifyPassword } from '@/lib/password';
import { destroyCurrentSession } from '@/lib/session';
import { v } from '@/lib/validate';

const schema = v.object({ password: v.optionalString({ max: 128 }), confirmText: v.optionalString({ max: 20 }) });

// Erases the personal data we are free to erase. Orders stay for tax and accounting records, but they are no longer
// linked to a profile, and the address on them is covered by the retention period in the Privacy Policy.
export const POST = route({ auth: 'user', body: schema, userLimits: [{ name: 'delete-account', max: 5, windowSec: 3600 }] }, async ({ body, user }) => {
  const row = await db.one<{ password_hash: string | null }>(`SELECT password_hash FROM users WHERE id = $1`, [user!.id]);
  if (row?.password_hash) {
    if (!(await verifyPassword(row.password_hash, body.password ?? ''))) throw new HttpError(422, 'validation', 'Your password is not correct.', { password: 'Your password is not correct.' });
  } else if ((body.confirmText ?? '').trim().toUpperCase() !== 'DELETE') {
    throw new HttpError(422, 'validation', 'Type DELETE to confirm.', { confirmText: 'Type DELETE to confirm.' });
  }
  const open = await db.one(`SELECT 1 FROM orders WHERE user_id = $1 AND status IN ('pending_payment', 'new', 'processing', 'shipped') LIMIT 1`, [user!.id]);
  if (open) throw new HttpError(409, 'open_orders', 'You have an order in progress. Wait until it is delivered or cancel it, then delete your account.');

  await tx(async (q) => {
    await q.query(`DELETE FROM addresses WHERE user_id = $1`, [user!.id]);
    await q.query(`DELETE FROM carts WHERE user_id = $1`, [user!.id]);
    await q.query(`DELETE FROM wishlist_items WHERE user_id = $1`, [user!.id]);
    await q.query(`DELETE FROM auth_tokens WHERE user_id = $1`, [user!.id]);
    await q.query(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [user!.id]);
    await q.query(`UPDATE support_tickets SET user_id = NULL WHERE user_id = $1`, [user!.id]);
    await q.query(
      `UPDATE users SET status = 'deleted', name = 'Deleted customer', email = NULL, phone = NULL, dob = NULL, password_hash = NULL,
              email_verified_at = NULL, phone_verified_at = NULL, marketing_opt_in = false, signup_ip = NULL, last_login_ip = NULL, updated_at = now()
        WHERE id = $1`,
      [user!.id],
    );
    await q.query(`UPDATE login_events SET ip = NULL, user_agent = NULL WHERE user_id = $1`, [user!.id]);
  });
  await destroyCurrentSession();
  return { ok: true };
});

export const dynamic = 'force-dynamic';
