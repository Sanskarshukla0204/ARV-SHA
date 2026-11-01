import { route } from '@/lib/http';
import { finishLogin, registerUser, sendVerificationEmail } from '@/lib/auth';
import { ValidationError, v } from '@/lib/validate';

const NAME_RE = /^[\p{L}][\p{L}\p{M} .'-]{1,79}$/u;

const schema = v.object({
  name: v.string({ min: 2, max: 80, label: 'Name', pattern: NAME_RE, patternMessage: 'Use letters only in your name.' }),
  dob: v.dob({ minAge: 18 }),
  phone: v.phoneIN({ label: 'Contact number' }),
  email: v.email(),
  password: v.password(),
  confirmPassword: v.password({ label: 'Confirm password' }),
  marketingOptIn: v.bool(),
  acceptTerms: v.accepted('Accept the Terms of Service and Privacy Policy to create an account.'),
});

export const POST = route(
  {
    body: schema,
    turnstile: true,
    limits: [
      { name: 'register-ip', max: 8, windowSec: 3600 },
      { name: 'register-ip-burst', max: 3, windowSec: 60 },
    ],
  },
  async ({ body, ip, ua }) => {
    if (body.password !== body.confirmPassword) throw new ValidationError({ confirmPassword: 'The two passwords do not match.' });
    const userId = await registerUser(
      { name: body.name, dob: body.dob, phone: body.phone, email: body.email, password: body.password, marketingOptIn: body.marketingOptIn },
      { ip, ua },
    );
    await finishLogin(userId, 'register', { ip, ua });
    // Verification is optional at sign-up. A failed email never blocks the new account.
    const sent = await sendVerificationEmail({ id: userId, name: body.name, email: body.email }).catch(() => false);
    return { ok: true, next: '/onboarding', verificationSent: sent };
  },
);

export const dynamic = 'force-dynamic';
