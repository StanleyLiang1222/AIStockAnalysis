// 證交所即時行情（mis.twse.com.tw，證交所網站自己使用的非正式介面），只用來補「今天盤中」這一根；
// 歷史資料仍以 FinMind 為準。一次請求可同時查上市（tse_）、上櫃（otc_）與加權指數（tse_t00）。
// 快取：每個代碼 30 秒，記憶體 + finmind_cache 表（key 形如 realtime:2330），所有使用者共用，
// 避免請求太頻繁被證交所暫時封鎖。抓不到時沿用舊快取，再不行就回傳空結果（畫面維持盤後資料）。
import { readFinMindCache, writeFinMindCache } from '@/lib/db';
import { getStockMarkets, toPureId } from '@/lib/finmind';

const API_URL = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp';
const TTL = 30 * 1000;
export const INDEX_CODE = 't00'; // 加權指數

const memo = new Map(); // code → { quote, fetchedAt }

const todayInTaipei = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });

// 證交所的數值欄位是字串，沒有資料時為 '-' 或空值
const toNumber = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// 最佳一檔買價、賣價（'2385.0000_2380.0000_...' 取第一個）的中間值
function midPrice(item) {
  const bid = toNumber(item.b?.split('_')[0]);
  const ask = toNumber(item.a?.split('_')[0]);
  if (bid && ask) return Math.round(((bid + ask) / 2) * 100) / 100;
  return bid ?? ask;
}

// 證交所回應的一筆 → { date, time, price, open, high, low, prevClose, volume }；無效資料回傳 null。
// 那一刻沒有成交（z 為 '-'）時，改用最佳買賣價中間值，再不行沿用上一次同一天的價格。
function parseQuote(item, previous) {
  if (!item.c || !item.d) return null;
  const date = `${item.d.slice(0, 4)}-${item.d.slice(4, 6)}-${item.d.slice(6, 8)}`;
  const price = toNumber(item.z) ?? midPrice(item) ?? (previous?.date === date ? previous.price : null);
  const prevClose = toNumber(item.y);
  if (price == null || prevClose == null) return null;
  const volume = parseInt(item.v, 10);
  return {
    date,
    time: item.t,
    price,
    open: toNumber(item.o),
    high: toNumber(item.h),
    low: toNumber(item.l),
    prevClose,
    volume: Number.isFinite(volume) ? volume : null, // 累計成交量（張）；指數沒有
  };
}

async function requestQuotes(channels) {
  const params = new URLSearchParams({ ex_ch: channels.join('|'), json: '1', delay: '0' });
  const res = await fetch(`${API_URL}?${params}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(5000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`證交所即時行情回應 HTTP ${res.status}`);
  const json = await res.json();
  if (json.rtmessage !== 'OK') throw new Error(`證交所即時行情回應 ${json.rtmessage}`);
  return json.msgArray ?? [];
}

// 查不到市場別（清單抓不到或不在清單內）的代碼，上市、上櫃都查，以有回應的為準
async function toChannels(codes) {
  const markets = await getStockMarkets().catch((err) => {
    console.error('[twse] 股票清單取得失敗，改為上市上櫃都查詢', err.message);
    return new Map();
  });
  return codes.flatMap((code) => {
    if (code === INDEX_CODE) return [`tse_${code}.tw`];
    const market = markets.get(code);
    if (market === 'twse') return [`tse_${code}.tw`];
    if (market === 'tpex') return [`otc_${code}.tw`];
    return [`tse_${code}.tw`, `otc_${code}.tw`];
  });
}

/**
 * 取得多檔股票與加權指數的即時行情。只回傳「今天（台灣時間）」的報價，盤後、假日回傳空結果。
 * 回傳 { index: quote | null, quotes: { '2330.TW': quote } }
 */
export async function getRealtimeQuotes(stockIds) {
  const codes = [INDEX_CODE, ...new Set(stockIds.map(toPureId))];
  const now = Date.now();
  const result = new Map(); // code → quote
  const stale = new Map(); // code → 過期的快取（抓不到時沿用）

  let missing = codes.filter((code) => {
    const hit = memo.get(code);
    if (hit && now - hit.fetchedAt < TTL) result.set(code, hit.quote);
    else if (hit) stale.set(code, hit.quote);
    return !(hit && now - hit.fetchedAt < TTL);
  });

  if (missing.length > 0) {
    const cache = await readFinMindCache(missing.map((code) => `realtime:${code}`)).catch((err) => {
      console.error('[twse] 讀取快取失敗', err.message);
      return new Map();
    });
    missing = missing.filter((code) => {
      const cached = cache.get(`realtime:${code}`);
      if (!cached) return true;
      const fetchedAt = new Date(cached.fetchedAt).getTime();
      if (now - fetchedAt < TTL) {
        result.set(code, cached.payload);
        memo.set(code, { quote: cached.payload, fetchedAt });
        return false;
      }
      stale.set(code, cached.payload);
      return true;
    });
  }

  if (missing.length > 0) {
    try {
      const items = await requestQuotes(await toChannels(missing));
      const fetched = new Map();
      for (const item of items) {
        const quote = parseQuote(item, stale.get(item.c));
        if (quote && missing.includes(item.c)) fetched.set(item.c, quote);
      }
      await Promise.all([...fetched].map(([code, quote]) => {
        result.set(code, quote);
        memo.set(code, { quote, fetchedAt: now });
        return writeFinMindCache(`realtime:${code}`, quote).catch((err) => {
          console.error(`[twse] realtime:${code} 寫入快取失敗`, err.message);
        });
      }));
    } catch (err) {
      console.error('[twse] 即時行情取得失敗，沿用舊快取', err.message);
    }
    for (const code of missing) {
      if (!result.has(code) && stale.has(code)) result.set(code, stale.get(code));
    }
  }

  const today = todayInTaipei();
  const live = (code) => (result.get(code)?.date === today ? result.get(code) : null);
  return {
    index: live(INDEX_CODE),
    quotes: Object.fromEntries(stockIds.map((id) => [id, live(toPureId(id))]).filter(([, quote]) => quote)),
  };
}
