import Link from 'next/link';
import { Icon } from '@/app/components/ui/Icon';

export const MOBILE_TABS = ['watchlist', 'analysis'];

const ITEMS = [
  { tab: 'watchlist', icon: 'activity', label: '自選' },
  { tab: 'analysis', icon: 'barChart2', label: '分析' },
];

/**
 * 手機版底部分頁列（1024px 以上隱藏）。每個分頁都是一個網址，返回鍵可以退回上一個分頁。
 * active 為目前分頁（'guide' 代表在 /guide 頁）；stockId、view 為目前選取的股票與分析子分頁（切換分頁時保留）。
 */
export function MobileTabBar({ active, stockId, view }) {
  const hrefFor = (tab) => {
    const params = new URLSearchParams({ tab });
    if (stockId) params.set('stock', stockId);
    if (view) params.set('view', view);
    return `/?${params}`;
  };
  const itemClass = (isActive) => 'flex flex-col items-center gap-0.5 px-4 ' + (isActive ? 'text-accent' : 'text-fg-faint');

  return (
    <nav className="lg:hidden fixed inset-x-0 bottom-0 z-20 bg-surface/95 backdrop-blur border-t-2 border-line-subtle">
      <div className="max-w-2xl mx-auto h-14 flex justify-around items-center">
        {ITEMS.map(item => (
          <Link key={item.tab} href={hrefFor(item.tab)} className={itemClass(active === item.tab)}>
            <Icon name={item.icon} className="w-4 h-4" /><span className="text-2xs font-black">{item.label}</span>
          </Link>
        ))}
        <Link href="/guide" className={itemClass(active === 'guide')}>
          <Icon name="bookOpen" className="w-4 h-4" /><span className="text-2xs font-black">圖典</span>
        </Link>
      </div>
    </nav>
  );
}
