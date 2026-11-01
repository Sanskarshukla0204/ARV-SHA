// Indian mobile numbers only. Razorpay, shipping and Truecaller all operate on +91 numbers.

const FAKE_NUMBERS = new Set(['9876543210', '9123456789', '9012345678', '8123456789', '7123456789', '6123456789']);

/** Returns +91XXXXXXXXXX, or null when the input is not a plausible Indian mobile number. */
export function normalizeIN(input: string): string | null {
  if (typeof input !== 'string') return null;
  const cleaned = input.replace(/[\s\-().]/g, '');
  const m = cleaned.match(/^(?:\+91|91|0)?([6-9]\d{9})$/);
  if (!m) return null;
  const ten = m[1]!;
  if (/^(\d)\1{9}$/.test(ten)) return null; // 9999999999
  if (FAKE_NUMBERS.has(ten)) return null;
  if (ten === '6789012345' || ten === '9876543210') return null;
  return `+91${ten}`;
}

/** +919876543210 to +91 98765 43210 */
export function formatPhone(e164: string): string {
  const m = e164.match(/^\+91(\d{5})(\d{5})$/);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}

/** +919876543210 to +91 98••• ••210, for showing a number back to the owner. */
export function maskPhone(e164: string): string {
  const m = e164.match(/^\+91(\d{2})\d{5}(\d{3})$/);
  return m ? `+91 ${m[1]}••• ••${m[2]}` : '••••••';
}

/** Truecaller returns numbers like 919876543210 or +919876543210. */
export function fromTruecaller(raw: string | number | undefined | null): string | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  return normalizeIN(s.startsWith('+') ? s : `+${s}`);
}
