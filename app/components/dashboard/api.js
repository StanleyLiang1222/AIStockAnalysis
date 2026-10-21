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
