import { createInterface } from 'node:readline/promises';
import { createAdminUser } from '../src/lib/admin-auth';
import { pool } from '../src/lib/db';

// Usage: npm run admin:create
// Creates an admin with a password and an authenticator (TOTP) seed. The seed and the recovery codes are printed once.
async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const email = (await rl.question('Admin email: ')).trim().toLowerCase();
  const name = (await rl.question('Admin name: ')).trim();
  const password = process.env.ADMIN_PASSWORD ?? (await rl.question('Password (min 12 characters, shown while typing): '));
  rl.close();
  const a = await createAdminUser({ email, name, password });
  console.log('\nAdmin created. This is shown once, save it now.\n');
  console.log('Add this to your authenticator app (scan the link as a QR code, or enter the key by hand):');
  console.log(`  Key:  ${a.totpSecret}`);
  console.log(`  Link: ${a.otpauth}\n`);
  console.log('Recovery codes (each works once if you lose the authenticator):');
  for (const c of a.recoveryCodes) console.log(`  ${c}`);
  await pool().end();
}

main().catch((e) => {
  console.error('Could not create admin:', e instanceof Error ? e.message : e);
  process.exit(1);
});
