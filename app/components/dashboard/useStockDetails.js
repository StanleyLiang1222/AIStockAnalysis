'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchStockDetails } from './api';

/**
 * 選到哪檔股票才載入那檔的深入資料。載入過的股票在這次瀏覽中保留，切換回來不重抓；
 * reload() 給「更新數據」用，重抓目前這檔。
 * 回傳 { details, status: 'loading' | 'ok' | 'error', reload }
 */
export function useStockDetails(stockId) {
  const [entries, setEntries] = useState({}); // { [stockId]: { status, data } }

  const load = useCallback(async (id) => {
    setEntries(prev => ({ ...prev, [id]: { status: 'loading', data: prev[id]?.data ?? null } }));
    try {
      const data = await fetchStockDetails(id);
      setEntries(prev => ({ ...prev, [id]: { status: 'ok', data } }));
    } catch (err) {
      if (err.status === 401) return;
      console.error(`載入 ${id} 深入資料失敗`, err);
      setEntries(prev => ({ ...prev, [id]: { status: 'error', data: prev[id]?.data ?? null } }));
    }
  }, []);

  useEffect(() => {
    if (stockId && !entries[stockId]) load(stockId);
  }, [stockId, entries, load]);

  const entry = stockId ? entries[stockId] : null;
  return {
    details: entry?.data ?? null,
    status: entry?.status ?? 'loading',
    reload: useCallback(() => stockId && load(stockId), [stockId, load]),
  };
}
