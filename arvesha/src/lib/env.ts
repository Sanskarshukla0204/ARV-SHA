// Environment access. Everything is read lazily so a missing optional integration never crashes the build.

export const isProd = process.env.NODE_ENV === 'production';

export function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== '' ? v.trim() : undefined;
}

export function requireEnv(name: string): string {
  const v = env(name);
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

/** Public origin of the site, no trailing slash. Set NEXT_PUBLIC_SITE_URL to your custom domain. */
export function siteUrl(): string {
  return (env('NEXT_PUBLIC_SITE_URL') ?? 'http://localhost:3000').replace(/\/+$/, '');
}

/** True while the site is still on localhost or a *.vercel.app address, i.e. no custom domain yet. */
export function isLocalSite(): boolean {
  try {
    const h = new URL(siteUrl()).hostname;
    return h === 'localhost' || h === '127.0.0.1' || h.endsWith('.vercel.app');
  } catch {
    return true;
  }
}

/** Secret path segment for the admin panel. Must be 12 to 64 chars of a-z, 0-9 and hyphen. */
export function adminPath(): string | null {
  const p = env('ADMIN_PATH');
  if (!p) return null;
  return /^[a-z0-9][a-z0-9-]{10,62}[a-z0-9]$/.test(p) ? p : null;
}

export function integrationStatus() {
  return {
    database: !!env('DATABASE_URL'),
    appSecret: (env('APP_SECRET')?.length ?? 0) >= 32,
    passwordPepper: (env('PASSWORD_PEPPER')?.length ?? 0) >= 32,
    dataEncryptionKey: !!env('DATA_ENCRYPTION_KEY'),
    adminPath: !!adminPath(),
    resend: !!env('RESEND_API_KEY') && !!env('MAIL_FROM'),
    turnstile: !!env('TURNSTILE_SECRET_KEY') && !!env('NEXT_PUBLIC_TURNSTILE_SITE_KEY'),
    razorpay: !!env('RAZORPAY_KEY_ID') && !!env('RAZORPAY_KEY_SECRET'),
    razorpayWebhook: !!env('RAZORPAY_WEBHOOK_SECRET'),
    truecaller: !!env('TRUECALLER_APP_KEY') && !!env('TRUECALLER_APP_NAME'),
    blobStorage: !!env('BLOB_READ_WRITE_TOKEN'),
    sms: !!env('MSG91_AUTH_KEY') && !!env('MSG91_TEMPLATE_ID'),
    cronSecret: (env('CRON_SECRET')?.length ?? 0) >= 16,
  };
}
