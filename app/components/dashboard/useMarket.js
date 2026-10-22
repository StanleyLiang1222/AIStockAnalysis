'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchMarket } from './api';

/**
 * 大盤資訊 { taiex, institutional, margin }；抓不到時為 null（資訊列顯示無法取得）。
 */
export function useMarket() {
  const [market, setMarket] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMarket(await fetchMarket());
    } catch (err) {
      if (err.status !== 401) console.error('載入大盤資訊失敗', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { market, loading, reload: load };
}
