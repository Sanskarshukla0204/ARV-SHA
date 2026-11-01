import { db } from '@/lib/db';
import { json } from '@/lib/http';

// Public and deliberately minimal: it says whether the site and database answer, and nothing else.
export async function GET() {
  try {
    await db.one('SELECT 1 AS ok');
    return json({ ok: true });
  } catch {
    return json({ ok: false }, 503);
  }
}

export const dynamic = 'force-dynamic';
