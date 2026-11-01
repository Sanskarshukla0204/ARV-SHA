import { startPhoneVerification } from '@/lib/auth';
import { HttpError, route } from '@/lib/http';
import { sendOtpSms, smsConfigured } from '@/lib/sms';
import { isProd } from '@/lib/env';
import { db } from '@/lib/db';

export const POST = route(
  { auth: 'user', userLimits: [{ name: 'phone-send', max: 3, windowSec: 3600 }], limits: [{ name: 'phone-send-ip', max: 10, windowSec: 3600 }] },
  async ({ user }) => {
    if (isProd && !smsConfigured()) throw new HttpError(503, 'unavailable', 'Mobile verification is not available right now.');
    if (!user!.phone) throw new HttpError(409, 'no_phone', 'Add a mobile number to your account first.');
    if (user!.phoneVerified) return { ok: true, alreadyVerified: true };
    const row = await db.one<{ phone: string }>(`SELECT phone FROM users WHERE id = $1`, [user!.id]);
    const code = await startPhoneVerification(user!.id, row!.phone);
    const sent = await sendOtpSms(row!.phone, code);
    if (!sent) throw new HttpError(502, 'sms_failed', 'We could not send the code. Try again in a few minutes.');
    return { ok: true };
  },
);

export const dynamic = 'force-dynamic';
