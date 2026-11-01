import { SettingsForm } from '@/components/admin/AdminForms';
import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdmin } from '@/lib/admin-auth';
import { getSettings } from '@/lib/settings';

export default async function AdminSettings() {
  const { admin, base } = await requireAdmin();
  const s = await getSettings();
  const rupees = (p: number) => (p % 100 === 0 ? String(p / 100) : (p / 100).toFixed(2));
  return (
    <AdminShell base={base} current="/settings" email={admin.email} title="Store settings">
      <p className="muted">These values feed the legal pages, the help centre, checkout and shipping. Fill in your registered business details before launch.</p>
      <SettingsForm
        base={base}
        initial={{
          legalName: s.business.legalName, address: s.business.address, gstin: s.business.gstin, supportEmail: s.business.supportEmail, supportPhone: s.business.supportPhone,
          grievanceName: s.business.grievanceName, grievanceEmail: s.business.grievanceEmail, grievancePhone: s.business.grievancePhone,
          flat: rupees(s.shipping.flatPaise), freeAbove: s.shipping.freeAbovePaise == null ? '' : rupees(s.shipping.freeAbovePaise),
          dispatchDays: String(s.shipping.dispatchDays), deliveryMinDays: String(s.shipping.deliveryMinDays), deliveryMaxDays: String(s.shipping.deliveryMaxDays),
          returnWindowDays: String(s.policies.returnWindowDays), cancelBeforeDispatch: s.policies.cancelBeforeDispatch, refundDays: String(s.policies.refundDays),
          requireVerifiedPhone: s.checkout.requireVerifiedPhone, maxOrder: rupees(s.checkout.maxOrderPaise),
        }}
      />
    </AdminShell>
  );
}
