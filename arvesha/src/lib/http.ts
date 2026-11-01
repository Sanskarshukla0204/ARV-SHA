import { appHmac, safeEqual } from './crypto';
import { env, isProd, siteUrl } from './env';
import { consume, type Limit } from './ratelimit';
import { getSessionUser, type SessionUser } from './session';
import { parse, ValidationError, type Schema } from './validate';
import { verifyTurnstile } from './turnstile';

// Every JSON API route in the storefront is built with route(). It enforces, in this order:
// same-origin check, per-IP rate limits, JSON body size and type, input validation, Turnstile,
// authentication, then your handler. Failures return generic messages and never a stack trace.

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
    readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const GENERIC_AUTH_ERROR = 'The details you entered are not correct.';
export const GENERIC_SERVER_ERROR = 'Something went wrong on our side. Please try again.';

const NO_STORE = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...NO_STORE, ...headers },
  });
}

export function getClientIp(req: Request): string {
  const h = req.headers;
  const raw = h.get('x-vercel-forwarded-for') ?? h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  const ip = raw.trim().slice(0, 64);
  return /^[0-9a-fA-F:.]+$/.test(ip) ? ip : 'unknown';
}

export function getUserAgent(req: Request): string {
  return (req.headers.get('user-agent') ?? '').slice(0, 300);
}

/** Opaque, non-reversible bucket for an identifier such as an email, for rate limiting without storing it. */
export function bucket(identifier: string): string {
  return appHmac(`bucket:${identifier.toLowerCase()}`).slice(0, 32);
}

/**
 * CSRF defence for cookie-authenticated requests: the Origin (or Referer) header of a state-changing
 * request must match the host the request was sent to. Combined with SameSite cookies and
 * JSON-only bodies this blocks cross-site request forgery.
 */
export function assertSameOrigin(req: Request): void {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const source = req.headers.get('origin') ?? req.headers.get('referer');
  if (!host || !source) throw new HttpError(403, 'forbidden', 'This request was blocked.');
  let sourceHost: string;
  try {
    sourceHost = new URL(source).host;
  } catch {
    throw new HttpError(403, 'forbidden', 'This request was blocked.');
  }
  const allowed = new Set([host]);
  try {
    allowed.add(new URL(siteUrl()).host);
  } catch {
    /* ignore */
  }
  if (!allowed.has(sourceHost)) throw new HttpError(403, 'forbidden', 'This request was blocked.');
}

export interface RouteOptions<B> {
  /** 'user' requires a signed-in customer. Default 'none'. */
  auth?: 'none' | 'user';
  /** Require a verified email or a verified mobile number. */
  verifiedContact?: boolean;
  body?: Schema<B>;
  /** Per-IP limits. */
  limits?: Limit[];
  /** Per-customer limits (only applied when auth is 'user'). */
  userLimits?: Limit[];
  /** Require a valid Cloudflare Turnstile token in the body field `turnstileToken`. */
  turnstile?: boolean;
  /** Skip the Origin check, for server-to-server callbacks that authenticate another way. */
  skipOriginCheck?: boolean;
  /** Maximum request body in bytes. Default 64 KB. */
  maxBytes?: number;
}

export interface RouteCtx<B> {
  req: Request;
  ip: string;
  ua: string;
  user: SessionUser | null;
  body: B;
  query: URLSearchParams;
  params: Record<string, string>;
}

type NextRouteContext = { params?: Promise<Record<string, string>> };
type Result = Response | Record<string, unknown> | void;

export function route<B = undefined>(opts: RouteOptions<B>, fn: (ctx: RouteCtx<B> & { user: SessionUser | null }) => Promise<Result>) {
     return async function handler(req: Request, routeCtx: { params: Promise<Record<string, string>> } = { params: Promise.resolve({}) }): Promise<Response> {
    const started = Date.now();
    try {
      if (!opts.skipOriginCheck) assertSameOrigin(req);

      const ip = getClientIp(req);
      const ua = getUserAgent(req);

      for (const l of opts.limits ?? []) {
        const r = await consume(l.name, ip, l.max, l.windowSec);
        if (!r.allowed) {
          throw new HttpError(429, 'rate_limited', 'Too many attempts. Please wait a moment and try again.', undefined, {
            'Retry-After': String(r.retryAfterSec),
          });
        }
      }

      let raw: unknown = undefined;
      const method = req.method.toUpperCase();
      if (method !== 'GET' && method !== 'HEAD' && opts.body) {
        const type = req.headers.get('content-type') ?? '';
        if (!type.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'unsupported', 'Unsupported request.');
        const text = await req.text();
        if (text.length > (opts.maxBytes ?? 64 * 1024)) throw new HttpError(413, 'too_large', 'That request is too large.');
        try {
          raw = text ? JSON.parse(text) : {};
        } catch {
          throw new HttpError(400, 'bad_json', 'Invalid request.');
        }
      }

      let turnstileToken: unknown;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        turnstileToken = (raw as Record<string, unknown>).turnstileToken;
        delete (raw as Record<string, unknown>).turnstileToken;
      }

      const body = (opts.body ? parse(opts.body, raw) : undefined) as B;

      if (opts.turnstile) {
        const human = await verifyTurnstile(turnstileToken, ip);
        if (!human) throw new HttpError(400, 'captcha', 'Please complete the security check and try again.');
      }

      let user: SessionUser | null = null;
      if (opts.auth === 'user') {
        user = await getSessionUser();
        if (!user) throw new HttpError(401, 'auth_required', 'Please sign in to continue.');
        for (const l of opts.userLimits ?? []) {
          const r = await consume(l.name, user.id, l.max, l.windowSec);
          if (!r.allowed) {
            throw new HttpError(429, 'rate_limited', 'Too many attempts. Please wait a moment and try again.', undefined, {
              'Retry-After': String(r.retryAfterSec),
            });
          }
        }
        if (opts.verifiedContact && !user.emailVerified && !user.phoneVerified) {
          throw new HttpError(403, 'verification_required', 'Verify your email or mobile number to continue.');
        }
      } else {
        user = await getSessionUser().catch(() => null);
      }

      const url = new URL(req.url);
      const params = (await routeCtx?.params) ?? {};
      const result = await fn({ req, ip, ua, user, body, query: url.searchParams, params });
      if (result instanceof Response) return result;
      return json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err, req, started);
    }
  };
}

export function errorResponse(err: unknown, req: Request, started = Date.now()): Response {
  if (err instanceof ValidationError) {
    return json({ error: { code: 'validation', message: err.message, fields: err.fields } }, 422);
  }
  if (err instanceof HttpError) {
    return json({ error: { code: err.code, message: err.message, fields: err.fields } }, err.status, err.headers);
  }
  // Unknown failure: log details on the server only.
  const path = (() => {
    try {
      return new URL(req.url).pathname;
    } catch {
      return 'unknown';
    }
  })();
  console.error(`[api] ${req.method} ${path} failed after ${Date.now() - started}ms:`, isProd ? (err as Error)?.message : err);
  return json({ error: { code: 'server_error', message: GENERIC_SERVER_ERROR } }, 500);
}

/** Cron endpoints accept only the secret Vercel Cron (or your scheduler) sends as a Bearer token. */
export function assertCronAuth(req: Request): void {
  const secret = env('CRON_SECRET');
  const header = req.headers.get('authorization') ?? '';
  if (!secret || secret.length < 16 || !safeEqual(header, `Bearer ${secret}`)) {
    throw new HttpError(404, 'not_found', 'Not found.');
  }
}
