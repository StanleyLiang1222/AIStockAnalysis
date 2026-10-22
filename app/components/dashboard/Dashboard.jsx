'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useWatchlist } from './useWatchlist';
import { useStockDetails } from './useStockDetails';
import { useMarket } from './useMarket';
import { useAiReport } from './useAiReport';
import { useRealtime } from './useRealtime';
import { applyQuote, appendLiveCandle, applyIndex } from './realtime';
import { MarketBar } from './MarketBar';
import { VIEWS } from './DetailPanels';
import { AppHeader } from './AppHeader';
import { WatchlistPanel } from './WatchlistPanel';
import { StockDetail } from './StockDetail';
import { MobileTabBar, MOBILE_TABS } from './MobileTabBar';
import { AddStockModal } from './AddStockModal';
import { LoadingScreen, ErrorScreen, StatusCard } from './StatusScreen';

/**
 * 儀表板。版面依寬度切換（Tailwind lg = 1024px）：
 * - 1024px 以上：左側固定寬度自選清單 + 右側分析區
 * - 1024px 以下：底部分頁列切換「自選／分析」，內容垂直堆疊
 * 選取的股票、手機版分頁、分析子分頁記錄在網址（?stock=2330.TW&tab=analysis&view=chips），
 * 返回鍵、重新整理、分享網址都會保留。切換子分頁只替換網址，不新增瀏覽紀錄。
 */
export function Dashboard({ user }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { stocks: closedStocks, candlesById, loading, error, busy, load, refresh, add, remove } = useWatchlist();
  // 盤中用證交所即時行情蓋上今天的股價（AI 報告在伺服器端只用 FinMind 盤後資料，不受影響）
  const realtime = useRealtime(closedStocks.filter(s => !s.unavailable).map(s => s.id));
  const stocks = useMemo(
    () => closedStocks.map(s => applyQuote(s, realtime.quotes[s.id])),
    [closedStocks, realtime]
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [timeRange, setTimeRange] = useState('1M');
  const [chartType, setChartType] = useState('line');

  const tab = MOBILE_TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'watchlist';
  const view = VIEWS.some(v => v.key === searchParams.get('view')) ? searchParams.get('view') : 'overview';
  const requestedId = searchParams.get('stock');
  const available = stocks.filter(s => !s.unavailable);
  // 網址指定的股票不在清單裡（或已刪除），就退回清單第一檔
  const selectedStock = available.find(s => s.id === requestedId) ?? available[0] ?? null;
  const { details, status: detailsStatus, reload: reloadDetails } = useStockDetails(loading ? null : selectedStock?.id);
  const { market: closedMarket, loading: marketLoading, reload: reloadMarket } = useMarket();
  const market = useMemo(() => applyIndex(closedMarket, realtime.index), [closedMarket, realtime]);
  const selectedCandles = useMemo(
    () => (selectedStock ? appendLiveCandle(candlesById[selectedStock.id] ?? [], realtime.quotes[selectedStock.id]) : []),
    [selectedStock, candlesById, realtime]
  );
  const ai = useAiReport(loading ? null : selectedStock?.id);

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

  // 舊版手機底部的「AI」分頁已改為分析區的子分頁，舊網址 ?tab=ai 導向新位置
  const legacyAiTab = searchParams.get('tab') === 'ai';
  useEffect(() => {
    if (legacyAiTab) updateUrl({ tab: 'analysis', view: 'ai' }, { replace: true });
  }, [legacyAiTab, updateUrl]);

  const handleSelect = (stockId) => updateUrl({ stock: stockId, tab: 'analysis' });
  const handleViewChange = (nextView) => updateUrl({ view: nextView }, { replace: true });

  // 「更新數據」：清單股價、大盤、目前這檔的深入資料與 AI 報告一起更新（都是讀伺服器快取，不會產生新報告）
  const handleRefresh = () => {
    refresh();
    reloadMarket();
    reloadDetails();
    if (ai.status !== 'generating') ai.reload();
  };

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
            <button onClick={() => signOut()} className="text-xs text-fg-faint hover:text-fg font-black">登出</button>
          </div>
        </StatusCard>
        {addModal}
      </>
    );
  }

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-canvas">
      <AppHeader user={user} refreshing={busy} onRefresh={handleRefresh} />
      <MarketBar market={market} loading={marketLoading} />

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
          <StockDetail
            stock={selectedStock}
            candles={selectedCandles}
            refreshing={busy}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            chartType={chartType}
            onChartTypeChange={setChartType}
            details={details}
            detailsStatus={detailsStatus}
            ai={ai}
            view={view}
            onViewChange={handleViewChange}
          />
        </section>
      </main>

      {/* 電腦版最下方的 K 線說明連結 */}
      <footer className="hidden lg:flex bg-surface border-t-2 border-line-subtle py-4 px-6 text-xs text-fg-faint flex-shrink-0 items-center justify-center gap-1">
        <span className="font-black text-fg mr-2">K 線是什麼？</span>
        <Link href="/guide" className="text-accent hover:text-accent-soft font-black transition-all underline">點此查看 K線型態圖典</Link>
      </footer>

      <MobileTabBar active={tab} stockId={selectedStock.id} view={view} />
      {addModal}
    </div>
  );
}
