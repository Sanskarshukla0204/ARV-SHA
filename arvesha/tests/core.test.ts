import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { base32Decode, base32Encode, generateTotpSecret, otpauthUri, totpAt, verifyTotp } from '../src/lib/totp';
import { fromTruecaller, formatPhone, maskPhone, normalizeIN } from '../src/lib/phone';
import { decryptSecret, encryptSecret, newPublicId, randomCode, safeEqual, sha256 } from '../src/lib/crypto';
import { parse, safeNext, slugify, v, ValidationError } from '../src/lib/validate';
import { checkPasswordPolicy } from '../src/lib/password';
import { formatINR, percentOff } from '../src/lib/format';
import { isDisposableEmail } from '../src/lib/emailcheck';
import { normalizeState } from '../src/lib/pincode';

// ----------------------------------------------------------------------- TOTP

test('TOTP matches the RFC 6238 SHA-1 test vectors', () => {
  const secret = base32Encode(Buffer.from('12345678901234567890', 'ascii'));
  const vectors: Array<[number, string]> = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ];
  for (const [t, expected] of vectors) assert.equal(totpAt(secret, t * 1000, { digits: 8 }), expected, `T=${t}`);
});

test('base32 round trips', () => {
  for (let i = 0; i < 50; i++) {
    const buf = randomBytes(1 + (i % 32));
    assert.deepEqual(base32Decode(base32Encode(buf)), buf);
  }
  assert.equal(base32Encode(Buffer.from('foobar')), 'MZXW6YTBOI');
});

test('verifyTotp accepts adjacent steps, rejects others, and blocks replay', () => {
  const secret = generateTotpSecret();
  const now = 1_700_000_000_000;
  const code = totpAt(secret, now);
  const first = verifyTotp(secret, code, { now });
  assert.equal(first.ok, true);
  // replay of the same step is refused
  assert.equal(verifyTotp(secret, code, { now, lastUsedStep: first.step }).ok, false);
  // previous step still works within the window
  assert.equal(verifyTotp(secret, totpAt(secret, now - 30_000), { now }).ok, true);
  // two steps away is rejected
  assert.equal(verifyTotp(secret, totpAt(secret, now - 90_000), { now }).ok, false);
  assert.equal(verifyTotp(secret, '12345', { now }).ok, false);
  assert.equal(verifyTotp(secret, 'abcdef', { now }).ok, false);
  assert.match(otpauthUri(secret, 'a@b.in', 'Arvésha'), /^otpauth:\/\/totp\/Arv%C3%A9sha:a%40b\.in\?secret=/);
});

// ---------------------------------------------------------------------- phone

test('Indian mobile numbers normalise and junk is rejected', () => {
  assert.equal(normalizeIN('98123 45670'), '+919812345670');
  assert.equal(normalizeIN('+91 98123-45670'), '+919812345670');
  assert.equal(normalizeIN('919812345670'), '+919812345670');
  assert.equal(normalizeIN('09812345670'), '+919812345670');
  assert.equal(normalizeIN('9123456780'), '+919123456780');
  for (const bad of ['1234567890', '5812345670', '987654321', '98123456701', '9999999999', '9876543210', 'abc', '', '+1 202 555 0100', '098765432']) {
    assert.equal(normalizeIN(bad), null, bad);
  }
  assert.equal(formatPhone('+919812345670'), '+91 98123 45670');
  assert.equal(maskPhone('+919812345670'), '+91 98••• ••670');
  assert.equal(fromTruecaller('919812345670'), '+919812345670');
  assert.equal(fromTruecaller(undefined), null);
});

// --------------------------------------------------------------------- crypto

test('AES-256-GCM secrets round trip and detect tampering', () => {
  const key = randomBytes(32);
  const blob = encryptSecret('JBSWY3DPEHPK3PXP', key);
  assert.equal(decryptSecret(blob, key), 'JBSWY3DPEHPK3PXP');
  assert.notEqual(encryptSecret('JBSWY3DPEHPK3PXP', key), blob, 'random IV');
  const parts = blob.split('.');
  parts[3] = Buffer.from('tampered').toString('base64url');
  assert.throws(() => decryptSecret(parts.join('.'), key));
  assert.throws(() => decryptSecret(blob, randomBytes(32)));
});

test('ids, codes and comparisons', () => {
  assert.match(newPublicId(), /^ARV-[2-9A-HJKMNP-TV-Z]{8}$/);
  assert.match(randomCode(6), /^\d{6}$/);
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
  assert.equal(sha256('a').length, 64);
});

// ----------------------------------------------------------------- validation

test('register schema validates every field', () => {
  const schema = v.object({
    name: v.string({ min: 2, max: 80, label: 'Name', pattern: /^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]{1,79}$/u }),
    email: v.email(),
    phone: v.phoneIN(),
    dob: v.dob({ today: new Date('2026-10-11T00:00:00Z') }),
  });
  const good = parse(schema, { name: '  Aarav  Sharma ', email: 'Aarav@Example.COM ', phone: '98123 45670', dob: '1995-04-30' });
  assert.equal(good.email, 'aarav@example.com');
  assert.equal(good.phone, '+919812345670');
  assert.equal(good.name, 'Aarav  Sharma');

  const r = schema.run({ name: 'A', email: 'nope', phone: '123', dob: '2015-01-01' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.deepEqual(Object.keys(r.errors).sort(), ['dob', 'email', 'name', 'phone']);
});

test('date of birth enforces real dates and the age limit', () => {
  const today = new Date('2026-10-11T00:00:00Z');
  const dob = v.dob({ today });
  assert.equal(dob.run('2008-10-11').ok, true); // turns 18 today
  assert.equal(dob.run('2008-10-12').ok, false); // turns 18 tomorrow
  assert.equal(dob.run('2026-10-12').ok, false); // future
  assert.equal(dob.run('1995-02-30').ok, false); // not a real date
  assert.equal(dob.run('1890-01-01').ok, false);
  assert.equal(dob.run('30/04/1995').ok, false);
});

test('email rules', () => {
  const e = v.email();
  for (const good of ['a@b.co', 'first.last+tag@sub.example.in', "o'brien@example.com"]) assert.equal(e.run(good).ok, true, good);
  for (const bad of ['a@b', 'a b@c.com', '@c.com', 'a@@c.com', 'a..b@c.com', 'a@c..com', 'a@-c.com', '']) assert.equal(e.run(bad).ok, false, bad);
});

test('control and bidi characters are stripped from text', () => {
  const s = v.string({ min: 1, max: 20 });
  const r = s.run('he\u0000llo\u202Eworld\u200B');
  assert.equal(r.ok && r.value, 'helloworld');
  assert.equal(v.string({ min: 1, multiline: true }).run('a\nb').ok, true);
  assert.equal(v.string({ max: 3 }).run('abcd').ok, false);
});

test('rupees convert to exact paise', () => {
  const r = v.rupees();
  assert.deepEqual(r.run('1299'), { ok: true, value: 129900 });
  assert.deepEqual(r.run('1299.5'), { ok: true, value: 129950 });
  assert.deepEqual(r.run('0.07'), { ok: true, value: 7 });
  assert.deepEqual(r.run('19.99'), { ok: true, value: 1999 });
  for (const bad of ['-1', '1,299', '12.345', 'abc', '', '1e5']) assert.equal(r.run(bad).ok, false, bad);
});

test('object schema drops unknown keys and reports nested paths', () => {
  const schema = v.object({ items: v.array(v.object({ qty: v.int({ min: 1, max: 10 }) }), { max: 2 }) });
  const r = schema.run({ items: [{ qty: 3, evil: 'x' }, { qty: 99 }], admin: true });
  assert.equal(r.ok, false);
  if (!r.ok) assert.deepEqual(Object.keys(r.errors), ['items.1.qty']);
  const ok = schema.run({ items: [{ qty: '3', evil: 'x' }], admin: true });
  assert.deepEqual(ok.ok && ok.value, { items: [{ qty: 3 }] });
  assert.throws(() => parse(schema, { items: 'x' }), ValidationError);
});

test('redirect targets cannot leave the site', () => {
  assert.equal(safeNext('/account/orders'), '/account/orders');
  for (const bad of ['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)', '/a://b', undefined, 42]) {
    assert.equal(safeNext(bad), '/account', String(bad));
  }
});

test('slugify', () => {
  assert.equal(slugify('Women & Kurtas'), 'women-and-kurtas');
  assert.equal(slugify('  Crème Brûlée Dress!! '), 'creme-brulee-dress');
});

// -------------------------------------------------------------------- password

test('password policy', () => {
  assert.match(checkPasswordPolicy('short1A!') ?? '', /10 characters/);
  assert.match(checkPasswordPolicy('aaaaaaaaaaaa') ?? '', /repeat/);
  assert.match(checkPasswordPolicy('password123') ?? '', /common/);
  assert.match(checkPasswordPolicy('onlyletterslong') ?? '', /Mix letters/);
  assert.match(checkPasswordPolicy('aarav-Sharma-77x', { name: 'Aarav Sharma' }) ?? '', /name/);
  assert.match(checkPasswordPolicy('x9pRiya.nair#1', { email: 'riya.nair@example.com' }) ?? '', /email/);
  assert.equal(checkPasswordPolicy('correct horse battery staple'), null);
  assert.equal(checkPasswordPolicy('T7v!qm2Lw9'), null);
});

// --------------------------------------------------------------------- others

test('money and discounts', () => {
  assert.equal(formatINR(129900).replace(/\s/g, ''), '₹1,299');
  assert.equal(formatINR(129950).replace(/\s/g, ''), '₹1,299.50');
  assert.equal(formatINR(10000000).replace(/\s/g, ''), '₹1,00,000');
  assert.equal(percentOff(80000, 100000), 20);
  assert.equal(percentOff(100000, 100000), null);
  assert.equal(percentOff(100000, null), null);
});

test('disposable email domains are rejected', () => {
  for (const d of ['x@mailinator.com', 'x@yopmail.com', 'x@sub.mailinator.com', 'x@guerrillamail.com', 'x@10minutemail.com']) {
    assert.equal(isDisposableEmail(d), true, d);
  }
  assert.equal(isDisposableEmail('x'), true);
});

test('state names normalise across India Post spellings', () => {
  assert.equal(normalizeState('Jammu & Kashmir'), normalizeState('Jammu and Kashmir'));
  assert.equal(normalizeState('Daman & Diu'), normalizeState('Dadra and Nagar Haveli and Daman and Diu'));
  assert.equal(normalizeState('Orissa'), 'odisha');
  assert.notEqual(normalizeState('Kerala'), normalizeState('Karnataka'));
});
