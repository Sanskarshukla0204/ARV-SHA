import { finishLogin } from '@/lib/auth';
import { route } from '@/lib/http';
import { pollTruecaller } from '@/lib/truecaller';
import { v } from '@/lib/validate';

const schema = v.object({
  nonce: v.string({ min: 8, max: 64, label: 'Request' }),
  browserSecret: v.string({ min: 16, max: 100, label: 'Request' }),
});

export const POST = route({ body: schema, limits: [{ name: 'tc-poll', max: 240, windowSec: 600 }] }, async ({ body, ip, ua }) => {
  const r = await pollTruecaller(body.nonce, body.browserSecret);
  if (r.status !== 'verified') return { status: r.status };
  await finishLogin(r.userId, 'truecaller', { ip, ua });
  return { status: 'verified', next: r.profileComplete ? '/account' : '/onboarding' };
});

export const dynamic = 'force-dynamic';
