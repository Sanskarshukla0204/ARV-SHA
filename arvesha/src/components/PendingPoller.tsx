'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';

/** Asks the server every few seconds whether the payment has landed. The server asks Razorpay, so a missed webhook cannot strand an order. */
export function PendingPoller({ order }: { order: string }) {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    if (gaveUp) return;
    const id = setTimeout(async () => {
      try {
        const r = await api<{ status: string; paymentStatus: string }>(`/api/checkout/status?order=${encodeURIComponent(order)}`);
        if (r.paymentStatus === 'paid' || r.status === 'new') return router.replace(`/payment/success?order=${encodeURIComponent(order)}`);
        if (r.status === 'expired' || r.status === 'cancelled' || r.paymentStatus === 'failed') return router.replace(`/payment/failed?order=${encodeURIComponent(order)}`);
      } catch {
        /* keep trying */
      }
      if (tries >= 24) setGaveUp(true);
      else setTries((t) => t + 1);
    }, tries === 0 ? 1500 : 5000);
    return () => clearTimeout(id);
  }, [tries, gaveUp, order, router]);

  return gaveUp ? (
    <div className="stack">
      <p className="notice notice--info">
        We have not received the bank&apos;s confirmation yet. You do not need to pay again. If the payment went through, your order will appear in <Link href="/account/orders">My orders</Link> and we will email you. If the money was deducted and nothing shows after a few hours, contact support with order {order}.
      </p>
      <div className="row">
        <Link href="/account/orders" className="btn btn--primary">
          My orders
        </Link>
        <Link href="/support" className="btn">
          Contact support
        </Link>
      </div>
    </div>
  ) : (
    <p role="status" aria-live="polite">
      Checking with your bank. This page updates by itself.
    </p>
  );
}
