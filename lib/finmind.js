// FinMind 伺服器端存取（只能在 route handler 等伺服器端程式使用：token 不可進到前端）。
// 快取存在 Supabase 的 finmind_cache 表，所有使用者共用：
// - 未過期：直接用快取，不呼叫 FinMind
// - 過期或沒有快取：呼叫 FinMind，成功才寫入快取（錯誤不會被快取）
// - 呼叫失敗但有舊快取：沿用舊快取，畫面上由「資料日期」提示資料新舊
import { readFinMindCache, writeFinMindCache } from '@/lib/db';

const API_URL = 'https://api.finmindtrade.com/api/v4/data';
const HOUR = 60 * 60 * 1000;
const CONCURRENCY = 5; // 同時對 FinMind 發出的請求數上限，避免冷啟動時瞬間大量請求

export class StockNotFoundError extends Error {}

const toPureId = (stockId) => stockId.replace('.TW', '');

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

async function requestDataset(dataset, pureId, startDate) {
  const params = new URLSearchParams({ dataset, data_id: pureId });
  if (startDate) params.set('start_date', startDate);
  const headers = process.env.FINMIND_TOKEN ? { Authorization: `Bearer ${process.env.FINMIND_TOKEN}` } : {};
  const res = await fetch(`${API_URL}?${params}`, {
    headers,
    signal: AbortSignal.timeout(10000),
    cache: 'no-store', // 快取由 finmind_cache 表負責，不再被 Next.js 的 fetch 快取包一層
  });
  if (!res.ok) throw new Error(`FinMind ${dataset} 回應 HTTP ${res.status}`);
  const json = await res.json();
  if (json.msg !== 'success') throw new Error(`FinMind ${dataset} 回應 ${json.msg}`);
  return json.data ?? [];
}

// 一年日 K，整理成圖表用的 candles。查無資料代表代碼不存在。
async function fetchPrice(pureId) {
  const data = await requestDataset('TaiwanStockPrice', pureId, daysAgo(365));
  if (data.length === 0) throw new StockNotFoundError(pureId);
  return data.map((d) => ({
    time: d.date,
    open: d.open,
    high: d.max,
    low: d.min,
    close: d.close,
    volume: Math.round(d.Trading_Volume / 1000),
  }));
}

// 最近一個交易日的三大法人買賣超（張）
async function fetchChips(pureId) {
  const data = await requestDataset('TaiwanStockInstitutionalInvestorsBuySell', pureId, daysAgo(15));
  const chips = { foreign: 0, trust: 0, dealer: 0 };
  if (data.length === 0) return chips;
  const latestDate = data[data.length - 1].date;
  for (const item of data) {
    if (item.date !== latestDate) continue;
    const diff = Math.round((item.buy - item.sell) / 1000);
    if (item.name === 'Foreign_Investor') chips.foreign = diff;
    if (item.name === 'Investment_Trust') chips.trust = diff;
    if (item.name === 'Dealer_self' || item.name === 'Dealer_Hedging') chips.dealer += diff;
  }
  return chips;
}

// 最近一季 EPS；ETF 等沒有財報的標的為 0
async function fetchEps(pureId) {
  const data = await requestDataset('TaiwanStockFinancialStatements', pureId, daysAgo(365));
  const epsItems = data.filter((d) => d.type === 'EPS');
  return epsItems.length > 0 ? epsItems[epsItems.length - 1].value : 0;
}

async function fetchInfo(pureId) {
  const data = await requestDataset('TaiwanStockInfo', pureId);
  if (data.length === 0) return { name: `台股 ${pureId}`, category: '自選股' };
  return { name: data[0].stock_name, category: data[0].industry_category || '台股' };
}

const DATASETS = {
  price: { ttl: HOUR, fetch: fetchPrice },
  chips: { ttl: HOUR, fetch: fetchChips },
  eps: { ttl: 24 * HOUR, fetch: fetchEps },
  info: { ttl: 24 * HOUR, fetch: fetchInfo },
};

// 依序處理 items，同時最多 limit 個；fn 不可丟出錯誤
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// 依快取規則取得多檔股票的某一類資料。回傳與 stockIds 對應的 { ok, value } 或 { ok: false, error }
async function loadDataset(kind, stockIds, cache) {
  const { ttl, fetch } = DATASETS[kind];
  const now = Date.now();
  return mapWithConcurrency(stockIds, CONCURRENCY, async (stockId) => {
    const key = `${kind}:${toPureId(stockId)}`;
    const cached = cache.get(key);
    if (cached && now - new Date(cached.fetchedAt).getTime() < ttl) {
      return { ok: true, value: cached.payload };
    }

    let value;
    try {
      value = await fetch(toPureId(stockId));
    } catch (error) {
      if (cached && !(error instanceof StockNotFoundError)) {
        console.warn(`[finmind] ${key} 更新失敗，沿用 ${new Date(cached.fetchedAt).toISOString()} 的快取：${error.message}`);
        return { ok: true, value: cached.payload };
      }
      return { ok: false, error };
    }

    // 寫入快取失敗不影響這次回傳，下次會再重抓
    await writeFinMindCache(key, value).catch((err) => {
      console.error(`[finmind] ${key} 寫入快取失敗`, err);
    });
    return { ok: true, value };
  });
}

function buildStock(stockId, candles, chips, eps, info) {
  const latest = candles[candles.length - 1];
  const prev = candles.length > 1 ? candles[candles.length - 2] : latest;
  const change = parseFloat((latest.close - prev.close).toFixed(1));
  const changePercent = prev.close > 0 ? parseFloat(((change / prev.close) * 100).toFixed(2)) : 0;
  return {
    id: stockId,
    name: info.name,
    price: latest.close,
    change,
    changePercent,
    volume: latest.volume.toLocaleString('en-US'),
    category: info.category,
    eps,
    // YoY / ROE 尚未接上真實資料（第 5 階段處理），沿用原本的固定值
    yoy: 15.0,
    roe: 12.0,
    chips,
  };
}

/**
 * 取得多檔股票的完整資料。日 K 是必要資料，拿不到就回傳錯誤；籌碼、EPS、名稱拿不到則用預設值。
 * 回傳陣列順序與 stockIds 相同：
 *   { id, ok: true, stock, candles, dataDate } 或 { id, ok: false, error: 'not_found' | 'unavailable' }
 * 只有讀取快取表失敗（資料庫無法連線）時才會丟出錯誤。
 */
export async function getStocks(stockIds) {
  const keys = stockIds.flatMap((id) => Object.keys(DATASETS).map((kind) => `${kind}:${toPureId(id)}`));
  const cache = await readFinMindCache(keys);

  // 先抓日 K；代碼不存在或抓不到的股票，就不再浪費額度抓其他資料
  const prices = await loadDataset('price', stockIds, cache);
  const validIds = stockIds.filter((_, i) => prices[i].ok);
  const [chips, eps, info] = await Promise.all(
    ['chips', 'eps', 'info'].map((kind) => loadDataset(kind, validIds, cache))
  );

  let validIndex = 0;
  return stockIds.map((id, i) => {
    const price = prices[i];
    if (!price.ok) {
      if (!(price.error instanceof StockNotFoundError)) {
        console.error(`[finmind] ${id} 日 K 取得失敗：${price.error.message}`);
      }
      return { id, ok: false, error: price.error instanceof StockNotFoundError ? 'not_found' : 'unavailable' };
    }
    const j = validIndex++;
    const candles = price.value;
    const stock = buildStock(
      id,
      candles,
      chips[j].ok ? chips[j].value : { foreign: 0, trust: 0, dealer: 0 },
      eps[j].ok ? eps[j].value : 0,
      info[j].ok ? info[j].value : { name: `台股 ${toPureId(id)}`, category: '自選股' }
    );
    return { id, ok: true, stock, candles, dataDate: candles[candles.length - 1].time };
  });
}
