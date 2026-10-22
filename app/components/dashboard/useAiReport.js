'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchAiReport, generateAiReport } from './api';

const POLL_MS = 4000;

/**
 * AI 健檢報告狀態。選到股票時先讀取已存在的報告（不花費），按下按鈕才產生。
 * 別人正在產生同一份報告時，每 4 秒重新讀取一次，直到報告完成或對方失敗釋放鎖。
 * 回傳 { status, report, dataDate, createdAt, errorStatus, waiting, generate, reload }
 *   waiting: 產生中且是別人觸發的（等待輪詢中）
 *   status: 'loading' | 'none' | 'generating' | 'ready' | 'error'
 */
export function useAiReport(stockId) {
  const [entries, setEntries] = useState({}); // { [stockId]: { status, report, dataDate, createdAt, waiting, errorStatus } }

  const update = useCallback((id, patch) => {
    setEntries(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const apply = useCallback((id, data, { waiting = false } = {}) => {
    update(id, {
      status: data.status,
      report: data.report,
      dataDate: data.dataDate,
      createdAt: data.createdAt,
      waiting: data.status === 'generating' && waiting,
      errorStatus: null,
    });
  }, [update]);

  const load = useCallback(async (id, { silent = false } = {}) => {
    if (!silent) update(id, { status: 'loading' });
    try {
      // 讀到「產生中」代表是別人觸發的，進入等待輪詢
      apply(id, await fetchAiReport(id), { waiting: true });
    } catch (err) {
      if (err.status === 401) return;
      console.error(`讀取 ${id} AI 報告失敗`, err);
      update(id, { status: 'error', waiting: false, errorStatus: err.status ?? null });
    }
  }, [apply, update]);

  const generate = useCallback(async () => {
    if (!stockId) return;
    const id = stockId;
    update(id, { status: 'generating', waiting: false, errorStatus: null });
    try {
      apply(id, await generateAiReport(id), { waiting: true });
    } catch (err) {
      if (err.status === 401) return;
      console.error(`產生 ${id} AI 報告失敗`, err);
      update(id, { status: 'error', waiting: false, errorStatus: err.status ?? null });
    }
  }, [stockId, apply, update]);

  useEffect(() => {
    if (stockId && !entries[stockId]) load(stockId);
  }, [stockId, entries, load]);

  const entry = stockId ? entries[stockId] : null;

  useEffect(() => {
    if (!entry?.waiting) return;
    const timer = setTimeout(() => load(stockId, { silent: true }), POLL_MS);
    return () => clearTimeout(timer);
  }, [entry, stockId, load]);

  return {
    status: entry?.status ?? 'loading',
    report: entry?.report ?? null,
    dataDate: entry?.dataDate ?? null,
    createdAt: entry?.createdAt ?? null,
    errorStatus: entry?.errorStatus ?? null,
    waiting: entry?.waiting ?? false,
    generate,
    reload: useCallback(() => stockId && load(stockId), [stockId, load]),
  };
}
