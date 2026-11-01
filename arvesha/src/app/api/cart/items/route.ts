import { addToCart, setCartQty } from '@/lib/cart';
import { route } from '@/lib/http';
import { v } from '@/lib/validate';

const add = v.object({ variantId: v.uuid('Item'), qty: v.int({ min: 1, max: 10, label: 'Quantity' }) });
const set = v.object({ variantId: v.uuid('Item'), qty: v.int({ min: 0, max: 10, label: 'Quantity' }) });
const limits = [{ name: 'cart-write', max: 90, windowSec: 60 }];

export const POST = route({ body: add, limits }, async ({ body, user }) => ({ cart: await addToCart(user, body.variantId, body.qty) }));
export const PATCH = route({ body: set, limits }, async ({ body, user }) => ({ cart: await setCartQty(user, body.variantId, body.qty) }));

export const dynamic = 'force-dynamic';
