import { db } from '@/lib/db';
import { randomFromAlphabet } from '@/lib/crypto';
import { env } from '@/lib/env';
import { supportNotifyMail, supportReceiptMail } from '@/lib/email-templates';
import { route } from '@/lib/http';
import { sendMail } from '@/lib/mail';
import { getSettings } from '@/lib/settings';
import { SUPPORT_TOPICS } from '@/lib/site';
import { v } from '@/lib/validate';

const NAME_RE = /^[\p{L}][\p{L}\p{M} .'-]{1,79}$/u;
const schema = v.object({
  name: v.string({ min: 2, max: 80, label: 'Name', pattern: NAME_RE, patternMessage: 'Use letters only in your name.' }),
  email: v.email(),
  phone: v.nullable(v.phoneIN()),
  orderNumber: v.optionalString({ max: 20, pattern: /^ARV-\d{6}-[A-Z0-9]{4}$/, patternMessage: 'Order numbers look like ARV-261031-K7QM.', label: 'Order number' }),
  topic: v.oneOf(SUPPORT_TOPICS, 'Topic'),
  message: v.string({ min: 15, max: 2000, multiline: true, label: 'Message' }),
});

export const POST = route(
  { body: schema, turnstile: true, limits: [{ name: 'support-ip', max: 5, windowSec: 3600 }, { name: 'support-ip-day', max: 15, windowSec: 86400 }] },
  async ({ body, user, ip }) => {
    const reference = `SUP-${randomFromAlphabet(8)}`;
    await db.query(
      `INSERT INTO support_tickets (reference, user_id, name, email, phone, order_number, topic, message, ip) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [reference, user?.id ?? null, body.name, body.email, body.phone, body.orderNumber ?? null, body.topic, body.message, ip],
    );
    const settings = await getSettings();
    const inbox = settings.business.supportEmail || env('SUPPORT_EMAIL');
    if (inbox) await sendMail({ to: inbox, replyTo: body.email, ...supportNotifyMail({ reference, name: body.name, email: body.email, phone: body.phone, orderNumber: body.orderNumber, topic: body.topic, message: body.message }) });
    await sendMail({ to: body.email, ...supportReceiptMail({ name: body.name, reference }) });
    return { ok: true, reference };
  },
);

export const dynamic = 'force-dynamic';
