'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useWatchlist } from './useWatchlist';
import { AppHeader } from './AppHeader';
import { WatchlistPanel } from './WatchlistPanel';
import { StockDetail, MobileAiPanel } from './StockDetail';
import { MobileTabBar, MOBILE_TABS } from './MobileTabBar';
import { AddStockModal } from './AddStockModal';
import { LoadingScreen, ErrorScreen, StatusCard } from './StatusScreen';

/**
 * 儀表板。版面依寬度切換（Tailwind lg = 1024px）：
 * - 1024px 以上：左側固定寬度自選清單 + 右側分析區
 * - 1024px 以下：底部分頁列切換「自選／分析／AI」，內容垂直堆疊
 * 選取的股票與手機版分頁記錄在網址（?stock=2330.TW&tab=analysis），返回鍵、重新整理、分享網址都會保留。
 */
export function Dashboard({ user }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { stocks, candlesById, loading, error, busy, load, refresh, add, remove } = useWatchlist();
  const [showAddModal, setShowAddModal] = useState(false);
  const [timeRange, setTimeRange] = useState('1M');
  const [chartType, setChartType] = useState('line');

  const tab = MOBILE_TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'watchlist';
  const requestedId = searchParams.get('stock');
  const available = stocks.filter(s => !s.unavailable);
  // 網址指定的股票不在清單裡（或已刪除），就退回清單第一檔
  const selectedStock = available.find(s => s.id === requestedId) ?? available[0] ?? null;

  // 寫入網址：push 會留下瀏覽紀錄（返回鍵可退回），replace 不會
  const updateUrl = useCallback((params, { replace = false } = {}) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(params)) {
      if (value == null) next.delete(key);
      else next.set(key, value);
    }
    const url = `${pathname}?${next}`;
    if (replace) router.replace(url, { scroll: false });
    else router.push(url);
  }, [router, pathname, searchParams]);

  // 網址與實際顯示的股票不一致時（例如退回第一檔），修正網址但不留下瀏覽紀錄
  useEffect(() => {
    if (!loading && selectedStock && requestedId !== selectedStock.id) {
      updateUrl({ stock: selectedStock.id }, { replace: true });
    }
  }, [loading, selectedStock, requestedId, updateUrl]);

  const handleSelect = (stockId) => updateUrl({ stock: stockId, tab: 'analysis' });

  const handleAdd = async (query) => {
    const result = await add(query);
    if (result.status === 'error') {
      if (result.message) alert(result.message);
      return false;
    }
    setShowAddModal(false);
    updateUrl({ stock: result.stockId });
    if (result.status === 'duplicate') alert('此標的已在自選清單中。');
    return true;
  };

  const addModal = showAddModal && (
    <AddStockModal busy={busy} onSubmit={handleAdd} onClose={() => setShowAddModal(false)} />
  );

  // 清單裡只剩抓不到資料的佔位項目時（其餘股票都被刪掉了），等同股價無法取得
  const errorKind = error ?? (!loading && !selectedStock && stocks.length > 0 ? 'quote' : null);
  if (errorKind) return <ErrorScreen kind={errorKind} onRetry={load} />;
  if (loading) return <LoadingScreen />;

  // 使用者把清單刪光後的空狀態（刪光不會再被種回預設清單）
  if (!selectedStock) {
    return (
      <>
        <StatusCard title="自選清單是空的" message="新增第一檔台股開始追蹤。" actionLabel="新增標的" onAction={() => setShowAddModal(true)}>
          <div>
            <button onClick={() => signOut()} className="text-xs text-fg-faint hover:text-white font-black">登出</button>
          </div>
        </StatusCard>
        {addModal}
      </>
    );
  }

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-canvas">
      <AppHeader user={user} refreshing={busy} onRefresh={refresh} />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pt-4 pb-20 lg:max-w-none lg:min-h-0 lg:pb-4 lg:grid lg:grid-cols-dashboard lg:grid-rows-1 lg:gap-4">
        <WatchlistPanel
          className={tab === 'watchlist' ? '' : 'hidden lg:flex'}
          stocks={stocks}
          selectedId={selectedStock.id}
          refreshing={busy}
          onSelect={handleSelect}
          onRemove={remove}
          onAdd={() => setShowAddModal(true)}
        />
        <section className={(tab === 'watchlist' ? 'hidden lg:block ' : '') + 'lg:min-h-0 lg:overflow-y-auto lg:pr-0.5'}>
          <div className={tab === 'ai' ? 'hidden lg:block' : ''}>
            <StockDetail
              stock={selectedStock}
              candles={candlesById[selectedStock.id] ?? []}
              refreshing={busy}
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
              chartType={chartType}
              onChartTypeChange={setChartType}
            />
          </div>
          {tab === 'ai' && <div className="lg:hidden"><MobileAiPanel /></div>}
        </section>
      </main>

      {/* 電腦版最下方的 K 線說明連結 */}
      <footer className="hidden lg:flex bg-surface border-t-2 border-line-subtle py-4 px-6 text-xs text-fg-faint flex-shrink-0 items-center justify-center gap-1">
        <span className="font-black text-white mr-2">K 線是什麼？</span>
        <Link href="/guide" className="text-accent hover:text-accent-soft font-black transition-all underline">點此查看 K線型態圖典</Link>
      </footer>

      <MobileTabBar active={tab} stockId={selectedStock.id} />
      {addModal}
    </div>
  );
}
