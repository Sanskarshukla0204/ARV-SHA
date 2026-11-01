import { sendVerificationEmail } from '@/lib/auth';
import { db, isUniqueViolation } from '@/lib/db';
import { checkEmail } from '@/lib/emailcheck';
import { HttpError, route } from '@/lib/http';
import { assertPasswordAcceptable, hashPassword } from '@/lib/password';
import { ValidationError, v } from '@/lib/validate';

const NAME_RE = /^[\p{L}][\p{L}\p{M} .'-]{1,79}$/u;

const schema = v.object({
  name: v.string({ min: 2, max: 80, label: 'Name', pattern: NAME_RE, patternMessage: 'Use letters only in your name.' }),
  dob: v.dob({ minAge: 18 }),
  email: v.email(),
  password: v.optionalString({ max: 128 }),
  confirmPassword: v.optionalString({ max: 128 }),
});

// For accounts created with Truecaller: add the details the sign-in could not provide.
export const POST = route({ auth: 'user', body: schema, limits: [{ name: 'profile-ip', max: 20, windowSec: 3600 }] }, async ({ body, user }) => {
  const verdict = await checkEmail(body.email);
  if (verdict === 'disposable') throw new ValidationError({ email: 'Temporary email addresses are not accepted. Use your regular email address.' });
  if (verdict === 'unreachable') throw new ValidationError({ email: 'We could not find a mail server for this email domain. Check the spelling.' });

  let hash: string | null = null;
  if (body.password) {
    if (body.password !== body.confirmPassword) throw new ValidationError({ confirmPassword: 'The two passwords do not match.' });
    const weak = await assertPasswordAcceptable(body.password, { email: body.email, name: body.name, phone: user!.phone });
    if (weak) throw new ValidationError({ password: weak });
    hash = await hashPassword(body.password);
  }

  try {
    await db.query(
      `UPDATE users SET name = $2, dob = $3, email = $4,
              email_verified_at = CASE WHEN email IS DISTINCT FROM $4 THEN NULL ELSE email_verified_at END,
              password_hash = COALESCE($5, password_hash), profile_complete = true, updated_at = now()
        WHERE id = $1`,
      [user!.id, body.name, body.dob, body.email, hash],
    );
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, 'cannot_save', 'We could not save these details. If this email is already registered, log in with it instead.');
    throw err;
  }
  const sent = await sendVerificationEmail({ id: user!.id, name: body.name, email: body.email }).catch(() => false);
  return { ok: true, verificationSent: sent };
});

export const dynamic = 'force-dynamic';
