// 大盤資訊：加權指數、大盤三大法人買賣超、融資餘額增減。三項各自快取 1 小時、各自失敗。
import { HOUR, daysAgo, getCachedValue, requestDataset } from '@/lib/finmind';

const round1 = (v) => Math.round(v * 10) / 10;
const toYi = (v) => round1(v / 1e8); // 元 → 億

async function fetchTaiex() {
  const data = await requestDataset('TaiwanStockPrice', 'TAIEX', daysAgo(14));
  const latest = data[data.length - 1];
  if (!latest) throw new Error('查無加權指數資料');
  const prevClose = latest.close - latest.spread;
  return {
    date: latest.date,
    close: latest.close,
    change: round1(latest.spread),
    changePercent: prevClose > 0 ? Math.round((latest.spread / prevClose) * 10000) / 100 : null,
  };
}

// 金額單位為元，換算成億。外資含外資自營商；自營商含自行買賣與避險。
async function fetchMarketInstitutional() {
  const data = await requestDataset('TaiwanStockTotalInstitutionalInvestors', null, daysAgo(14));
  const latestDate = data[data.length - 1]?.date;
  if (!latestDate) throw new Error('查無大盤法人資料');
  const net = { foreign: 0, trust: 0, dealer: 0 };
  for (const d of data) {
    if (d.date !== latestDate) continue;
    const diff = d.buy - d.sell;
    if (d.name === 'Foreign_Investor' || d.name === 'Foreign_Dealer_Self') net.foreign += diff;
    if (d.name === 'Investment_Trust') net.trust += diff;
    if (d.name === 'Dealer_self' || d.name === 'Dealer_Hedging') net.dealer += diff;
  }
  return { date: latestDate, foreign: toYi(net.foreign), trust: toYi(net.trust), dealer: toYi(net.dealer) };
}

// 融資金額餘額（MarginPurchaseMoney，單位元）與前一日相比的增減
async function fetchMarketMargin() {
  const data = await requestDataset('TaiwanStockTotalMarginPurchaseShortSale', null, daysAgo(14));
  const latest = data.filter((d) => d.name === 'MarginPurchaseMoney').pop();
  if (!latest) throw new Error('查無大盤融資資料');
  return { date: latest.date, balance: toYi(latest.TodayBalance), change: toYi(latest.TodayBalance - latest.YesBalance) };
}

const safely = (promise, label) => promise.catch((err) => {
  console.error(`[finmind] 大盤${label}取得失敗：${err.message}`);
  return null;
});

/**
 * { taiex, institutional, margin }，抓不到的項目為 null。
 */
export async function getMarketSummary() {
  const [taiex, institutional, margin] = await Promise.all([
    safely(getCachedValue('market:taiex', HOUR, fetchTaiex), '加權指數'),
    safely(getCachedValue('market:institutional', HOUR, fetchMarketInstitutional), '法人'),
    safely(getCachedValue('market:margin', HOUR, fetchMarketMargin), '融資'),
  ]);
  return { taiex, institutional, margin };
}
