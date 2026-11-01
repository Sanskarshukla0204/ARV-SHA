import { esc, formatINR } from './format';
import { SITE, absoluteUrl } from './site';

export interface Mail {
  subject: string;
  html: string;
  text: string;
}

const INK = '#50514F';
const INK_STRONG = '#262726';
const BLUE = '#247BA0';
const CREAM = '#FFE7C2';
const SAGE = '#E4E9DF';

function shell(preheader: string, bodyHtml: string): string {
  const logo = absoluteUrl('/brand/logo-email.png');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(SITE.name)}</title></head>
<body style="margin:0;padding:0;background:#FFFCFF;color:${INK};font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFCFF;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border:1px solid #E1E4DC;border-radius:14px;overflow:hidden;background:#FFFFFF;">
<tr><td align="center" style="background:${CREAM};padding:22px 16px;"><a href="${esc(absoluteUrl('/'))}"><img src="${esc(logo)}" alt="${esc(SITE.name)}" width="220" style="display:block;border:0;height:auto;max-width:220px;"></a></td></tr>
<tr><td style="padding:28px 28px 8px 28px;">${bodyHtml}</td></tr>
<tr><td style="padding:8px 28px 28px 28px;color:#6F706D;font-size:13px;">You are receiving this email because of activity on your ${esc(SITE.name)} account or order. If this was not you, reply to this email or contact support.</td></tr>
</table></td></tr></table></body></html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;"><tr><td style="border:2px solid ${BLUE};border-radius:999px;"><a href="${esc(href)}" style="display:inline-block;padding:12px 26px;color:${BLUE};font-weight:600;text-decoration:none;">${esc(label)}</a></td></tr></table>`;
}

const h1 = (t: string) => `<h1 style="margin:0 0 12px 0;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:28px;line-height:1.2;color:${INK_STRONG};">${esc(t)}</h1>`;
const p = (t: string) => `<p style="margin:0 0 14px 0;">${t}</p>`;

export function verifyEmailMail(a: { name: string; link: string; hours: number }): Mail {
  return {
    subject: `Confirm your email for ${SITE.name}`,
    html: shell(
      'Confirm your email address',
      h1('Confirm your email') +
        p(`Hi ${esc(a.name.split(' ')[0])}, confirm this address to finish setting up your account and to receive order updates.`) +
        button(a.link, 'Confirm email') +
        p(`The link works for ${a.hours} hours. If the button does not open, copy this address into your browser:<br><span style="word-break:break-all;color:${BLUE};">${esc(a.link)}</span>`),
    ),
    text: `Hi ${a.name.split(' ')[0]},\n\nConfirm your email address for ${SITE.name}:\n${a.link}\n\nThe link works for ${a.hours} hours. If you did not create an account, ignore this message.`,
  };
}

export function resetPasswordMail(a: { name: string; link: string; minutes: number }): Mail {
  return {
    subject: `Reset your ${SITE.name} password`,
    html: shell(
      'Reset your password',
      h1('Reset your password') +
        p(`Hi ${esc(a.name.split(' ')[0])}, we received a request to reset the password for your account.`) +
        button(a.link, 'Choose a new password') +
        p(`The link works for ${a.minutes} minutes and can be used once. If you did not ask for this, you can ignore this email and your password will stay the same.`),
    ),
    text: `Hi ${a.name.split(' ')[0]},\n\nReset your ${SITE.name} password:\n${a.link}\n\nThe link works for ${a.minutes} minutes and can be used once. If you did not ask for this, ignore this email.`,
  };
}

export function passwordChangedMail(a: { name: string }): Mail {
  return {
    subject: `Your ${SITE.name} password was changed`,
    html: shell(
      'Your password was changed',
      h1('Your password was changed') +
        p(`Hi ${esc(a.name.split(' ')[0])}, the password for your account was just changed and you were signed out of other devices.`) +
        p('If you did this, no action is needed. If you did not, reset your password now and contact support.') +
        button(absoluteUrl('/forgot-password'), 'Reset password'),
    ),
    text: `Hi ${a.name.split(' ')[0]},\n\nThe password for your ${SITE.name} account was just changed and other devices were signed out.\nIf this was not you, reset it now: ${absoluteUrl('/forgot-password')}`,
  };
}

export interface OrderMail {
  number: string;
  name: string;
  items: { name: string; size: string; color: string; qty: number; lineTotalPaise: number }[];
  subtotalPaise: number;
  shippingPaise: number;
  discountPaise?: number;
  totalPaise: number;
  address: { name: string; line1: string; line2?: string | null; city: string; state: string; pincode: string; phone: string };
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
}

function itemsTable(o: OrderMail): string {
  const rows = o.items
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #E1E4DC;">${esc(i.name)}<br><span style="color:#6F706D;font-size:14px;">${esc([i.size, i.color].filter(Boolean).join(' / '))} x ${i.qty}</span></td><td align="right" style="padding:8px 0;border-bottom:1px solid #E1E4DC;white-space:nowrap;">${esc(formatINR(i.lineTotalPaise))}</td></tr>`,
    )
    .join('');
  const line = (label: string, v: string, strong = false) =>
    `<tr><td style="padding:4px 0;${strong ? 'font-weight:700;color:' + INK_STRONG + ';' : ''}">${esc(label)}</td><td align="right" style="padding:4px 0;${strong ? 'font-weight:700;color:' + INK_STRONG + ';' : ''}">${esc(v)}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px 0;">${rows}
<tr><td colspan="2" style="height:8px;"></td></tr>
${line('Subtotal', formatINR(o.subtotalPaise))}
${o.discountPaise ? line('Discount', `-${formatINR(o.discountPaise)}`) : ''}
${line('Shipping', o.shippingPaise === 0 ? 'Free' : formatINR(o.shippingPaise))}
${line('Total paid', formatINR(o.totalPaise), true)}
</table>`;
}

function addressBlock(a: OrderMail['address']): string {
  return `<p style="margin:0 0 14px 0;background:${SAGE};border-radius:10px;padding:12px 14px;">${esc(a.name)}<br>${esc(a.line1)}${a.line2 ? '<br>' + esc(a.line2) : ''}<br>${esc(a.city)}, ${esc(a.state)} ${esc(a.pincode)}<br>${esc(a.phone)}</p>`;
}

function addressText(a: OrderMail['address']): string {
  return `${a.name}\n${a.line1}${a.line2 ? '\n' + a.line2 : ''}\n${a.city}, ${a.state} ${a.pincode}\n${a.phone}`;
}

function itemsText(o: OrderMail): string {
  return (
    o.items.map((i) => `- ${i.name} (${[i.size, i.color].filter(Boolean).join(' / ')}) x ${i.qty}: ${formatINR(i.lineTotalPaise)}`).join('\n') +
    `\n\nSubtotal: ${formatINR(o.subtotalPaise)}\nShipping: ${o.shippingPaise === 0 ? 'Free' : formatINR(o.shippingPaise)}\nTotal paid: ${formatINR(o.totalPaise)}`
  );
}

export function orderPlacedMail(o: OrderMail): Mail {
  const link = absoluteUrl(`/account/orders/${o.number}`);
  return {
    subject: `Order ${o.number} confirmed`,
    html: shell(
      `Your order ${o.number} is confirmed`,
      h1('Thank you, your order is confirmed') +
        p(`Order <strong>${esc(o.number)}</strong>. We have received your payment and will send another email when it ships.`) +
        itemsTable(o) +
        p('<strong>Delivering to</strong>') +
        addressBlock(o.address) +
        button(link, 'View order'),
    ),
    text: `Hi ${o.name.split(' ')[0]},\n\nYour order ${o.number} is confirmed. We have received your payment.\n\n${itemsText(o)}\n\nDelivering to:\n${addressText(o.address)}\n\nView order: ${link}`,
  };
}

export type OrderStatusKind = 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

export function orderStatusMail(o: OrderMail, kind: OrderStatusKind, extra?: { refundPaise?: number; reason?: string }): Mail {
  const link = absoluteUrl(`/account/orders/${o.number}`);
  const copy: Record<OrderStatusKind, { subject: string; title: string; body: string }> = {
    processing: { subject: `Order ${o.number} is being prepared`, title: 'We are preparing your order', body: 'Your items are being packed. You will get another email with tracking details once the parcel is handed to the courier.' },
    shipped: { subject: `Order ${o.number} has shipped`, title: 'Your order is on its way', body: 'Your parcel has been handed to the courier.' },
    delivered: { subject: `Order ${o.number} was delivered`, title: 'Your order was delivered', body: 'If something is not right with your items, you can start a return or exchange from your order page within the return window.' },
    cancelled: { subject: `Order ${o.number} was cancelled`, title: 'Your order was cancelled', body: extra?.reason ? `Reason: ${extra.reason}` : 'Your order was cancelled. If you paid, the refund is being processed to the original payment method.' },
    refunded: { subject: `Refund for order ${o.number}`, title: 'Your refund was issued', body: `We refunded ${formatINR(extra?.refundPaise ?? o.totalPaise)} to your original payment method. Banks usually take 5 to 7 business days to show it.` },
  };
  const c = copy[kind];
  const tracking =
    kind === 'shipped' && (o.carrier || o.trackingNumber)
      ? p(`<strong>Courier:</strong> ${esc(o.carrier ?? 'Not provided')}<br><strong>Tracking number:</strong> ${esc(o.trackingNumber ?? 'Not provided')}`) +
        (o.trackingUrl ? button(o.trackingUrl, 'Track parcel') : '')
      : '';
  return {
    subject: c.subject,
    html: shell(c.subject, h1(c.title) + p(`Order <strong>${esc(o.number)}</strong>`) + p(esc(c.body)) + tracking + button(link, 'View order')),
    text: `Hi ${o.name.split(' ')[0]},\n\n${c.title}. Order ${o.number}.\n${c.body}\n${
      kind === 'shipped' ? `Courier: ${o.carrier ?? 'n/a'}\nTracking number: ${o.trackingNumber ?? 'n/a'}${o.trackingUrl ? '\nTrack: ' + o.trackingUrl : ''}\n` : ''
    }\nView order: ${link}`,
  };
}

export function supportReceiptMail(a: { name: string; reference: string }): Mail {
  return {
    subject: `We received your message (${a.reference})`,
    html: shell(
      'We received your message',
      h1('We received your message') +
        p(`Hi ${esc(a.name.split(' ')[0])}, your message is in our queue with reference <strong>${esc(a.reference)}</strong>. Reply to this email if you want to add anything.`),
    ),
    text: `Hi ${a.name.split(' ')[0]},\n\nWe received your message. Your reference is ${a.reference}. Reply to this email if you want to add anything.`,
  };
}

export function supportNotifyMail(a: { reference: string; name: string; email: string; phone?: string | null; orderNumber?: string | null; topic: string; message: string }): Mail {
  return {
    subject: `[Support ${a.reference}] ${a.topic}`,
    html: shell(
      `New support message ${a.reference}`,
      h1('New support message') +
        p(`<strong>${esc(a.name)}</strong> (${esc(a.email)}${a.phone ? ', ' + esc(a.phone) : ''})${a.orderNumber ? '<br>Order: ' + esc(a.orderNumber) : ''}<br>Topic: ${esc(a.topic)}`) +
        `<p style="margin:0 0 14px 0;white-space:pre-wrap;background:${SAGE};border-radius:10px;padding:12px 14px;">${esc(a.message)}</p>`,
    ),
    text: `${a.name} <${a.email}>${a.phone ? ' ' + a.phone : ''}\nTopic: ${a.topic}${a.orderNumber ? '\nOrder: ' + a.orderNumber : ''}\n\n${a.message}`,
  };
}

export function phoneCodeText(code: string): string {
  return `${code} is your ${SITE.shortName} verification code. It expires in 10 minutes. Do not share it with anyone.`;
}
