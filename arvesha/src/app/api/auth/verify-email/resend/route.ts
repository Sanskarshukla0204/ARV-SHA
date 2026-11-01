import { sendVerificationEmail } from '@/lib/auth';
import { HttpError, route } from '@/lib/http';

export const POST = route(
  { auth: 'user', userLimits: [{ name: 'verify-resend', max: 3, windowSec: 3600 }], limits: [{ name: 'verify-resend-ip', max: 10, windowSec: 3600 }] },
  async ({ user }) => {
    if (!user!.email) throw new HttpError(409, 'no_email', 'Add an email address to your account first.');
    if (user!.emailVerified) return { ok: true, alreadyVerified: true };
    const sent = await sendVerificationEmail({ id: user!.id, name: user!.name, email: user!.email });
    if (!sent) throw new HttpError(502, 'mail_failed', 'We could not send the email right now. Try again in a few minutes.');
    return { ok: true };
  },
);

export const dynamic = 'force-dynamic';
