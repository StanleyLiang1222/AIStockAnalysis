'use client';

import { useCallback, useEffect, useState } from 'react';
import { STOCK_ID_PATTERN, normalizeStockId } from '@/lib/stock-id';
import { callWatchlistApi, fetchStocks, toListItem } from './api';

/**
 * 自選清單的資料與操作。
 * stocks 依清單順序排列（新加入的在最前面），抓不到資料的股票以 { id, unavailable: true } 佔位。
 * 選取哪一檔由呼叫端（網址）決定，這裡不處理。
 */
export function useWatchlist() {
  const [stocks, setStocks] = useState([]);
  const [candlesById, setCandlesById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // null | 'db' | 'quote'
  const [busy, setBusy] = useState(false); // 更新數據或新增中

  // 只保留拿到資料的股票 K 線
  const mergeCandles = (results) => {
    setCandlesById(prev => {
      const next = { ...prev };
      results.forEach(r => { if (r.ok) next[r.id] = r.candles; });
      return next;
    });
  };

  // 從資料庫讀取清單（新使用者的預設清單由伺服器端種入），再向伺服器取得股價
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    let ids;
    try {
      ids = await callWatchlistApi('GET');
    } catch (err) {
      if (err.status === 401) return; // 已導向登入頁，維持載入畫面
      console.error('載入自選清單失敗', err);
      setError('db');
      setLoading(false);
      return;
    }

    let results = [];
    if (ids.length > 0) {
      try {
        results = await fetchStocks(ids);
      } catch (err) {
        if (err.status === 401) return;
        console.error('載入股價失敗', err);
        // 503：伺服器讀不到快取表，代表資料庫連不上
        setError(err.status === 503 ? 'db' : 'quote');
        setLoading(false);
        return;
      }
    }

    // 清單裡有股票但一檔都抓不到：是 FinMind 的問題，不是清單真的空了
    if (results.length > 0 && results.every(r => !r.ok)) {
      setError('quote');
      setLoading(false);
      return;
    }

    setStocks(results.map(toListItem));
    mergeCandles(results);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 「更新數據」：向伺服器讀取最新快取，不直接呼叫 FinMind
  const refresh = useCallback(async () => {
    if (stocks.length === 0) return;
    setBusy(true);
    try {
      const results = await fetchStocks(stocks.map(s => s.id));
      // 這次抓不到、但畫面上已有資料的股票，保留原本的資料
      setStocks(prev => results.map(r => (r.ok ? toListItem(r) : prev.find(s => s.id === r.id) ?? toListItem(r))));
      mergeCandles(results);
    } catch (err) {
      if (err.status !== 401) {
        console.error('更新股價失敗', err);
        alert(err.status === 503 ? '更新失敗，請確認 Supabase 是否有啟動。' : '更新失敗，請稍後再試。');
      }
    } finally {
      setBusy(false);
    }
  }, [stocks]);

  /**
   * 新增股票。先確認 FinMind 查得到、再寫入資料庫，兩者都成功才更新畫面。
   * 回傳 { status: 'added' | 'duplicate', stockId } 或 { status: 'error', message }；
   * message 為 null 代表 session 過期、已導向登入頁。
   */
  const add = useCallback(async (input) => {
    const stockId = normalizeStockId(input);
    if (!STOCK_ID_PATTERN.test(stockId)) {
      return { status: 'error', message: '請輸入台股代碼，例如 2330 或 00878。' };
    }
    if (stocks.some(s => s.id === stockId)) {
      return { status: 'duplicate', stockId };
    }

    setBusy(true);
    try {
      let result;
      try {
        [result] = await fetchStocks([stockId]);
      } catch (err) {
        if (err.status === 401) return { status: 'error', message: null };
        console.error('取得股價失敗', err);
        return {
          status: 'error',
          message: err.status === 503 ? '請確認 Supabase 是否有啟動後再試一次。' : '股價資料暫時無法取得，請稍後再試。',
        };
      }
      if (!result.ok) {
        return {
          status: 'error',
          message: result.error === 'not_found'
            ? '查無此台股代碼，請確認代碼是否正確 (例如 2002 或 2330)。'
            : '股價資料暫時無法取得，請稍後再試。',
        };
      }

      // 先寫入資料庫成功，才更新畫面，避免畫面有、資料庫沒有，重整後消失
      try {
        await callWatchlistApi('POST', stockId);
      } catch (err) {
        if (err.status === 401) return { status: 'error', message: null };
        console.error('儲存自選股失敗', err);
        return { status: 'error', message: '自選股儲存失敗，請確認 Supabase 是否有啟動後再試一次。' };
      }

      setStocks(prev => [toListItem(result), ...prev.filter(s => s.id !== stockId)]);
      mergeCandles([result]);
      return { status: 'added', stockId };
    } finally {
      setBusy(false);
    }
  }, [stocks]);

  // 先從畫面移除，API 失敗再放回原位置。回傳是否成功。
  const remove = useCallback(async (id) => {
    const index = stocks.findIndex(s => s.id === id);
    if (index === -1) return true;
    const removed = stocks[index];
    setStocks(prev => prev.filter(s => s.id !== id));

    try {
      await callWatchlistApi('DELETE', id);
      return true;
    } catch (err) {
      if (err.status === 401) return false;
      console.error('刪除自選股失敗', err);
      setStocks(prev => {
        if (prev.some(s => s.id === id)) return prev;
        const next = [...prev];
        next.splice(Math.min(index, next.length), 0, removed);
        return next;
      });
      alert('刪除失敗，請確認 Supabase 是否有啟動後再試一次。');
      return false;
    }
  }, [stocks]);

  return { stocks, candlesById, loading, error, busy, load, refresh, add, remove };
}
