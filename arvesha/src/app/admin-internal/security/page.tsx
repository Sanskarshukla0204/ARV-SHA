import { AdminSecurity } from '@/components/admin/AdminForms';
import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdmin } from '@/lib/admin-auth';
import { listAdminSessions } from '@/lib/admin-data';
import { formatDateTime } from '@/lib/format';
import { describeDevice } from '@/lib/order-labels';

export default async function AdminSecurityPage() {
  const { admin, base } = await requireAdmin();
  const sessions = await listAdminSessions(admin.id);
  return (
    <AdminShell base={base} current="/security" email={admin.email} title="Security">
      <section className="panel glass stack" aria-labelledby="s-h">
        <h2 id="s-h">Signed-in devices</h2>
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Admin sessions</caption>
            <thead><tr><th scope="col">Device</th><th scope="col">IP address</th><th scope="col">Signed in</th><th scope="col">Last active</th></tr></thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}><td>{describeDevice(s.user_agent)}{s.id === admin.sessionId ? ' (this device)' : ''}</td><td className="num">{s.ip ?? 'unknown'}</td><td>{formatDateTime(s.created_at)}</td><td>{formatDateTime(s.last_seen_at)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel glass stack" aria-labelledby="pw-h">
        <h2 id="pw-h">Password and devices</h2>
        <AdminSecurity base={base} otherSessions={sessions.filter((s) => s.id !== admin.sessionId).length} />
      </section>
    </AdminShell>
  );
}
