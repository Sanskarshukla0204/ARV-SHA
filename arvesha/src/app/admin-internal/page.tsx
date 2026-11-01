import Link from 'next/link';
import { AdminLoginForm } from '@/components/admin/AdminForms';
import { AdminShell } from '@/components/admin/AdminShell';
import { getAdmin, requireGate } from '@/lib/admin-auth';
import { getDashboard } from '@/lib/admin-data';
import { formatDateTime, formatINR } from '@/lib/format';
import { STATUS_LABEL, STATUS_TAG } from '@/lib/order-labels';

function RevenueChart({ series }: { series: { day: string; paise: number }[] }) {
  const W = 720, H = 220, L = 52, B = 26, T = 10, R = 8;
  const max = Math.max(1, ...series.map((s) => s.paise));
  const nice = (() => {
    const p = Math.pow(10, Math.floor(Math.log10(max)));
    const n = max / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  })();
  const bw = (W - L - R) / series.length;
  const y = (v: number) => T + (H - T - B) * (1 - v / nice);
  const ticks = [0, 0.5, 1].map((f) => f * nice);
  const label = (p: number) => (p >= 10000000 ? `${(p / 10000000).toFixed(1)}Cr` : p >= 100000 ? `${(p / 100000).toFixed(1)}L` : p >= 100 ? `${Math.round(p / 100).toLocaleString('en-IN')}` : '0');
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Revenue per day for the last 30 days. The same numbers are in the table below.">
      {ticks.map((t) => (
        <g key={t}>
          <line className="grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
          <text x={L - 6} y={y(t) + 4} textAnchor="end">{label(t)}</text>
        </g>
      ))}
      {series.map((s, i) => (
        <rect key={s.day} className="bar" x={L + i * bw + 1.5} width={Math.max(2, bw - 3)} y={y(s.paise)} height={Math.max(0, H - B - y(s.paise))}>
          <title>{`${s.day}: ${formatINR(s.paise)}`}</title>
        </rect>
      ))}
      <line className="axis" x1={L} x2={W - R} y1={H - B} y2={H - B} />
      <text x={L} y={H - 8}>{series[0]?.day.slice(5)}</text>
      <text x={W - R} y={H - 8} textAnchor="end">{series[series.length - 1]?.day.slice(5)}</text>
    </svg>
  );
}

export default async function AdminHome() {
  const base = await requireGate();
  const admin = await getAdmin();
  if (!admin) {
    return (
      <main id="main" className="admin-login stack">
        <h1>Sign in</h1>
        <AdminLoginForm base={base} />
      </main>
    );
  }
  const d = await getDashboard();
  return (
    <AdminShell base={base} current="" email={admin.email} title="Overview">
      <dl className="stat-grid">
        <div className="stat"><dt>Revenue, last 30 days</dt><dd>{formatINR(d.revenue30)}</dd></div>
        <div className="stat"><dt>Paid orders, last 30 days</dt><dd>{d.orders30}</dd></div>
        <div className="stat"><dt>Revenue today</dt><dd>{formatINR(d.revenueToday)}</dd></div>
        <div className="stat"><dt>Orders today</dt><dd>{d.ordersToday}</dd></div>
        <div className="stat"><dt><Link href={`${base}/orders?status=new`}>New orders to ship</Link></dt><dd>{d.toShip}</dd></div>
        <div className="stat"><dt><Link href={`${base}/orders?status=pending_payment`}>Awaiting payment</Link></dt><dd>{d.awaitingPayment}</dd></div>
        <div className="stat"><dt><Link href={`${base}/support`}>Open support requests</Link></dt><dd>{d.openTickets}</dd></div>
      </dl>

      <section className="panel glass stack" aria-labelledby="rev-h">
        <h2 id="rev-h">Revenue per day</h2>
        <RevenueChart series={d.series} />
        <details className="disclosure">
          <summary>Show the numbers</summary>
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Revenue per day</caption>
              <thead><tr><th scope="col">Day</th><th scope="col">Orders</th><th scope="col">Revenue</th></tr></thead>
              <tbody>
                {[...d.series].reverse().map((s) => (
                  <tr key={s.day}><td>{s.day}</td><td className="num">{s.orders}</td><td className="num">{formatINR(s.paise)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <p className="small muted">Counts paid orders by payment date in India time. Cancelled, expired and fully refunded orders are left out.</p>
      </section>

      <div className="split">
        <section className="panel glass stack" aria-labelledby="recent-h">
          <h2 id="recent-h">Latest orders</h2>
          {d.recent.length === 0 ? <p className="muted">No orders yet.</p> : (
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">Latest orders</caption>
                <thead><tr><th scope="col">Order</th><th scope="col">Customer</th><th scope="col">Status</th><th scope="col">Total</th></tr></thead>
                <tbody>
                  {d.recent.map((o) => (
                    <tr key={o.id}>
                      <td><Link href={`${base}/orders/${o.id}`}>{o.number}</Link><br /><span className="small muted">{formatDateTime(o.placedAt)}</span></td>
                      <td>{o.contactName}</td>
                      <td><span className={`tag ${STATUS_TAG[o.status]}`}>{STATUS_LABEL[o.status]}</span></td>
                      <td className="num">{formatINR(o.totalPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="stack">
          <section className="panel glass stack" aria-labelledby="top-h">
            <h2 id="top-h">Best selling items, 30 days</h2>
            {d.topItems.length === 0 ? <p className="muted">Nothing sold in this period.</p> : (
              <ul className="kv">
                {d.topItems.map((t) => <li key={t.name}>{t.name}: {t.units} sold, {formatINR(t.paise)}</li>)}
              </ul>
            )}
          </section>
          <section className="panel glass stack" aria-labelledby="low-h">
            <h2 id="low-h">Low stock</h2>
            {d.lowStock.length === 0 ? <p className="muted">All active variants have more than 3 in stock.</p> : (
              <ul className="kv">
                {d.lowStock.map((l, i) => <li key={i}><Link href={`${base}/products/${l.productId}`}>{l.name}</Link>, {l.size}, {l.color}: {l.stock} left</li>)}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
