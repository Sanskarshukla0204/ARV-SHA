import { db } from './db';

/** Records who did what in the admin panel. Failures are logged but never block the action. */
export async function audit(entry: {
  adminId: string | null;
  adminEmail: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  ip?: string;
}): Promise<void> {
  try {
    await db.query(
      `INSERT INTO admin_audit_log (admin_id, admin_email, action, entity, entity_id, meta, ip)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
      [
        entry.adminId,
        entry.adminEmail,
        entry.action,
        entry.entity ?? null,
        entry.entityId ?? null,
        JSON.stringify(entry.meta ?? {}),
        entry.ip ?? null,
      ],
    );
  } catch (err) {
    console.error('[audit] could not write audit entry', (err as Error).message);
  }
}
