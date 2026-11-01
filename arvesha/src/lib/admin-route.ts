import { audit } from './audit';
import { adminBase, getAdmin, type AdminUser } from './admin-auth';
import { env } from './env';
import { assertSameOrigin, errorResponse, getClientIp, getUserAgent, HttpError, json } from './http';
import { consume } from './ratelimit';
import { parse, type Schema } from './validate';

// Wrapper for every admin JSON/multipart API route. In order it enforces:
// the secret-path gate, same-origin, a per-IP rate limit, an optional IP allow-list, a signed-in admin,
// a body size cap and schema validation. Failures are generic and never leak internals.

export interface AdminRouteOptions<B> {
  /** Sign-in itself has no admin yet. Everything else leaves this off. */
  public?: boolean;
  body?: Schema<B>;
  /** For file uploads: the handler reads req.formData() itself. */
  multipart?: boolean;
  maxBytes?: number;
  /** Requests per minute per IP. Default 240. */
  perMinute?: number;
}

export interface AdminCtx<B> {
  req: Request;
  ip: string;
  ua: string;
  admin: AdminUser;
  base: string;
  body: B;
  query: URLSearchParams;
  params: Record<string, string>;
  /** Writes an audit log entry for this admin. */
  log: (action: string, entity?: string, entityId?: string, meta?: Record<string, unknown>) => Promise<void>;
}

type NextRouteContext = { params?: Promise<Record<string, string>> };
type Result = Response | Record<string, unknown> | void;

function ipAllowed(ip: string): boolean {
  const list = (env('ADMIN_IP_ALLOWLIST') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length === 0 || list.includes(ip);
}

export function adminRoute<B = undefined>(opts: AdminRouteOptions<B>, fn: (ctx: AdminCtx<B>) => Promise<Result>) {
  return async function handler(req: Request, routeCtx?: NextRouteContext): Promise<Response> {
    const started = Date.now();
    try {
      const base = await adminBase();
      if (!base) throw new HttpError(404, 'not_found', 'Not found.');
      assertSameOrigin(req);

      const ip = getClientIp(req);
      const ua = getUserAgent(req);
      if (!ipAllowed(ip)) throw new HttpError(404, 'not_found', 'Not found.');

      const rl = await consume('admin-api', ip, opts.perMinute ?? 240, 60);
      if (!rl.allowed) throw new HttpError(429, 'rate_limited', 'Too many requests. Wait a moment.', undefined, { 'Retry-After': String(rl.retryAfterSec) });

      let admin: AdminUser | null = null;
      if (!opts.public) {
        admin = await getAdmin();
        if (!admin) throw new HttpError(401, 'auth_required', 'Your session has ended. Sign in again.');
      }

      let body: unknown = undefined;
      const method = req.method.toUpperCase();
      if (opts.body && method !== 'GET' && method !== 'HEAD') {
        const type = (req.headers.get('content-type') ?? '').toLowerCase();
        if (!type.startsWith('application/json')) throw new HttpError(415, 'unsupported', 'Unsupported request.');
        const text = await req.text();
        if (text.length > (opts.maxBytes ?? 256 * 1024)) throw new HttpError(413, 'too_large', 'That request is too large.');
        let raw: unknown;
        try {
          raw = text ? JSON.parse(text) : {};
        } catch {
          throw new HttpError(400, 'bad_json', 'Invalid request.');
        }
        body = parse(opts.body, raw);
      }

      const url = new URL(req.url);
      const params = (await routeCtx?.params) ?? {};
      const ctx: AdminCtx<B> = {
        req,
        ip,
        ua,
        admin: admin as AdminUser,
        base,
        body: body as B,
        query: url.searchParams,
        params,
        log: (action, entity, entityId, meta) =>
          audit({ adminId: admin?.id ?? null, adminEmail: admin?.email ?? null, action, entity, entityId, meta, ip }),
      };
      const result = await fn(ctx);
      if (result instanceof Response) return result;
      return json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err, req, started);
    }
  };
}
