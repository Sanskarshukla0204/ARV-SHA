import { getCartView } from '@/lib/cart';
import { route } from '@/lib/http';

export const GET = route({ limits: [{ name: 'cart-read', max: 240, windowSec: 60 }] }, async ({ user }) => ({ cart: await getCartView(user) }));

export const dynamic = 'force-dynamic';
