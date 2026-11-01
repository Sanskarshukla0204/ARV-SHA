// Prints fresh random secrets and a random admin path. Nothing is written to disk.
// Copy the values into your host's environment settings (for example Vercel) and into .env.local for development.
import { randomBytes } from 'node:crypto';

const b64 = (n) => randomBytes(n).toString('base64url');
const hex = (n) => randomBytes(n).toString('hex');

console.log('Copy these into your environment. Keep them private and do not commit them.\n');
console.log(`APP_SECRET=${b64(48)}`);
console.log(`PASSWORD_PEPPER=${b64(48)}`);
console.log(`DATA_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`);
console.log(`CRON_SECRET=${b64(32)}`);
console.log(`ADMIN_PATH=studio-${hex(10)}`);
console.log('\nPASSWORD_PEPPER must be set before the first customer registers and must never change afterwards,');
console.log('or existing passwords stop working. Store a copy in a password manager.');
console.log('ADMIN_PATH is the secret address of your admin panel: https://yourdomain/<ADMIN_PATH>');
