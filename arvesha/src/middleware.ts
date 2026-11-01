import { NextResponse, type NextRequest } from 'next/server';

// Runs on every page and API request (not on static files).
//  1. Builds a Content-Security-Policy with a fresh nonce, so only scripts this server rendered can run.
//  2. Guards the admin panel. The panel lives in an internal route that is only reachable by rewriting the secret
//     path in ADMIN_PATH. /admin, the internal route and a wrong secret all return the same ordinary 404.
//     If ADMIN_PATH is not set the panel is switched off completely.

const INTERNAL_ADMIN = '/admin-internal';
const INTERNAL_ADMIN_API = '/api/admin-internal';
const NOT_FOUND_PATH = '/__not_found__';

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sign(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}

function clientIp(req: NextRequest): string {
  return (req.headers.get('x-vercel-forwarded-for') ?? req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0] ?? '').trim();
}

function buildCsp(nonce: string, isDev: boolean): string {
  const blob = 'https://*.public.blob.vercel-storage.com';
  const directives = [
    `default-src 'self'`,
    // 'strict-dynamic' lets the nonce-approved scripts load their own dependencies (Turnstile, Razorpay).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com https://checkout.razorpay.com${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: ${blob} https://*.razorpay.com`,
    `font-src 'self' data:`,
    `connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://checkout.razorpay.com https://challenges.cloudflare.com${isDev ? ' ws:' : ''}`,
    `frame-src https://challenges.cloudflare.com https://api.razorpay.com https://checkout.razorpay.com`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
  ];
  if (!isDev) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

function notFound(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = NOT_FOUND_PATH;
  url.search = '';
  const res = NextResponse.rewrite(url, { status: 404 });
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('X-Robots-Tag', 'noindex');
  return res;
}

export async function middleware(req: NextRequest) {
  const isDev = process.env.NODE_ENV !== 'production';
  const { pathname } = req.nextUrl;

  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce, isDev);

  // Never trust these headers from the outside; only this function may set them.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.delete('x-admin-base');
  requestHeaders.delete('x-admin-sig');
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  const secret = (process.env.ADMIN_PATH ?? '').trim();
  const secretOk = /^[a-z0-9][a-z0-9-]{10,62}[a-z0-9]$/.test(secret);
  const appSecret = (process.env.APP_SECRET ?? '').trim();
  const adminBase = secretOk ? `/${secret}` : null;

  const reaching = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

  // The internal routes are never reachable directly.
  if (reaching(INTERNAL_ADMIN) || reaching(INTERNAL_ADMIN_API) || reaching(NOT_FOUND_PATH)) {
    return notFound(req);
  }

  let response: NextResponse;
  if (adminBase && (reaching(adminBase) || reaching(`/api${adminBase}`))) {
    if (!appSecret || appSecret.length < 32) return notFound(req);
    const allow = (process.env.ADMIN_IP_ALLOWLIST ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (allow.length > 0 && !allow.includes(clientIp(req))) return notFound(req);

    const isApi = reaching(`/api${adminBase}`);
    const rest = pathname.slice((isApi ? `/api${adminBase}` : adminBase).length);
    const target = req.nextUrl.clone();
    target.pathname = `${isApi ? INTERNAL_ADMIN_API : INTERNAL_ADMIN}${rest}`;

    requestHeaders.set('x-admin-base', adminBase);
    requestHeaders.set('x-admin-sig', await sign(appSecret, `admin-gate:${adminBase}`));
    response = NextResponse.rewrite(target, { request: { headers: requestHeaders } });
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    response.headers.set('Referrer-Policy', 'no-referrer');
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    // No prefetch exclusion on purpose: the admin gate must run for every request that reaches the server.
    '/((?!_next/static|_next/image|favicon.ico|apple-touch-icon.png|brand/|uploads/|robots.txt|sitemap.xml|manifest.webmanifest).*)',
  ],
};
