'use client';

import { useRef } from 'react';
import {
  DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '@/app/components/ui/Icon';
import { formatChange, formatPrice, getPriceLimit, getTrendColors } from '@/lib/format';

// 只能上下移動
const lockHorizontal = ({ transform }) => ({ ...transform, x: 0 });

/**
 * 自選清單（電腦版左欄、手機版「自選」分頁共用）。
 * 抓不到資料的股票以佔位列顯示，不能點選但可以刪除。
 * 拖曳排序：滑鼠按住移動 5px 以上開始拖曳（只是點一下仍是選取）；
 * 觸控長按 250ms 後開始拖曳（長按前手指移動就當作捲動頁面）；鍵盤可用空白鍵＋方向鍵。
 */
export function WatchlistPanel({ stocks, selectedId, refreshing, onSelect, onRemove, onReorder, onAdd, className = '' }) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  // 拖曳結束放開滑鼠時會觸發該列的 click，用這個旗標擋掉，避免拖完就切換到那一檔
  const justDragged = useRef(false);

  const handleDragEnd = ({ active, over }) => {
    justDragged.current = true;
    setTimeout(() => { justDragged.current = false; }, 0);
    if (over && active.id !== over.id) onReorder(active.id, over.id);
  };
  const handleSelect = (id) => {
    if (!justDragged.current) onSelect(id);
  };

  return (
    <div className={'bg-surface border-2 border-line rounded-xl p-4 flex flex-col lg:min-h-0 lg:overflow-hidden ' + className}>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-fg-muted flex items-center gap-1.5">
          我的自選清單
          {refreshing && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />}
        </h3>
        <button onClick={onAdd} className="p-1.5 px-3 bg-surface-selected border-2 border-line-strong hover:bg-line-strong rounded-lg flex items-center gap-1 font-bold text-fg transition-all shadow-md">
          <Icon name="plus" className="w-3.5 h-3.5" /> 新增標的
        </button>
      </div>
      <div className="flex-1 lg:overflow-y-auto space-y-2 pr-0.5">
        <DndContext
          id="watchlist-dnd"
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[lockHorizontal]}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragEnd}
        >
          <SortableContext items={stocks.map(s => s.id)} strategy={verticalListSortingStrategy}>
            {stocks.map(stock => (
              <SortableRow key={stock.id} id={stock.id}>
                {stock.unavailable
                  ? <PlaceholderRow stock={stock} onRemove={onRemove} />
                  : <StockRow stock={stock} isSelected={stock.id === selectedId} onSelect={handleSelect} onRemove={onRemove} />}
              </SortableRow>
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

// 可拖曳的外框：整列都是拖曳區域，拖曳中浮起並加陰影
function SortableRow({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={'relative select-none no-touch-callout rounded-lg ' + (isDragging ? 'z-10 shadow-2xl shadow-accent/20 cursor-grabbing' : '')}
      {...attributes}
      {...listeners}
      aria-roledescription="可拖曳排序的自選股"
    >
      {children}
    </div>
  );
}

function RemoveButton({ onClick }) {
  return (
    <button onClick={onClick} aria-label="刪除" className="p-1 text-fg-faint hover:text-up transition-all">
      <Icon name="trash2" className="w-4 h-4" />
    </button>
  );
}

function StockRow({ stock, isSelected, onSelect, onRemove }) {
  const trend = getTrendColors(stock.change);
  const limit = getPriceLimit(stock);
  // 漲停紅底、跌停綠底；所有列都留同樣內距，價格才會上下對齊
  const limitBg = limit === 'up' ? 'bg-up/20' : limit === 'down' ? 'bg-down/20' : '';
  return (
    <div
      onClick={() => onSelect(stock.id)}
      className={'p-3 rounded-lg border-2 transition-all cursor-pointer flex justify-between items-center gap-2 '
        + (isSelected ? 'bg-surface-selected border-accent shadow-lg shadow-accent/15 scale-99' : 'bg-surface-raised border-line-subtle hover:border-line-strong')}
    >
      <div className="min-w-0">
        {/* 名稱獨佔第一行，代碼與產業放第二行；過長時截斷，右側價格不被擠壓 */}
        <div className="text-sm font-bold text-fg truncate">{stock.name}</div>
        <div className="text-xs font-bold truncate">
          <span className="text-fg font-mono">{stock.id}</span>
          <span className="text-fg-muted">・{stock.category}</span>
        </div>
      </div>
      <div className="text-right flex items-center gap-3 flex-shrink-0">
        <div className={'px-2 py-0.5 rounded-md ' + limitBg} title={limit === 'up' ? '漲停' : limit === 'down' ? '跌停' : undefined}>
          <div className="text-sm font-mono font-extrabold text-fg">{formatPrice(stock.price)}</div>
          <div className={'text-xs font-mono font-black ' + trend.text}>{formatChange(stock.change, stock.changePercent)}</div>
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
        <div className="text-sm font-bold text-fg-muted font-mono">{stock.id}</div>
        <span className="text-xs text-fg-faint font-bold">資料暫時無法取得</span>
      </div>
      <RemoveButton onClick={() => onRemove(stock.id)} />
    </div>
  );
}
