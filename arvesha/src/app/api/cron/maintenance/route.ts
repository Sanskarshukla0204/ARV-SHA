import { db } from '@/lib/db';
import { assertCronAuth, route } from '@/lib/http';
import { deleteExpiredCarts } from '@/lib/cart';
import { expireStaleOrders } from '@/lib/orders';
import { cleanupRateLimits } from '@/lib/ratelimit';
import { purgeTruecallerRequests } from '@/lib/truecaller';

// Scheduled by vercel.json every 15 minutes. Anything without the CRON_SECRET bearer token gets a plain 404.
export const GET = route({ skipOriginCheck: true }, async ({ req }) => {
  assertCronAuth(req);
  const orders = await expireStaleOrders(50);
  const rateLimits = await cleanupRateLimits();
  const truecaller = await purgeTruecallerRequests();
  const carts = await deleteExpiredCarts();
  const sessions = (await db.query(`DELETE FROM sessions WHERE expires_at < now() - interval '7 days' OR revoked_at < now() - interval '7 days' RETURNING 1`)).length;
  const adminSessions = (await db.query(`DELETE FROM admin_sessions WHERE expires_at < now() - interval '7 days' OR revoked_at < now() - interval '7 days' RETURNING 1`)).length;
  const tokens = (await db.query(`DELETE FROM auth_tokens WHERE expires_at < now() - interval '2 days' RETURNING 1`)).length;
  const loginEvents = (await db.query(`DELETE FROM login_events WHERE created_at < now() - interval '180 days' RETURNING 1`)).length;
  const webhooks = (await db.query(`DELETE FROM webhook_events WHERE received_at < now() - interval '90 days' AND processed_at IS NOT NULL RETURNING 1`)).length;
  return { ok: true, orders, removed: { rateLimits, truecaller, carts, sessions, adminSessions, tokens, loginEvents, webhooks } };
});

export const dynamic = 'force-dynamic';
