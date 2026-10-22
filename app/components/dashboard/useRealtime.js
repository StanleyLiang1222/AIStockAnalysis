'use client';

import { useEffect, useState } from 'react';
import { fetchRealtime } from './api';

const POLL_MS = 60 * 1000;

// 台灣時間的週一到週五 09:00–13:35（多留 5 分鐘給收盤後的最後一筆）
function isTradingHours() {
  const t = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const day = t.getUTCDay();
  const minutes = t.getUTCHours() * 60 + t.getUTCMinutes();
  return day >= 1 && day <= 5 && minutes >= 9 * 60 && minutes <= 13 * 60 + 35;
}

/**
 * 今天盤中的即時行情。載入時抓一次（涵蓋收盤後 FinMind 還沒更新的空窗），
 * 之後只在交易時間、頁面開著時每 60 秒更新；切回頁面時立刻補抓一次。
 * 抓不到時保留上一次的結果，畫面不顯示錯誤。
 * 回傳 { index, quotes: { '2330.TW': quote } }
 */
export function useRealtime(stockIds) {
  const [data, setData] = useState({ index: null, quotes: {} });
  const idsKey = stockIds.join(',');

  useEffect(() => {
    if (!idsKey) return;
    let cancelled = false;
    const load = async () => {
      try {
        const next = await fetchRealtime(idsKey.split(','));
        if (!cancelled) setData(next);
      } catch (err) {
        if (err.status !== 401) console.error('取得即時行情失敗', err);
      }
    };
    const tick = () => {
      if (!document.hidden && isTradingHours()) load();
    };

    load();
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [idsKey]);

  return data;
}
