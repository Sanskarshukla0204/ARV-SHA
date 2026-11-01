import { adminLogin } from '@/lib/admin-auth';
import { adminRoute } from '@/lib/admin-route';
import { v } from '@/lib/validate';

const schema = v.object({
  email: v.string({ min: 3, max: 254, label: 'Email' }),
  password: v.password({ min: 1 }),
  code: v.string({ min: 6, max: 20, label: 'Code' }),
});

export const POST = adminRoute({ public: true, body: schema, perMinute: 20 }, async ({ body, ip, ua, base }) => {
  await adminLogin(body, { ip, ua });
  return { ok: true, next: base };
});

export const dynamic = 'force-dynamic';
