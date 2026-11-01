import Link from 'next/link';
import { CheckoutForm } from '@/components/CheckoutForm';
import { listAddresses } from '@/lib/address';
import { getCartView } from '@/lib/cart';
import { INDIAN_STATES } from '@/lib/pincode';
import { razorpayConfigured } from '@/lib/razorpay';
import { NOINDEX } from '@/lib/seo';
import { safe } from '@/lib/safe';
import { requireUser } from '@/lib/session';
import { getSettings } from '@/lib/settings';

export const metadata = { ...NOINDEX, title: 'Checkout' };

export default async function CheckoutPage() {
  const user = await requireUser('/checkout');
  const [cart, addresses, settings] = await Promise.all([getCartView(user), safe(listAddresses(user.id), [], 'addresses'), getSettings()]);

  return (
    <div className="container">
      <div className="page-head">
        <h1>Checkout</h1>
      </div>
      {cart.lines.length === 0 ? (
        <div className="empty raised">
          <h2 style={{ fontSize: '1.75rem' }}>Your bag is empty</h2>
          <p>Add something to your bag before checking out.</p>
          <Link href="/shop" className="btn btn--primary">
            Browse the shop
          </Link>
        </div>
      ) : (
        <CheckoutForm
          user={{ name: user.name, email: user.email, phone: user.phone, phoneVerified: user.phoneVerified }}
          addresses={addresses}
          states={INDIAN_STATES}
          flatPaise={settings.shipping.flatPaise}
          freeAbovePaise={settings.shipping.freeAbovePaise}
          requireVerifiedPhone={settings.checkout.requireVerifiedPhone}
          paymentsReady={razorpayConfigured()}
        />
      )}
    </div>
  );
}
