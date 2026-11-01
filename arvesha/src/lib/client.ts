'use client';

// Browser helpers for talking to the JSON API. Server errors arrive as { error: { code, message, fields } }.

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export async function api<T = Record<string, unknown>>(
  url: string,
  opts: { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown } = {},
): Promise<T> {
  const method = opts.method ?? (opts.body !== undefined ? 'POST' : 'GET');
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiRequestError(0, 'network', 'We could not reach the server. Check your connection and try again.');
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non JSON body */
  }
  if (!res.ok) {
    const e = data?.error ?? {};
    throw new ApiRequestError(res.status, e.code ?? 'error', e.message ?? 'Something went wrong. Please try again.', e.fields ?? {});
  }
  return data as T;
}

/** Turns a thrown error into a message safe to show. */
export function errorMessage(err: unknown): string {
  return err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.';
}

/** Only same-site relative paths, to keep "next" parameters from becoming open redirects. */
export function safeNextClient(next: string | null | undefined, fallback = '/account'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\') || next.includes('://')) return fallback;
  return next;
}
