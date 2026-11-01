import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdmin } from '@/lib/admin-auth';
import { integrationStatus, isLocalSite, siteUrl } from '@/lib/env';
import { getSettings } from '@/lib/settings';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Launch() {
  const { admin, base } = await requireAdmin();
  const [s, counts] = await Promise.all([
    getSettings(),
    db.one<{ products: number; categories: number }>(`SELECT (SELECT COUNT(*) FROM products WHERE status = 'active')::int AS products, (SELECT COUNT(*) FROM categories WHERE active)::int AS categories`),
  ]);
  const i = integrationStatus();
  const items: { ok: boolean; label: string; help: string; required: boolean }[] = [
    { ok: i.database, required: true, label: 'Database connected', help: 'Set DATABASE_URL to your Neon connection string and run npm run db:migrate.' },
    { ok: i.appSecret, required: true, label: 'APP_SECRET set', help: 'Run npm run setup:secrets and copy the values into your host.' },
    { ok: i.passwordPepper, required: true, label: 'PASSWORD_PEPPER set', help: 'Extra secret mixed into password hashes. Set it before the first user registers; it cannot change later without resetting passwords.' },
    { ok: i.dataEncryptionKey, required: true, label: 'DATA_ENCRYPTION_KEY set', help: 'Encrypts admin authenticator secrets.' },
    { ok: i.adminPath, required: true, label: 'Secret admin link set', help: 'ADMIN_PATH, 12 to 64 characters of a to z, 0 to 9 and hyphen.' },
    { ok: i.resend, required: true, label: 'Email sending (Resend)', help: 'RESEND_API_KEY and MAIL_FROM on a verified domain.' },
    { ok: i.turnstile, required: true, label: 'Captcha (Cloudflare Turnstile)', help: 'TURNSTILE_SECRET_KEY and NEXT_PUBLIC_TURNSTILE_SITE_KEY.' },
    { ok: i.razorpay, required: true, label: 'Razorpay keys', help: 'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (use live keys at launch).' },
    { ok: i.razorpayWebhook, required: true, label: 'Razorpay webhook secret', help: `Add the webhook URL ${siteUrl()}/api/webhooks/razorpay in Razorpay with events payment.authorized, payment.captured, payment.failed, order.paid and refund.*, then set RAZORPAY_WEBHOOK_SECRET.` },
    { ok: i.blobStorage, required: true, label: 'Image storage (Vercel Blob)', help: 'BLOB_READ_WRITE_TOKEN, needed to upload product images in production.' },
    { ok: i.cronSecret, required: true, label: 'Maintenance job secret', help: 'CRON_SECRET (16+ characters) so the 15 minute job can expire unpaid orders and reconcile payments.' },
    { ok: i.truecaller, required: false, label: 'Truecaller one-tap login', help: 'Optional. TRUECALLER_APP_KEY and TRUECALLER_APP_NAME from your Truecaller partner account.' },
    { ok: i.sms, required: false, label: 'SMS OTP (MSG91)', help: 'Optional. Only needed to verify phone numbers or to require a verified phone at checkout.' },
    { ok: !isLocalSite(), required: true, label: 'Custom domain', help: `NEXT_PUBLIC_SITE_URL is ${siteUrl()}. Point your domain at the host and set this to https://yourdomain.` },
    { ok: !!(s.business.legalName && s.business.address && s.business.supportEmail), required: true, label: 'Business details filled in', help: 'Legal name, address and support email under Store settings. Legal pages use them.' },
    { ok: !!(s.business.grievanceName && s.business.grievanceEmail), required: true, label: 'Grievance officer named', help: 'Required for Indian online stores. Add name and email under Store settings.' },
    { ok: counts!.categories > 0, required: true, label: 'Categories created', help: 'Add at least one under Categories.' },
    { ok: counts!.products > 0, required: true, label: 'At least one active item', help: 'Add items under Products and set their status to Active.' },
  ];
  const open = items.filter((x) => !x.ok && x.required).length;
  return (
    <AdminShell base={base} current="/launch" email={admin.email} title="Launch checklist">
      <p>{open === 0 ? 'Everything required is in place.' : `${open} required ${open === 1 ? 'item is' : 'items are'} still open.`} Have the legal pages read by a lawyer before taking real orders.</p>
      <ul className="stack">
        {items.map((x) => (
          <li key={x.label} className="panel glass stack--sm">
            <p className="row"><span className={`tag ${x.ok ? 'tag--ok' : x.required ? 'tag--error' : 'tag--plain'}`}>{x.ok ? 'Done' : x.required ? 'Needed' : 'Optional'}</span> <strong>{x.label}</strong></p>
            {x.ok ? null : <p className="small muted">{x.help}</p>}
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
