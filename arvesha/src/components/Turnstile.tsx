'use client';

import { useEffect, useRef } from 'react';

// Cloudflare Turnstile. Set NEXT_PUBLIC_TURNSTILE_SITE_KEY (and TURNSTILE_SECRET_KEY on the server).
// Tokens work once. Increase `resetKey` after a failed submit to get a fresh challenge.

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
    __arvTurnstileLoading?: Promise<void>;
  }
}

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (window.__arvTurnstileLoading) return window.__arvTurnstileLoading;
  window.__arvTurnstileLoading = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      window.__arvTurnstileLoading = undefined;
      reject(new Error('Turnstile failed to load'));
    };
    document.head.appendChild(s);
  });
  return window.__arvTurnstileLoading;
}

export function Turnstile({ onToken, resetKey = 0 }: { onToken: (token: string) => void; resetKey?: number }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const holder = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    if (!siteKey || !holder.current) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !holder.current || !window.turnstile) return;
        widget.current = window.turnstile.render(holder.current, {
          sitekey: siteKey,
          theme: 'light',
          size: 'flexible',
          callback: (t: string) => cb.current(t),
          'expired-callback': () => cb.current(''),
          'error-callback': () => cb.current(''),
        });
      })
      .catch(() => cb.current(''));
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetKey > 0 && widget.current && window.turnstile) {
      cb.current('');
      window.turnstile.reset(widget.current);
    }
  }, [resetKey]);

  if (!siteKey) return null;
  return <div ref={holder} aria-label="Security check" style={{ minHeight: 65 }} />;
}
