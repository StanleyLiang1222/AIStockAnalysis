'use client';

import { useMemo } from 'react';
import { Icon } from '@/app/components/ui/Icon';
import { LineChart } from '@/app/components/charts/LineChart';
import { CandlestickChart } from '@/app/components/charts/CandlestickChart';
import { DailyCandlePanel } from '@/app/components/charts/DailyCandlePanel';
import { ChipsBarChart } from '@/app/components/charts/ChipsBarChart';
import { formatPrice, getTrendColors } from '@/lib/format';

// 走勢圖各區間取最近幾根日 K（1D 不畫走勢，另外顯示當日單根 K 棒）
const RANGE_DAYS = { '5D': 5, '1M': 22, '3M': 66, '1Y': 250 };
const RANGES = ['1D', '5D', '1M', '3M', '1Y'];

const CARD = 'bg-surface border-2 border-line rounded-xl';

/**
 * 個股分析：價格橫幅、走勢圖、三大法人、財務指標、AI 卡片。
 * 電腦版是右側分析區，手機版是「分析」分頁（垂直堆疊；AI 在獨立分頁，這裡只在電腦版顯示）。
 */
export function StockDetail({ stock, candles, refreshing, timeRange, onTimeRangeChange, chartType, onChartTypeChange }) {
  const currentCandles = useMemo(
    () => (RANGE_DAYS[timeRange] ? candles.slice(-RANGE_DAYS[timeRange]) : []),
    [timeRange, candles]
  );
  const trend = getTrendColors(stock.change);

  // 財報類指標：ETF 等沒有財報的標的為 null，顯示「—」
  const financialMetrics = [
    { label: 'EPS', period: stock.epsPeriod, value: stock.eps, format: (v) => `${v} 元`, colored: false },
    { label: 'YoY', period: stock.yoyPeriod, value: stock.yoy, format: (v) => `${v > 0 ? '+' : ''}${v}%`, colored: true },
    { label: 'ROE', period: '近四季', value: stock.roe, format: (v) => `${v}%`, colored: false },
  ];

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
              ) : <span className="hidden sm:inline">盤後高解析度診斷儀表板</span>}
            </span>
          </h2>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xl font-mono font-black text-white">{formatPrice(stock.price)}</div>
          <span className={'text-xs font-black ' + trend.text}>
            {stock.change >= 0 ? '+' : ''}{formatPrice(stock.change)} ({stock.changePercent}%)
          </span>
          <div className="text-2xs text-fg-muted font-bold font-mono mt-0.5">資料日期 {stock.dataDate}</div>
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

      {/* 籌碼、財務、AI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-shrink-0">
        <div className={CARD + ' p-3 flex flex-col justify-between shadow-md min-h-40'}>
          <span className="text-xs font-black text-white flex items-center gap-1.5"><Icon name="barChart2" className="w-4 h-4 text-violet" /> 三大法人買賣超 (張)</span>
          <div className="flex-1 flex flex-col justify-center mt-2 lg:mt-0"><ChipsBarChart chips={stock.chips} /></div>
        </div>
        <div className={CARD + ' p-3 flex flex-col justify-between shadow-md min-h-40'}>
          <span className="text-xs font-black text-white flex items-center gap-1.5"><Icon name="pieChart" className="w-4 h-4 text-down font-black" /> 財務季度診斷</span>
          <div className="grid grid-cols-3 gap-2 flex-1 items-center mt-1">
            {financialMetrics.map(m => (
              <div key={m.label} className="text-center">
                <div className="text-2xs text-slate-300 font-bold">{m.label}</div>
                <div className={'text-lg font-mono font-black mt-0.5 ' + (m.value != null && m.colored ? getTrendColors(m.value).text : 'text-white')}>
                  {m.value != null ? m.format(m.value) : '—'}
                </div>
                <div className="text-2xs text-fg-muted font-bold font-mono mt-0.5">{m.value != null && m.period ? m.period : ' '}</div>
              </div>
            ))}
          </div>
        </div>
        <div className={CARD + ' p-3 hidden lg:flex flex-col justify-between shadow-md min-h-40'}>
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-white flex items-center gap-1.5"><Icon name="sparkles" className="w-4 h-4 text-accent" /> AI 多空健檢</span>
            <button disabled className="px-2 py-0.5 bg-surface-raised text-fg-faint border border-line-strong rounded text-2xs font-black cursor-not-allowed">尚未開放</button>
          </div>
          <div className="bg-surface-raised border-2 border-line-subtle rounded-lg p-2 h-24 flex items-center justify-center text-2xs leading-relaxed text-fg-muted font-bold mt-1">
            AI 分析功能規劃中
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 手機版「AI」分頁
 */
export function MobileAiPanel() {
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-b from-accent/20 to-surface border-2 border-accent/30 rounded-xl p-4 text-center space-y-2">
        <Icon name="sparkles" className="w-6 h-6 text-accent-soft mx-auto" />
        <h3 className="text-xs font-black text-white">AI 籌碼多空分析師</h3>
        <button disabled className="w-full py-2 bg-surface-raised text-fg-faint border-2 border-line-strong text-xs font-bold rounded-lg cursor-not-allowed">
          尚未開放
        </button>
      </div>
      <div className={CARD + ' p-3 text-xs leading-relaxed text-fg-muted font-bold min-h-36 flex items-center justify-center'}>
        AI 分析功能規劃中
      </div>
    </div>
  );
}
