import { addressSchema, verifyAddress } from '@/lib/address';
import { db } from '@/lib/db';
import { HttpError, route } from '@/lib/http';
import { v } from '@/lib/validate';

const schema = v.object({ address: addressSchema, label: v.optionalString({ max: 30, label: 'Label' }), makeDefault: v.bool() });

export const PATCH = route({ auth: 'user', body: schema, userLimits: [{ name: 'addr-write', max: 30, windowSec: 3600 }] }, async ({ body, user, params }) => {
  const id = v.uuid('Address').run(params.id);
    if (!id.ok) throw new HttpError(404, 'not_found', 'Address not found.');
      const verified = await verifyAddress(body.address);
        if (body.makeDefault) await db.query(`UPDATE addresses SET is_default = false WHERE user_id = $1`, [user!.id]);
          const a = body.address;
            const row = await db.one(
                `UPDATE addresses SET label = COALESCE($3, label), full_name = $4, phone = $5, line1 = $6, line2 = $7, landmark = $8, city = $9, state = $10,
                            pincode = $11, pincode_verified = $12, is_default = CASE WHEN $13 THEN true ELSE is_default END, updated_at = now()
                                  WHERE id = $1 AND user_id = $2 RETURNING id`,
                                      [id.value, user!.id, body.label ?? null, a.name, a.phone, a.line1, a.line2 ?? null, a.landmark ?? null, a.city, a.state, a.pincode, verified, body.makeDefault],
                                        );
                                          if (!row) throw new HttpError(404, 'not_found', 'Address not found.');
                                            return { ok: true };
                                            });

                                            const deleteRoute = route({ auth: 'user', userLimits: [{ name: 'addr-write', max: 30, windowSec: 3600 }] }, async ({ user, params }) => {
                                              const id = v.uuid('Address').run(params.id);
                                                if (!id.ok) throw new HttpError(404, 'not_found', 'Address not found.');
                                                  await db.query(`DELETE FROM addresses WHERE id = $1 AND user_id = $2`, [id.value, user!.id]);
                                                    // Keep one default if any address is left.
                                                      await db.query(
                                                          `UPDATE addresses SET is_default = true WHERE id = (SELECT id FROM addresses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1)
                                                                 AND NOT EXISTS (SELECT 1 FROM addresses WHERE user_id = $1 AND is_default)`,
                                                                     [user!.id],
                                                                       );
                                                                         return { ok: true };
                                                                         });

                                                                         // Next.js 15 needs the second argument to be a required { params } object, not optional.
                                                                         export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
                                                                           return deleteRoute(req, ctx);
                                                                           }

                                                                           export const dynamic = 'force-dynamic';