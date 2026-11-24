import { colors } from '@/lib/theme';

// 價格最多顯示到小數 2 位：ETF 與低價股的跳動單位是 0.01，只顯示 1 位會失真
export const formatPrice = (value) => value.toLocaleString('en-US', { maximumFractionDigits: 2 });

// 依漲跌回傳台股配色（漲紅跌綠）的 class 與色碼
export const getTrendColors = (value) => {
  const isPositive = value >= 0;
  return {
    text: isPositive ? 'text-up font-black' : 'text-down font-black',
    bg: isPositive ? 'bg-up/20' : 'bg-down/20',
    solidBg: isPositive ? 'bg-up' : 'bg-down',
    border: isPositive ? 'border-up/50' : 'border-down/50',
    iconColor: isPositive ? colors.up : colors.down,
  };
};

// 台股升降單位（跳動單位）：股票依價位分六級；ETF 未滿 50 元 0.01、50 元以上 0.05
const tickOf = (price, isEtf) => {
  if (isEtf) return price < 50 ? 0.01 : 0.05;
  if (price < 10) return 0.01;
  if (price < 50) return 0.05;
  if (price < 100) return 0.1;
  if (price < 500) return 0.5;
  if (price < 1000) return 1;
  return 5;
};

// 前一日收盤 ±10% 對齊到該價位的升降單位：漲停無條件捨去、跌停無條件進位。
// 用整數「分」運算避免浮點誤差；對齊後跨到另一個價位級距時，以新級距再對齊一次
const alignLimit = (raw, isEtf, round) => {
  const rawCents = Math.round(raw * 1e4) / 100; // 單位：分，保留兩位小數
  const align = (tick) => {
    const tickCents = Math.round(tick * 100);
    return round(Math.round((rawCents / tickCents) * 1e6) / 1e6) * tickCents;
  };
  const cents = align(tickOf(raw, isEtf));
  const nextTick = tickOf(cents / 100, isEtf);
  return nextTick === tickOf(raw, isEtf) ? cents : align(nextTick);
};

/**
 * 判斷是否漲停／跌停，回傳 'up' | 'down' | null。漲跌停價由前一日收盤（股價 − 漲跌）推算，
 * 盤中即時行情與盤後資料都適用。新上市前五日、興櫃等無漲跌幅限制的標的可能誤判，影響僅限底色。
 */
export const getPriceLimit = (stock) => {
  const { price, change } = stock;
  if (!(price > 0) || change == null || change === 0) return null;
  const prevClose = Math.round((price - change) * 100) / 100;
  if (!(prevClose > 0)) return null;
  const isEtf = stock.id?.startsWith('00') || /ETF/i.test(stock.category ?? '');
  const priceCents = Math.round(price * 100);
  if (change > 0 && priceCents >= alignLimit(prevClose * 1.1, isEtf, Math.floor)) return 'up';
  if (change < 0 && priceCents <= alignLimit(prevClose * 0.9, isEtf, Math.ceil)) return 'down';
  return null;
};

// 漲跌點數（漲跌幅），例如 -20 (-1.50%)、+3.5 (+1.20%)；漲跌幅固定顯示 2 位小數
export const formatChange = (change, changePercent) => {
  const sign = change > 0 ? '+' : '';
  return `${sign}${formatPrice(change)} (${sign}${Number(changePercent).toFixed(2)}%)`;
};
