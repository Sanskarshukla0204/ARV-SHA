import Link from 'next/link';
import { TicketStatus } from '@/components/admin/AdminForms';
import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdmin } from '@/lib/admin-auth';
import { listTickets } from '@/lib/admin-data';
import { formatDateTime } from '@/lib/format';
import { first } from '@/lib/safe';

export default async function AdminSupport({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { admin, base } = await requireAdmin();
  const status = first((await searchParams).status) ?? 'open';
  const tickets = await listTickets(status === 'all' ? undefined : status);
  return (
    <AdminShell base={base} current="/support" email={admin.email} title="Support inbox">
      <nav className="row" aria-label="Filter by status">
        {['open', 'closed', 'all'].map((s) => <Link key={s} className={`btn btn--sm${status === s ? ' btn--primary' : ''}`} href={`${base}/support?status=${s}`} aria-current={status === s ? 'true' : undefined}>{s === 'open' ? 'Open' : s === 'closed' ? 'Closed' : 'All'}</Link>)}
      </nav>
      {tickets.length === 0 ? <p className="muted">Nothing here.</p> : tickets.map((t) => (
        <article key={t.id} className="panel glass stack">
          <div className="row row--between">
            <h2>{t.topic}</h2>
            <TicketStatus base={base} id={t.id} status={t.status} />
          </div>
          <p className="small muted">{t.reference} · {formatDateTime(t.created_at)}{t.public_id ? ` · Customer ID ${t.public_id}` : ''}{t.order_number ? ` · Order ${t.order_number}` : ''}</p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{t.message}</p>
          <p className="small">{t.name}, <a href={`mailto:${t.email}`}>{t.email}</a>{t.phone ? `, ${t.phone}` : ''}</p>
        </article>
      ))}
    </AdminShell>
  );
}
