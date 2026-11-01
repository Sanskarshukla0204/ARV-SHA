import { cache } from 'react';
import { db } from './db';
import { env } from './env';

// Store settings live in the `settings` table so the owner can change them in the admin panel
// without a redeploy. Defaults below keep the site working before anything is configured.

export interface StoreSettings {
  business: {
    legalName: string;
    address: string;
    gstin: string;
    supportEmail: string;
    supportPhone: string;
    grievanceName: string;
    grievanceEmail: string;
    grievancePhone: string;
  };
  shipping: {
    flatPaise: number; // shipping fee for orders below the free threshold
    freeAbovePaise: number | null; // null means shipping is never free
    dispatchDays: number; // business days to hand an order to the courier
    deliveryMinDays: number;
    deliveryMaxDays: number;
  };
  policies: {
    returnWindowDays: number; // days after delivery to request a return or exchange
    cancelBeforeDispatch: boolean;
    refundDays: number; // business days to refund after a return is received
  };
  checkout: {
    requireVerifiedPhone: boolean; // needs an SMS provider; off by default
    maxOrderPaise: number;
  };
}

export const DEFAULT_SETTINGS: StoreSettings = {
  business: {
    legalName: '',
    address: '',
    gstin: '',
    supportEmail: '',
    supportPhone: '',
    grievanceName: '',
    grievanceEmail: '',
    grievancePhone: '',
  },
  shipping: { flatPaise: 0, freeAbovePaise: null, dispatchDays: 3, deliveryMinDays: 4, deliveryMaxDays: 8 },
  policies: { returnWindowDays: 7, cancelBeforeDispatch: true, refundDays: 7 },
  checkout: { requireVerifiedPhone: false, maxOrderPaise: 5_000_000 }, // Rs 50,000 per online order
};

function merge<T>(base: T, patch: unknown): T {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (!(k in out)) continue;
    const cur = out[k];
    if (cur !== null && typeof cur === 'object' && !Array.isArray(cur)) out[k] = merge(cur, v);
    else if (typeof v === typeof cur || cur === null || v === null) out[k] = v;
  }
  return out as T;
}

/** All settings, merged over the defaults. Cached per request. */
export const getSettings = cache(async (): Promise<StoreSettings> => {
  let rows: { key: string; value: unknown }[] = [];
  try {
    rows = await db.query<{ key: string; value: unknown }>(`SELECT key, value FROM settings`);
  } catch {
    // Database not reachable (for example during a build): fall back to defaults.
  }
  let s = DEFAULT_SETTINGS;
  for (const r of rows) s = merge(s, { [r.key]: r.value });
  // Environment variables fill business contact details that were never set in the admin panel.
  s = {
    ...s,
    business: {
      ...s.business,
      supportEmail: s.business.supportEmail || env('SUPPORT_EMAIL') || '',
    },
  };
  return s;
});

export async function saveSetting<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]): Promise<void> {
  await db.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
}

/** Shipping fee for a given merchandise subtotal, in paise. */
export function shippingFor(subtotalPaise: number, s: StoreSettings['shipping']): number {
  if (s.freeAbovePaise !== null && subtotalPaise >= s.freeAbovePaise) return 0;
  return s.flatPaise;
}
