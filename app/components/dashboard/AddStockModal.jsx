'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/app/components/ui/Icon';
import { searchStocks } from './api';

const MARKET_LABEL = { twse: '上市', tpex: '上櫃' };
const DEBOUNCE_MS = 200;

/**
 * 新增自選股：輸入名稱或代碼，邊打字邊顯示建議清單（↑↓ 選擇、Enter 加入、Esc 關閉）。
 * 沒有建議時，把輸入當成代碼送出（相容原本輸入完整代碼的用法）。
 */
export function AddStockModal({ busy, onSubmit, onClose }) {
  const [query, setQuery] = useState('');
  // results 對應的查詢字串，用來判斷清單是不是目前輸入的結果
  const [search, setSearch] = useState({ query: '', results: [] });
  const [activeIndex, setActiveIndex] = useState(0);

  const trimmed = query.trim();
  const isCurrent = search.query === trimmed;
  const suggestions = isCurrent ? search.results : [];

  // 輸入停頓 200ms 才搜尋；新的輸入會取消上一個請求，避免舊結果蓋掉新結果
  useEffect(() => {
    if (!trimmed) {
      setSearch({ query: '', results: [] });
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const results = await searchStocks(trimmed, controller.signal);
        setSearch({ query: trimmed, results });
        setActiveIndex(0);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('搜尋股票失敗', err);
        setSearch({ query: trimmed, results: [] });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  const add = async (value) => {
    const done = await onSubmit(value);
    if (done) setQuery('');
  };

  const confirm = async () => {
    if (busy || !trimmed) return;
    // 打字太快、清單還是上一次輸入的結果時，先即時搜尋，避免加入錯的股票
    let results = suggestions;
    let index = activeIndex;
    if (!isCurrent) {
      try {
        results = await searchStocks(trimmed);
      } catch {
        results = [];
      }
      index = 0;
    }
    const picked = results[index];
    add(picked ? picked.id : trimmed);
  };

  const handleKeyDown = (e) => {
    // 注音等輸入法選字時的按鍵（Enter 確認選字、方向鍵切換候選字）不處理；
    // Safari 選字的 Enter 也會觸發表單送出，所以 Enter 一律在這裡自行處理
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      confirm();
    } else if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault();
      setActiveIndex(i => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault();
      setActiveIndex(i => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    // 手機版靠上顯示，避免被螢幕鍵盤擋住
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4 pt-16 sm:pt-4">
      <div className="bg-surface border-2 border-line-strong w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-5 py-3 border-b-2 border-line-subtle flex justify-between items-center">
          <h4 className="text-sm font-black text-fg flex items-center gap-1.5"><Icon name="plus" className="w-4 h-4 text-accent" /> 新增自選監控標的</h4>
          <button onClick={onClose} className="text-fg-faint hover:text-fg text-xs font-black">關閉</button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); confirm(); }} className="p-5 space-y-3">
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="輸入股票名稱或代碼，例如：長榮、2330"
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-controls="stock-suggestions"
            aria-activedescendant={suggestions[activeIndex] ? `stock-option-${activeIndex}` : undefined}
            autoComplete="off"
            className="w-full bg-surface-raised border-2 border-line-strong rounded-xl px-3.5 py-2.5 text-base lg:text-xs text-fg placeholder-fg-faint font-bold focus:outline-none focus:border-accent"
            autoFocus />

          {suggestions.length > 0 && (
            <ul id="stock-suggestions" role="listbox" className="max-h-64 overflow-y-auto rounded-xl border-2 border-line-strong bg-surface-raised divide-y divide-line-subtle">
              {suggestions.map((s, i) => (
                <li key={s.id} id={`stock-option-${i}`} role="option" aria-selected={i === activeIndex}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => add(s.id)}
                    disabled={busy}
                    className={'w-full px-3.5 py-2.5 flex items-center gap-3 text-left transition-all ' + (i === activeIndex ? 'bg-surface-selected' : '')}
                  >
                    <span className="text-xs font-mono font-bold text-fg w-14 flex-shrink-0">{s.id.replace('.TW', '')}</span>
                    <span className="text-sm font-bold text-fg truncate">{s.name}</span>
                    <span className="ml-auto text-2xs text-fg-muted font-bold flex-shrink-0 max-w-28 truncate">{MARKET_LABEL[s.market]}・{s.category}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {trimmed && isCurrent && suggestions.length === 0 && (
            <p className="text-xs text-fg-muted font-bold px-1">找不到符合的股票，可直接輸入完整代碼後按確認。</p>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 bg-surface-raised text-fg-muted text-xs font-bold rounded-lg border-2 border-line-strong">取消</button>
            <button type="submit" disabled={busy} className="flex-1 py-2 bg-accent text-white text-xs font-bold rounded-lg hover:bg-accent-hover">{busy ? '新增中...' : '確認新增'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
