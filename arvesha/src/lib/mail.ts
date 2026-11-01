import { Resend } from 'resend';
import { env, isProd } from './env';

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

let client: Resend | null = null;

/**
 * Sends one email through Resend. Returns false instead of throwing so a mail outage never
 * breaks checkout or registration; callers decide whether to tell the customer.
 * Without RESEND_API_KEY, development prints the message to the server console.
 */
export async function sendMail(input: MailInput): Promise<boolean> {
  const apiKey = env('RESEND_API_KEY');
  const from = env('MAIL_FROM');

  if (!apiKey || !from) {
    if (!isProd) {
      console.log(`\n[mail:dev] to=${input.to}\nsubject=${input.subject}\n${input.text}\n`);
      return true;
    }
    console.error('[mail] RESEND_API_KEY or MAIL_FROM is not set; email not sent');
    return false;
  }

  try {
    client ??= new Resend(apiKey);
    const { error } = await client.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo ?? env('SUPPORT_EMAIL'),
    });
    if (error) {
      console.error('[mail] Resend rejected the message', error.name, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[mail] send failed', (err as Error).message);
    return false;
  }
}
