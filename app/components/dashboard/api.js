export class ApiError extends Error {
  constructor(status) {
    super(`API 回應 ${status}`);
    this.status = status;
  }
}

/**
 * 呼叫自家 API。401（session 過期）直接導回登入頁；其他失敗一律丟出 ApiError，
 * 網路層錯誤則是 fetch 本身丟出的 TypeError。
 */
export async function requestJson(url, init) {
  const res = await fetch(url, init);
  if (res.status === 401) {
    window.location.href = '/login';
    throw new ApiError(401);
  }
  if (!res.ok) {
    throw new ApiError(res.status);
  }
  return res.json();
}

export async function callWatchlistApi(method, stockId) {
  const init = { method };
  let url = '/api/watchlist';
  if (method === 'POST') {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify({ stockId });
  } else if (method === 'DELETE') {
    url += `?stockId=${encodeURIComponent(stockId)}`;
  }
  const { watchlist } = await requestJson(url, init);
  return watchlist;
}

/**
 * 從伺服器取得多檔股票資料（伺服器端呼叫 FinMind 並快取，前端不直接呼叫 FinMind）。
 * 回傳與 ids 同順序的陣列：{ id, ok: true, stock, candles, dataDate } 或 { id, ok: false, error }
 */
export async function fetchStocks(ids) {
  const { results } = await requestJson(`/api/stocks?ids=${ids.map(encodeURIComponent).join(',')}`);
  return results;
}

/**
 * 伺服器回傳的結果轉成清單項目：抓不到資料的股票以佔位項目保留在清單中
 */
export const toListItem = (result) => (
  result.ok ? { ...result.stock, dataDate: result.dataDate } : { id: result.id, unavailable: true }
);

/**
 * 依名稱或代碼搜尋股票（伺服器端搜尋），回傳最多 10 筆 [{ id: '2603.TW', name, category, market }]
 */
export async function searchStocks(query, signal) {
  const { results } = await requestJson(`/api/stocks/search?q=${encodeURIComponent(query)}`, { signal });
  return results;
}

// 個股深入資料（估值、籌碼延伸、基本面延伸、股利），各區塊抓不到時為 null
export async function fetchStockDetails(stockId) {
  return requestJson(`/api/stocks/details?id=${encodeURIComponent(stockId)}`);
}

// 大盤資訊 { taiex, institutional, margin }，抓不到的項目為 null
export async function fetchMarket() {
  return requestJson('/api/market');
}

// AI 健檢報告 { dataDate, status: 'none' | 'generating' | 'ready', report, createdAt }
export async function fetchAiReport(stockId) {
  return requestJson(`/api/ai-report?id=${encodeURIComponent(stockId)}`);
}

// 產生 AI 健檢報告（約 20–60 秒）。別人正在產生同一份時回傳 status: 'generating'
export async function generateAiReport(stockId) {
  return requestJson('/api/ai-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stockId }),
  });
}

// 今天盤中的即時行情 { index, quotes: { '2330.TW': quote } }；盤後、假日或證交所抓不到時為空
export async function fetchRealtime(ids) {
  return requestJson(`/api/realtime?ids=${ids.map(encodeURIComponent).join(',')}`);
}
