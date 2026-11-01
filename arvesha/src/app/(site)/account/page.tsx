import { AddressManager, ContactStatus, DeleteAccountForm, PasswordForm, ProfileForm, SessionsList } from '@/components/AccountForms';
import { MAX_SAVED_ADDRESSES, listAddresses } from '@/lib/address';
import { db } from '@/lib/db';
import { describeDevice } from '@/lib/order-labels';
import { INDIAN_STATES } from '@/lib/pincode';
import { NOINDEX } from '@/lib/seo';
import { listSessions, requireUser } from '@/lib/session';

export const metadata = { ...NOINDEX, title: 'Account settings' };
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const user = await requireUser('/account');
  const [row, addresses, sessions] = await Promise.all([
    db.one<{ dob: Date | null; marketing_opt_in: boolean; has_password: boolean }>(
      `SELECT dob, marketing_opt_in, (password_hash IS NOT NULL) AS has_password FROM users WHERE id = $1`,
      [user.id],
    ),
    listAddresses(user.id),
    listSessions(user.id, user.sessionId),
  ]);
  const dob = row?.dob ? new Date(row.dob).toISOString().slice(0, 10) : '';
  return (
    <>
      <div className="page-head">
        <h1>Account settings</h1>
        <p>
          Customer ID <strong className="num">{user.publicId}</strong>. Quote it when you contact support.
        </p>
      </div>

      <section className="panel glass stack" aria-labelledby="details-h">
        <h2 id="details-h">Your details</h2>
        <ProfileForm name={user.name} dob={dob} marketingOptIn={row?.marketing_opt_in ?? false} />
      </section>

      <section className="panel glass stack" aria-labelledby="contact-h">
        <h2 id="contact-h">Email and mobile</h2>
        <ContactStatus email={user.email} emailVerified={user.emailVerified} phone={user.phone} phoneVerified={user.phoneVerified} />
      </section>

      <section className="panel glass stack" aria-labelledby="addr-h">
        <h2 id="addr-h">Saved addresses</h2>
        <AddressManager addresses={addresses} states={INDIAN_STATES} max={MAX_SAVED_ADDRESSES} />
      </section>

      <section className="panel glass stack" aria-labelledby="pw-h">
        <h2 id="pw-h">Password</h2>
        <PasswordForm hasPassword={row?.has_password ?? false} />
      </section>

      <section className="panel glass stack" aria-labelledby="sess-h">
        <h2 id="sess-h">Devices</h2>
        <SessionsList
          sessions={sessions.map((s) => ({ id: s.id, device: describeDevice(s.userAgent), ip: s.ip, lastSeenAt: new Date(s.lastSeenAt).toISOString(), current: s.current }))}
        />
      </section>

      <section className="panel glass stack" aria-labelledby="del-h">
        <h2 id="del-h">Delete account</h2>
        <DeleteAccountForm hasPassword={row?.has_password ?? false} />
      </section>
    </>
  );
}
