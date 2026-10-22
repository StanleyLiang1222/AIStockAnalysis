// 個股深入資料（估值、籌碼延伸、基本面延伸、股利），只在使用者選到某檔股票時才載入。
// 快取規則與 lib/finmind.js 相同（finmind_cache 表，錯誤不快取，失敗時沿用舊快取）；
// 各區塊獨立快取、獨立失敗，某一區塊抓不到時回傳 null，不影響其他區塊。
// 統計值（區間位置、連續買賣超、填息天數等）都在這裡算好，只快取結果，傳到前端的資料量很小。
import { readFinMindCache } from '@/lib/db';
import { HOUR, daysAgo, loadDataset, requestDataset, toPureId, toQuarter } from '@/lib/finmind';

const TREND_DAYS = 20; // 籌碼趨勢取近 20 個交易日
const round1 = (v) => Math.round(v * 10) / 10;
const toYi = (v) => round1(v / 1e8); // 元 → 億
const toLots = (shares) => Math.round(shares / 1000); // 股 → 張

// 台灣時間的今天（YYYY-MM-DD），判斷除息日是否已過
const todayInTaipei = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });

// ---------- 估值 ----------

// 目前值在近 3 年分布中的位置。<= 0 的值（虧損時本益比為 0）不計入；資料太少時不算區間。
function rangeStats(values, current) {
  if (!(current > 0)) return null;
  const sorted = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (sorted.length < 60) return { current, min: null, median: null, max: null, percentile: null };
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const below = sorted.filter((v) => v <= current).length;
  return {
    current,
    min: sorted[0],
    median: round1(median),
    max: sorted[sorted.length - 1],
    percentile: Math.round((below / sorted.length) * 100),
  };
}

// 本益比、淨值比、殖利率（每日）。ETF 在這個 dataset 沒有資料，各欄位為 null。
async function fetchValuation(pureId) {
  const data = await requestDataset('TaiwanStockPER', pureId, daysAgo(1100));
  const latest = data[data.length - 1];
  if (!latest) return { date: null, per: null, pbr: null, dividendYield: null };
  return {
    date: latest.date,
    per: rangeStats(data.map((d) => d.PER), latest.PER),
    pbr: rangeStats(data.map((d) => d.PBR), latest.PBR),
    dividendYield: rangeStats(data.map((d) => d.dividend_yield), latest.dividend_yield),
  };
}

// ---------- 籌碼 ----------

// 從最新一天往回數，同方向（買超或賣超）連續幾天
function streak(series, field) {
  const last = series[series.length - 1]?.[field];
  if (!last) return { days: 0, direction: null };
  const sign = Math.sign(last);
  let days = 0;
  for (let i = series.length - 1; i >= 0 && Math.sign(series[i][field]) === sign; i--) days++;
  return { days, direction: sign > 0 ? 'buy' : 'sell' };
}

// 三大法人每日買賣超（張），口徑與清單的三大法人相同
async function fetchInstitutional(pureId) {
  const data = await requestDataset('TaiwanStockInstitutionalInvestorsBuySell', pureId, daysAgo(45));
  const byDate = new Map();
  for (const item of data) {
    const day = byDate.get(item.date) ?? { date: item.date, foreign: 0, trust: 0, dealer: 0 };
    const diff = toLots(item.buy - item.sell);
    if (item.name === 'Foreign_Investor') day.foreign = diff;
    if (item.name === 'Investment_Trust') day.trust = diff;
    if (item.name === 'Dealer_self' || item.name === 'Dealer_Hedging') day.dealer += diff;
    byDate.set(item.date, day);
  }
  const series = [...byDate.values()].slice(-TREND_DAYS);
  return { series, foreignStreak: streak(series, 'foreign'), trustStreak: streak(series, 'trust') };
}

const percentChange = (from, to) => (from > 0 ? round1(((to - from) / from) * 100) : null);

// 融資、融券餘額（張）
async function fetchMargin(pureId) {
  const data = await requestDataset('TaiwanStockMarginPurchaseShortSale', pureId, daysAgo(45));
  const series = data.slice(-TREND_DAYS).map((d) => ({
    date: d.date,
    margin: d.MarginPurchaseTodayBalance,
    short: d.ShortSaleTodayBalance,
  }));
  const first = series[0];
  const latest = series[series.length - 1];
  if (!latest) return null;
  return {
    series,
    marginChange: percentChange(first.margin, latest.margin), // 近 20 日融資增減 %
    shortMarginRatio: latest.margin > 0 ? round1((latest.short / latest.margin) * 100) : null, // 券資比 %
  };
}

// 外資持股比率（%）
async function fetchForeignHolding(pureId) {
  const data = await requestDataset('TaiwanStockShareholding', pureId, daysAgo(45));
  const series = data.slice(-TREND_DAYS).map((d) => ({ date: d.date, ratio: d.ForeignInvestmentSharesRatio }));
  if (series.length === 0) return null;
  return { series, change: round1(series[series.length - 1].ratio - series[0].ratio) }; // 近 20 日增減（百分點）
}

// 借券賣出餘額。這個 dataset 的單位是「股」，換算成張
async function fetchSbl(pureId) {
  const data = await requestDataset('TaiwanDailyShortSaleBalances', pureId, daysAgo(45));
  const series = data.slice(-TREND_DAYS).map((d) => ({ date: d.date, balance: toLots(d.SBLShortSalesCurrentDayBalance) }));
  if (series.length === 0) return null;
  return { series, change: percentChange(series[0].balance, series[series.length - 1].balance) };
}

// 當沖比率 = 當沖量 ÷ 成交量（兩者單位都是股）。
// 盤中還沒有資料時，FinMind 會先給一筆當沖量為 0 的當日資料，對不到成交量的日期一律排除。
async function fetchDayTrading(pureId) {
  const [trades, prices] = await Promise.all([
    requestDataset('TaiwanStockDayTrading', pureId, daysAgo(45)),
    requestDataset('TaiwanStockPrice', pureId, daysAgo(45)),
  ]);
  const volumeByDate = new Map(prices.map((p) => [p.date, p.Trading_Volume]));
  const series = trades
    .filter((t) => t.Volume > 0 && volumeByDate.get(t.date) > 0)
    .map((t) => ({ date: t.date, ratio: round1((t.Volume / volumeByDate.get(t.date)) * 100) }))
    .slice(-TREND_DAYS);
  if (series.length === 0) return null;
  const avg = series.reduce((sum, d) => sum + d.ratio, 0) / series.length;
  return { series, latest: series[series.length - 1].ratio, average: round1(avg) };
}

// ---------- 基本面 ----------

const periodOf = (d) => `${d.revenue_year}/${String(d.revenue_month).padStart(2, '0')}`;

// 近 12 個月營收（億）與各月 YoY；最新一個月的 MoM。要算每個月的 YoY，需抓約 25 個月。
async function fetchRevenueTrend(pureId) {
  const data = await requestDataset('TaiwanStockMonthRevenue', pureId, daysAgo(800));
  if (data.length === 0) return null;
  const find = (year, month) => data.find((d) => d.revenue_year === year && d.revenue_month === month);
  const months = data.slice(-12).map((d) => {
    const lastYear = find(d.revenue_year - 1, d.revenue_month);
    return {
      period: periodOf(d),
      revenue: toYi(d.revenue),
      yoy: lastYear?.revenue > 0 ? round1((d.revenue / lastYear.revenue - 1) * 100) : null,
    };
  });
  const latest = data[data.length - 1];
  const prevMonth = latest.revenue_month === 1 ? find(latest.revenue_year - 1, 12) : find(latest.revenue_year, latest.revenue_month - 1);
  return {
    months,
    latest: {
      period: periodOf(latest),
      yoy: months[months.length - 1].yoy,
      mom: prevMonth?.revenue > 0 ? round1((latest.revenue / prevMonth.revenue - 1) * 100) : null,
    },
  };
}

const margin = (numerator, revenue) => (numerator != null && revenue > 0 ? round1((numerator / revenue) * 100) : null);

// 近 8 季毛利率、營益率、淨利率（%）與 EPS。損益表是單季值。
// 金融業沒有「毛利」「營業利益」科目，這兩項為 null；稅後淨利科目名稱也不同（IncomeAfterTax）。
async function fetchProfitability(pureId) {
  const data = await requestDataset('TaiwanStockFinancialStatements', pureId, daysAgo(900));
  const byDate = new Map();
  for (const d of data) {
    const q = byDate.get(d.date) ?? {};
    q[d.type] = d.value;
    byDate.set(d.date, q);
  }
  const quarters = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8).map(([date, q]) => ({
    period: toQuarter(date).label,
    eps: q.EPS ?? null,
    grossMargin: margin(q.GrossProfit, q.Revenue),
    operatingMargin: margin(q.OperatingIncome, q.Revenue),
    netMargin: margin(q.IncomeAfterTaxes ?? q.IncomeAfterTax, q.Revenue),
  }));
  return quarters.length > 0 ? { quarters } : null;
}

// 近 4 季自由現金流（億）= 營業現金流 − 資本支出（取得不動產、廠房及設備，原始值為負數）。
// 現金流量表是「年初至今累計」，要減去同年前一季才是單季值；缺前一季時該季無法計算。
// 金融業沒有資本支出科目，營業現金流又包含放款、存款等資金往來，自由現金流沒有意義，標記為不適用。
async function fetchCashflow(pureId) {
  const data = await requestDataset('TaiwanStockCashFlowsStatement', pureId, daysAgo(800));
  if (data.length === 0) return null;
  if (!data.some((d) => d.type === 'PropertyAndPlantAndEquipment')) {
    return { notApplicable: true, quarters: [], fcfTTM: null };
  }
  const cumulative = new Map(); // date → { ocf, capex }
  for (const d of data) {
    const row = cumulative.get(d.date) ?? { ocf: null, capex: 0 };
    if (d.type === 'CashFlowsFromOperatingActivities') row.ocf = d.value;
    if (d.type === 'PropertyAndPlantAndEquipment') row.capex = d.value;
    cumulative.set(d.date, row);
  }
  const dates = [...cumulative.keys()].sort();
  const quarters = [];
  for (const date of dates) {
    const { index, label } = toQuarter(date);
    const current = cumulative.get(date);
    if (current.ocf == null) continue;
    const isQ1 = index % 4 === 1;
    const prevDate = dates.find((d) => toQuarter(d).index === index - 1);
    const prev = isQ1 ? { ocf: 0, capex: 0 } : prevDate && cumulative.get(prevDate);
    if (!prev || prev.ocf == null) continue;
    const ocf = current.ocf - prev.ocf;
    const capex = current.capex - prev.capex;
    quarters.push({ index, period: label, ocf: toYi(ocf), capex: toYi(capex), fcf: toYi(ocf + capex) });
  }
  const last4 = quarters.slice(-4);
  if (last4.length === 0) return null;
  const isConsecutive = last4.length === 4 && last4.every((q, i) => i === 0 || q.index === last4[i - 1].index + 1);
  return {
    quarters: last4.map(({ index, ...q }) => q),
    fcfTTM: isConsecutive ? round1(last4.reduce((sum, q) => sum + q.fcf, 0)) : null,
  };
}

// ---------- 股利 ----------

// 配息紀錄與填息分析。填息 = 除息日（含）之後，收盤價回到除息前一日股價（before_price）的第幾個交易日。
async function fetchDividends(pureId) {
  const [policies, results, prices] = await Promise.all([
    requestDataset('TaiwanStockDividend', pureId, daysAgo(2200)),
    requestDataset('TaiwanStockDividendResult', pureId, daysAgo(2200)),
    requestDataset('TaiwanStockPrice', pureId, daysAgo(2000)),
  ]);
  const today = todayInTaipei();
  const beforePriceByDate = new Map(results.map((r) => [r.date, r.before_price]));

  // 同一個除息日只算一次（FinMind 偶爾會有重複的公告）
  const events = new Map();
  for (const p of policies) {
    const cash = round2((p.CashEarningsDistribution ?? 0) + (p.CashStatutorySurplus ?? 0));
    const stock = round2((p.StockEarningsDistribution ?? 0) + (p.StockStatutorySurplus ?? 0));
    const exDate = p.CashExDividendTradingDate || p.StockExDividendTradingDate;
    if (!exDate || (cash === 0 && stock === 0)) continue;
    events.set(exDate, { exDate, cash, stock, payDate: p.CashDividendPaymentDate || null });
  }
  const sorted = [...events.values()].sort((a, b) => a.exDate.localeCompare(b.exDate));
  const past = sorted.filter((e) => e.exDate <= today);
  const upcoming = sorted.find((e) => e.exDate > today) ?? null;

  const withFill = past.slice(-8).reverse().map((e) => {
    const beforePrice = beforePriceByDate.get(e.exDate) ?? null;
    let fillDays = null;
    if (beforePrice != null) {
      const after = prices.filter((p) => p.date >= e.exDate);
      const index = after.findIndex((p) => p.close >= beforePrice);
      if (index >= 0) fillDays = index + 1;
    }
    return { ...e, beforePrice, filled: fillDays != null, fillDays };
  });

  const oneYearAgo = daysAgo(365);
  const lastYearCash = round2(past.filter((e) => e.exDate > oneYearAgo).reduce((sum, e) => sum + e.cash, 0));
  return {
    upcoming,
    lastYearCash,
    events: withFill,
    latestClose: prices[prices.length - 1]?.close ?? null,
  };
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

// ---------- 組合 ----------

const DETAIL_DATASETS = {
  valuation: { ttl: HOUR, fetch: fetchValuation },
  institutional: { ttl: HOUR, fetch: fetchInstitutional },
  margin: { ttl: HOUR, fetch: fetchMargin },
  foreignHolding: { ttl: HOUR, fetch: fetchForeignHolding },
  sbl: { ttl: HOUR, fetch: fetchSbl },
  dayTrading: { ttl: HOUR, fetch: fetchDayTrading },
  revenueTrend: { ttl: 24 * HOUR, fetch: fetchRevenueTrend },
  profitability: { ttl: 24 * HOUR, fetch: fetchProfitability },
  cashflow: { ttl: 24 * HOUR, fetch: fetchCashflow },
  dividends: { ttl: 24 * HOUR, fetch: fetchDividends },
};

/**
 * 取得單一股票的深入資料：{ id, valuation, institutional, margin, ..., dividends }，
 * 抓不到的區塊為 null。只有讀取快取表失敗（資料庫無法連線）時才會丟出錯誤。
 */
export async function getStockDetails(stockId) {
  const kinds = Object.keys(DETAIL_DATASETS);
  const cache = await readFinMindCache(kinds.map((kind) => `${kind}:${toPureId(stockId)}`));
  // 每一類只有一檔股票，各類之間並行（共 13 個 FinMind 請求，冷啟動約 1–2 秒）
  const loaded = await Promise.all(kinds.map((kind) => loadDataset(kind, [stockId], cache, DETAIL_DATASETS)));

  const details = { id: stockId };
  kinds.forEach((kind, i) => {
    const [result] = loaded[i];
    if (!result.ok) console.error(`[finmind] ${stockId} ${kind} 取得失敗：${result.error.message}`);
    details[kind] = result.ok ? result.value : null;
  });

  // ETF 在本益比 dataset 沒有資料：殖利率改以「近一年現金股利 ÷ 最新收盤價」估算，沒有歷史區間
  const { valuation, dividends } = details;
  if (valuation && !valuation.dividendYield && dividends?.lastYearCash > 0 && dividends.latestClose > 0) {
    valuation.dividendYield = {
      current: round2((dividends.lastYearCash / dividends.latestClose) * 100),
      min: null, median: null, max: null, percentile: null,
      estimated: true,
    };
  }
  return details;
}
