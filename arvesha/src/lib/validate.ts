import { normalizeIN } from './phone';

// A small, dependency-free validation layer. Every API route validates on the server with these
// schemas; client-side checks are only a convenience. Unknown keys are dropped, never trusted.

export type FieldErrors = Record<string, string>;

export class ValidationError extends Error {
  readonly fields: FieldErrors;
  constructor(fields: FieldErrors, message = 'Please check the highlighted fields.') {
    super(message);
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

type Ok<T> = { ok: true; value: T };
type Fail = { ok: false; errors: FieldErrors };

export interface Schema<T> {
  run(input: unknown): Ok<T> | Fail;
}

export type Infer<S> = S extends Schema<infer T> ? T : never;

const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
const fail = (message: string): Fail => ({ ok: false, errors: { '': message } });

export function parse<T>(schema: Schema<T>, input: unknown): T {
  const r = schema.run(input);
  if (!r.ok) throw new ValidationError(r.errors);
  return r.value;
}

// Strips control characters (except newline and tab) and zero-width / bidi override characters.
function clean(s: string, multiline: boolean): string {
  let out = s.normalize('NFC');
  // eslint-disable-next-line no-control-regex
  out = out.replace(multiline ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, '');
  out = out.replace(/[​-‏‪-‮⁦-⁩﻿]/g, '');
  return out;
}

export interface StringOpts {
  min?: number;
  max?: number;
  trim?: boolean;
  pattern?: RegExp;
  patternMessage?: string;
  multiline?: boolean;
  label?: string;
}

function stringSchema(opts: StringOpts = {}): Schema<string> {
  const { min = 0, max = 500, trim = true, pattern, patternMessage, multiline = false, label = 'This field' } = opts;
  return {
    run(input) {
      if (typeof input !== 'string') return fail(min > 0 ? `${label} is required.` : `${label} must be text.`);
      let s = clean(input, multiline);
      if (trim) s = s.trim();
      if (s.length < min) return fail(min === 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`);
      if (s.length > max) return fail(`${label} must be at most ${max} characters.`);
      if (pattern && s.length > 0 && !pattern.test(s)) return fail(patternMessage ?? `${label} is not in the expected format.`);
      return ok(s);
    },
  };
}

const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

function ageOn(dob: Date, today: Date): number {
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const m = today.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

export const v = {
  string: stringSchema,

  /** Empty string becomes undefined. */
  optionalString(opts: StringOpts = {}): Schema<string | undefined> {
    const inner = stringSchema({ ...opts, min: 0 });
    return {
      run(input) {
        if (input === undefined || input === null || input === '') return ok(undefined);
        const r = inner.run(input);
        if (!r.ok) return r;
        return ok(r.value === '' ? undefined : r.value);
      },
    };
  },

  email(opts: { label?: string } = {}): Schema<string> {
    const label = opts.label ?? 'Email';
    return {
      run(input) {
        if (typeof input !== 'string') return fail(`${label} is required.`);
        const s = clean(input, false).trim().toLowerCase();
        if (!s) return fail(`${label} is required.`);
        if (s.length > 254 || !EMAIL_RE.test(s) || s.includes('..')) return fail('Enter a valid email address.');
        const local = s.split('@')[0]!;
        if (local.length > 64) return fail('Enter a valid email address.');
        return ok(s);
      },
    };
  },

  /** Indian mobile number, normalised to +91XXXXXXXXXX. */
  phoneIN(opts: { label?: string } = {}): Schema<string> {
    const label = opts.label ?? 'Mobile number';
    return {
      run(input) {
        if (typeof input !== 'string' || !input.trim()) return fail(`${label} is required.`);
        const n = normalizeIN(input);
        return n ? ok(n) : fail('Enter a valid 10 digit Indian mobile number.');
      },
    };
  },

  /** A YYYY-MM-DD date of birth for someone at least `minAge` years old. */
  dob(opts: { minAge?: number; today?: Date } = {}): Schema<string> {
    const { minAge = 18 } = opts;
    return {
      run(input) {
        if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return fail('Enter your date of birth.');
        const [y, m, d] = input.split('-').map(Number) as [number, number, number];
        const date = new Date(Date.UTC(y, m - 1, d));
        if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
          return fail('Enter a real date.');
        }
        const today = opts.today ?? new Date();
        if (date.getTime() > today.getTime()) return fail('Date of birth cannot be in the future.');
        const age = ageOn(date, today);
        if (age > 120) return fail('Enter a real date.');
        if (age < minAge) return fail(`You must be at least ${minAge} years old to create an account.`);
        return ok(input);
      },
    };
  },

  /** Length only. Strength is checked separately in password.ts because it needs context. */
  password(opts: { label?: string; min?: number } = {}): Schema<string> {
    const { label = 'Password', min = 10 } = opts;
    return {
      run(input) {
        if (typeof input !== 'string' || input.length === 0) return fail(`${label} is required.`);
        if (input.length < min) return fail(`${label} must be at least ${min} characters.`);
        if (input.length > 128) return fail(`${label} must be at most 128 characters.`);
        return ok(input); // never trimmed or altered
      },
    };
  },

  pincode(): Schema<string> {
    return {
      run(input) {
        if (typeof input !== 'string') return fail('PIN code is required.');
        const s = input.replace(/\s/g, '');
        return /^[1-9]\d{5}$/.test(s) ? ok(s) : fail('Enter a valid 6 digit PIN code.');
      },
    };
  },

  uuid(label = 'Id'): Schema<string> {
    return {
      run(input) {
        return typeof input === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input)
          ? ok(input.toLowerCase())
          : fail(`${label} is not valid.`);
      },
    };
  },

  slug(label = 'Slug'): Schema<string> {
    return stringSchema({ min: 1, max: 80, pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, label, patternMessage: `${label} may use lower-case letters, numbers and hyphens.` });
  },

  int(opts: { min?: number; max?: number; label?: string } = {}): Schema<number> {
    const { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER, label = 'Number' } = opts;
    return {
      run(input) {
        const n = typeof input === 'string' && /^-?\d+$/.test(input.trim()) ? Number(input) : input;
        if (typeof n !== 'number' || !Number.isInteger(n)) return fail(`${label} must be a whole number.`);
        if (n < min) return fail(`${label} must be at least ${min}.`);
        if (n > max) return fail(`${label} must be at most ${max}.`);
        return ok(n);
      },
    };
  },

  /** Rupee amount typed by an admin, such as "1299" or "1299.50", converted to integer paise. */
  rupees(opts: { min?: number; max?: number; label?: string } = {}): Schema<number> {
    const { min = 0, max = 10_000_000, label = 'Amount' } = opts;
    return {
      run(input) {
        const s = typeof input === 'number' ? String(input) : typeof input === 'string' ? input.trim() : '';
        if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) return fail(`${label} must be an amount like 1299 or 1299.50.`);
        const [whole, frac = ''] = s.split('.');
        const paise = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
        if (paise < min) return fail(`${label} is too low.`);
        if (paise > max * 100) return fail(`${label} is too high.`);
        return ok(paise);
      },
    };
  },

  bool(): Schema<boolean> {
    return {
      run(input) {
        if (typeof input === 'boolean') return ok(input);
        if (input === 'true' || input === 'on' || input === '1') return ok(true);
        if (input === 'false' || input === 'off' || input === '0' || input === undefined || input === null || input === '') return ok(false);
        return fail('Invalid value.');
      },
    };
  },

  /** Must be exactly true, used for consent checkboxes. */
  accepted(message: string): Schema<true> {
    return {
      run(input) {
        return input === true || input === 'true' || input === 'on' ? ok(true as const) : fail(message);
      },
    };
  },

  oneOf<const T extends readonly string[]>(values: T, label = 'Value'): Schema<T[number]> {
    return {
      run(input) {
        return typeof input === 'string' && (values as readonly string[]).includes(input) ? ok(input as T[number]) : fail(`${label} is not valid.`);
      },
    };
  },

  optional<T>(inner: Schema<T>): Schema<T | undefined> {
    return {
      run(input) {
        if (input === undefined || input === null) return ok(undefined);
        return inner.run(input);
      },
    };
  },

  nullable<T>(inner: Schema<T>): Schema<T | null> {
    return {
      run(input) {
        if (input === null || input === undefined || input === '') return ok(null);
        return inner.run(input);
      },
    };
  },

  array<T>(inner: Schema<T>, opts: { min?: number; max?: number; label?: string } = {}): Schema<T[]> {
    const { min = 0, max = 100, label = 'List' } = opts;
    return {
      run(input) {
        if (!Array.isArray(input)) return fail(`${label} must be a list.`);
        if (input.length < min) return fail(`${label} needs at least ${min} item${min === 1 ? '' : 's'}.`);
        if (input.length > max) return fail(`${label} can have at most ${max} items.`);
        const out: T[] = [];
        const errors: FieldErrors = {};
        input.forEach((item, i) => {
          const r = inner.run(item);
          if (r.ok) out.push(r.value);
          else for (const [k, msg] of Object.entries(r.errors)) errors[k ? `${i}.${k}` : String(i)] = msg;
        });
        return Object.keys(errors).length ? { ok: false, errors } : ok(out);
      },
    };
  },

  object<S extends Record<string, Schema<any>>>(shape: S): Schema<{ [K in keyof S]: Infer<S[K]> }> {
    return {
      run(input) {
        if (typeof input !== 'object' || input === null || Array.isArray(input)) return fail('Invalid request.');
        const out: Record<string, unknown> = {};
        const errors: FieldErrors = {};
        for (const key of Object.keys(shape)) {
          const r = shape[key]!.run((input as Record<string, unknown>)[key]);
          if (r.ok) out[key] = r.value;
          else for (const [k, msg] of Object.entries(r.errors)) errors[k ? `${key}.${k}` : key] = msg;
        }
        return Object.keys(errors).length ? { ok: false, errors } : ok(out as { [K in keyof S]: Infer<S[K]> });
      },
    };
  },
};

/** Only same-site relative paths are allowed as a post-login redirect. Blocks open redirects. */
export function safeNext(next: unknown, fallback = '/account'): string {
  if (typeof next !== 'string') return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\') || /[\u0000-\u001F]/.test(next)) return fallback;
  if (next.includes('://')) return fallback;
  return next;
}

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
