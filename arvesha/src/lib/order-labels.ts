import type { OrderStatus, PaymentStatus } from './orders';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: 'Awaiting payment',
  new: 'Confirmed',
  processing: 'Being packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

export const STATUS_TAG: Record<OrderStatus, string> = {
  pending_payment: 'tag--warn',
  new: 'tag--info',
  processing: 'tag--info',
  shipped: 'tag--info',
  delivered: 'tag--ok',
  cancelled: 'tag--error',
  expired: 'tag--plain',
};

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  paid: 'Paid',
  failed: 'Payment failed',
  partially_refunded: 'Partly refunded',
  refunded: 'Refunded',
};

export const PAYMENT_TAG: Record<PaymentStatus, string> = {
  unpaid: 'tag--plain',
  paid: 'tag--ok',
  failed: 'tag--error',
  partially_refunded: 'tag--warn',
  refunded: 'tag--info',
};

export function humanizeEvent(type: string): string {
  const s = type.replace(/[._]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Device label from a user agent string. Only broad family names are shown. */
export function describeDevice(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'unknown system';
  return `${browser} on ${os}`;
}
