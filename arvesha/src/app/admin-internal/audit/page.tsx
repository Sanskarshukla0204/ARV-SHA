import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdmin } from '@/lib/admin-auth';
import { listAudit } from '@/lib/admin-data';
import { formatDateTime } from '@/lib/format';

export default async function AdminAudit() {
  const { admin, base } = await requireAdmin();
  const rows = await listAudit(200);
  return (
    <AdminShell base={base} current="/audit" email={admin.email} title="Audit log">
      <p className="muted">The latest 200 admin actions. Entries cannot be edited from this panel.</p>
      <div className="table-wrap">
        <table className="table">
          <caption className="sr-only">Audit log</caption>
          <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col">Target</th><th scope="col">IP address</th></tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={5} className="muted">No entries yet.</td></tr> : rows.map((r) => (
              <tr key={r.id}><td>{formatDateTime(r.created_at)}</td><td>{r.admin_email ?? 'unknown'}</td><td>{r.action}</td><td className="small">{[r.entity, r.entity_id].filter(Boolean).join(' ')}</td><td className="num">{r.ip ?? ''}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
