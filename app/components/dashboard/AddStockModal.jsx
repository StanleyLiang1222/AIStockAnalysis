'use client';

import { useState } from 'react';
import { Icon } from '@/app/components/ui/Icon';

export function AddStockModal({ busy, onSubmit, onClose }) {
  const [query, setQuery] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    const done = await onSubmit(query);
    if (done) setQuery('');
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border-2 border-line-strong w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-5 py-3 border-b-2 border-line-subtle flex justify-between items-center">
          <h4 className="text-sm font-black text-white flex items-center gap-1.5"><Icon name="plus" className="w-4 h-4 text-accent" /> 新增自選監控標的</h4>
          <button onClick={onClose} className="text-fg-faint hover:text-white text-xs font-black">關閉</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="輸入台股代碼，例如: 2330, 00878"
            inputMode="text"
            className="w-full bg-surface-raised border-2 border-line-strong rounded-xl px-3.5 py-2.5 text-base lg:text-xs text-white placeholder-fg-faint font-bold focus:outline-none focus:border-accent"
            autoFocus />
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 bg-surface-raised text-slate-400 text-xs font-bold rounded-lg border-2 border-line-strong">取消</button>
            <button type="submit" disabled={busy} className="flex-1 py-2 bg-accent text-white text-xs font-bold rounded-lg hover:bg-accent-hover">{busy ? '新增中...' : '確認新增'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
