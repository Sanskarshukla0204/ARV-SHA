import { integrationStatus, isLocalSite, siteUrl } from '../src/lib/env';

// Usage: npm run launch:check  (reads the environment of the shell it runs in)
const i = integrationStatus();
const rows: [boolean, string, boolean][] = [
  [i.database, 'DATABASE_URL', true],
  [i.appSecret, 'APP_SECRET (32+ characters)', true],
  [i.passwordPepper, 'PASSWORD_PEPPER (32+ characters)', true],
  [i.dataEncryptionKey, 'DATA_ENCRYPTION_KEY', true],
  [i.adminPath, 'ADMIN_PATH', true],
  [i.resend, 'RESEND_API_KEY and MAIL_FROM', true],
  [i.turnstile, 'TURNSTILE_SECRET_KEY and NEXT_PUBLIC_TURNSTILE_SITE_KEY', true],
  [i.razorpay, 'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET', true],
  [i.razorpayWebhook, 'RAZORPAY_WEBHOOK_SECRET', true],
  [i.blobStorage, 'BLOB_READ_WRITE_TOKEN', true],
  [i.cronSecret, 'CRON_SECRET', true],
  [!isLocalSite(), `NEXT_PUBLIC_SITE_URL is a custom domain (now ${siteUrl()})`, true],
  [i.truecaller, 'TRUECALLER_APP_KEY and TRUECALLER_APP_NAME', false],
  [i.sms, 'MSG91_AUTH_KEY and MSG91_TEMPLATE_ID', false],
];
let missing = 0;
for (const [ok, label, required] of rows) {
  console.log(`${ok ? 'ok      ' : required ? 'MISSING ' : 'optional '} ${label}`);
  if (!ok && required) missing++;
}
console.log(missing === 0 ? '\nAll required settings are present.' : `\n${missing} required setting(s) missing.`);
process.exit(missing === 0 ? 0 : 1);
