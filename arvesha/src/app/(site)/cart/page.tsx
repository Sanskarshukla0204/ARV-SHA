import { CartPage } from '@/components/CartPage';
import { getSettings } from '@/lib/settings';
import { NOINDEX } from '@/lib/seo';

export const metadata = { ...NOINDEX, title: 'Your bag' };

export default async function Cart() {
  const s = (await getSettings()).shipping;
  return (
    <div className="container">
      <div className="page-head">
        <h1>Your bag</h1>
      </div>
      <CartPage flatPaise={s.flatPaise} freeAbovePaise={s.freeAbovePaise} />
    </div>
  );
}
