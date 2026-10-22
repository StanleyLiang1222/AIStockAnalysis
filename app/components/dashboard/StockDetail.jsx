'use client';

import { useMemo } from 'react';
import { Icon } from '@/app/components/ui/Icon';
import { LineChart } from '@/app/components/charts/LineChart';
import { CandlestickChart } from '@/app/components/charts/CandlestickChart';
import { DailyCandlePanel } from '@/app/components/charts/DailyCandlePanel';
import { ViewTabs, OverviewPanel, ChipsPanel, FundamentalsPanel, DividendsPanel } from './DetailPanels';
import { AiReportPanel } from './AiReport';
import { formatPrice, getTrendColors } from '@/lib/format';

// 走勢圖各區間取最近幾根日 K（1D 不畫走勢，另外顯示當日單根 K 棒）
const RANGE_DAYS = { '5D': 5, '1M': 22, '3M': 66, '1Y': 250 };
const RANGES = ['1D', '5D', '1M', '3M', '1Y'];

const CARD = 'bg-surface border-2 border-line rounded-xl';

const PANELS = {
  overview: OverviewPanel,
  chips: ChipsPanel,
  fundamentals: FundamentalsPanel,
  dividends: DividendsPanel,
  ai: AiReportPanel,
};

/**
 * 個股分析：價格橫幅、走勢圖，下方以子分頁切換「總覽／籌碼／基本面／股利／AI 健檢」。
 * 電腦版是右側分析區，手機版是「分析」分頁。電腦版的總覽最後一格另外顯示 AI 總評。
 * details 是選到這檔股票時才載入的深入資料（status: loading / ok / error）；ai 是 useAiReport 的狀態。
 */
export function StockDetail({
  stock, candles, refreshing, timeRange, onTimeRangeChange, chartType, onChartTypeChange,
  details, detailsStatus, ai, view, onViewChange,
}) {
  const Panel = PANELS[view] ?? OverviewPanel;
  const currentCandles = useMemo(
    () => (RANGE_DAYS[timeRange] ? candles.slice(-RANGE_DAYS[timeRange]) : []),
    [timeRange, candles]
  );
  const trend = getTrendColors(stock.change);

  return (
    <div className="flex flex-col gap-4">
      {/* 價格橫幅 */}
      <div className={CARD + ' p-4 flex justify-between items-center gap-3 shadow-lg flex-shrink-0'}>
        <div className="min-w-0">
          <span className="text-xs bg-surface-selected text-white px-2.5 py-0.5 rounded border border-line-strong font-mono font-bold">{stock.id}</span>
          <h2 className="text-lg font-black text-white mt-1 flex flex-wrap items-center gap-x-2">
            {stock.name}
            <span className="text-xs font-bold text-fg-muted flex items-center gap-1.5">
              {refreshing ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
                  真實數據載入中...
                </>
              ) : <span className="hidden sm:inline">高解析度診斷儀表板</span>}
            </span>
          </h2>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xl font-mono font-black text-white">{formatPrice(stock.price)}</div>
          <span className={'text-xs font-black ' + trend.text}>
            {stock.change >= 0 ? '+' : ''}{formatPrice(stock.change)} ({stock.changePercent}%)
          </span>
          <div className="text-2xs text-fg-muted font-bold font-mono mt-0.5 flex items-center justify-end gap-1.5">
            {stock.liveTime ? (
              <><span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />即時 {stock.liveTime}</>
            ) : `盤後・資料日期 ${stock.dataDate}`}
          </div>
        </div>
      </div>

      {/* 走勢圖（折線 / K線 可切換；1D 顯示當日單根 K 棒） */}
      <div className={CARD + ' p-4 shadow-md flex-shrink-0 flex flex-col'}>
        <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
          <span className="text-sm font-black text-white flex items-center gap-1.5">
            <Icon name="activity" className="w-5 h-5 text-accent" />
            {timeRange === '1D' ? '當日行情' : chartType === 'line' ? '走勢圖' : 'K線走勢圖'}
            {timeRange !== '1D' && (
              <span className="hidden sm:inline text-xs text-fg-muted font-normal ml-1">(含格線・Tooltip{chartType === 'candle' ? '・成交量' : ''})</span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <div className={'flex bg-inset p-1 rounded-lg border-2 border-line-strong text-xs' + (timeRange === '1D' ? ' invisible' : '')}>
              <button
                onClick={() => onChartTypeChange('line')}
                className={'px-3 py-1 rounded-md font-black transition-all flex items-center gap-1 ' + (chartType === 'line' ? 'bg-line text-accent border border-accent/30 shadow' : 'text-fg-faint hover:text-white')}
              >
                折線
              </button>
              <button
                onClick={() => onChartTypeChange('candle')}
                className={'px-3 py-1 rounded-md font-black transition-all flex items-center gap-1 ' + (chartType === 'candle' ? 'bg-line text-warn border border-warn/30 shadow' : 'text-fg-faint hover:text-white')}
              >
                K線
              </button>
            </div>
            <div className="flex bg-surface-raised p-1 rounded-lg border-2 border-line-strong text-xs">
              {RANGES.map(r => (
                <button key={r} onClick={() => onTimeRangeChange(r)} className={'px-2.5 sm:px-3 py-1 rounded-md font-black transition-all ' + (timeRange === r ? 'bg-line text-white shadow' : 'text-fg-faint')}>{r}</button>
              ))}
            </div>
          </div>
        </div>

        {timeRange === '1D' ? (
          <DailyCandlePanel candle={candles[candles.length - 1]} prevClose={candles[candles.length - 2]?.close} />
        ) : chartType === 'line' ? (
          <LineChart trendColors={trend} candles={currentCandles} />
        ) : (
          <CandlestickChart trendColors={trend} candles={currentCandles} />
        )}
      </div>

      {/* 子分頁 */}
      <ViewTabs view={view} onChange={onViewChange} />
      <Panel stock={stock} details={details} status={detailsStatus} ai={ai} onNavigate={onViewChange} />
    </div>
  );
}
