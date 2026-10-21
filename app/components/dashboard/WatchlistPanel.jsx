'use client';

import { Icon } from '@/app/components/ui/Icon';
import { formatPrice, getTrendColors } from '@/lib/format';

/**
 * 自選清單（電腦版左欄、手機版「自選」分頁共用）。
 * 抓不到資料的股票以佔位列顯示，不能點選但可以刪除。
 */
export function WatchlistPanel({ stocks, selectedId, refreshing, onSelect, onRemove, onAdd, className = '' }) {
  return (
    <div className={'bg-surface border-2 border-line rounded-xl p-4 flex flex-col lg:min-h-0 lg:overflow-hidden ' + className}>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-fg-muted flex items-center gap-1.5">
          我的自選清單
          {refreshing && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />}
        </h3>
        <button onClick={onAdd} className="p-1.5 px-3 bg-surface-selected border-2 border-line-strong hover:bg-line-strong rounded-lg flex items-center gap-1 font-bold text-white transition-all shadow-md">
          <Icon name="plus" className="w-3.5 h-3.5" /> 新增標的
        </button>
      </div>
      <div className="flex-1 lg:overflow-y-auto space-y-2 pr-0.5">
        {stocks.map(stock => (stock.unavailable
          ? <PlaceholderRow key={stock.id} stock={stock} onRemove={onRemove} />
          : <StockRow key={stock.id} stock={stock} isSelected={stock.id === selectedId} onSelect={onSelect} onRemove={onRemove} />
        ))}
      </div>
    </div>
  );
}

function RemoveButton({ onClick }) {
  return (
    <button onClick={onClick} aria-label="刪除" className="p-1 text-slate-500 hover:text-up transition-all">
      <Icon name="trash2" className="w-4 h-4" />
    </button>
  );
}

function StockRow({ stock, isSelected, onSelect, onRemove }) {
  const trend = getTrendColors(stock.change);
  return (
    <div
      onClick={() => onSelect(stock.id)}
      className={'p-3 rounded-lg border-2 transition-all cursor-pointer flex justify-between items-center gap-2 '
        + (isSelected ? 'bg-surface-selected border-accent shadow-lg shadow-accent/15 scale-99' : 'bg-surface-raised border-line-subtle hover:border-line-strong')}
    >
      <div className="min-w-0">
        {/* 名稱過長時截斷，代碼與右側價格不被擠壓 */}
        <div className="text-sm font-bold text-white flex items-center gap-1.5">
          <span className="truncate">{stock.name}</span>
          <span className="text-xs text-slate-300 font-mono font-bold flex-shrink-0">{stock.id}</span>
        </div>
        <span className="text-xs text-slate-400 font-bold">{stock.category}</span>
      </div>
      <div className="text-right flex items-center gap-3 flex-shrink-0">
        <div>
          <div className="text-sm font-mono font-extrabold text-white">{formatPrice(stock.price)}</div>
          <div className={'text-xs font-mono font-black ' + trend.text}>{stock.change >= 0 ? '+' : ''}{stock.changePercent}%</div>
        </div>
        <RemoveButton onClick={(e) => { e.stopPropagation(); onRemove(stock.id); }} />
      </div>
    </div>
  );
}

function PlaceholderRow({ stock, onRemove }) {
  return (
    <div className="p-3 rounded-lg border-2 bg-surface-raised border-line-subtle flex justify-between items-center">
      <div>
        <div className="text-sm font-bold text-slate-400 font-mono">{stock.id}</div>
        <span className="text-xs text-slate-500 font-bold">資料暫時無法取得</span>
      </div>
      <RemoveButton onClick={() => onRemove(stock.id)} />
    </div>
  );
}
