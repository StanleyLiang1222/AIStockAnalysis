// 技術面指標：由一年日 K（lib/finmind.js 的 candles，成交量單位為張）算出，給 AI 健檢使用。
// 先在伺服器算好數字再交給 AI 解讀，避免 AI 自己從 K 棒推算而出錯。資料長度不足的指標為 null。
const round1 = (v) => Math.round(v * 10) / 10;
const average = (values) => values.reduce((sum, v) => sum + v, 0) / values.length;
const percentDiff = (value, base) => (base > 0 ? round1((value / base - 1) * 100) : null);

export function computeTechnicals(candles) {
  const closes = candles.map((c) => c.close);
  const last = closes[closes.length - 1];
  const returnOver = (days) => (closes.length > days ? percentDiff(last, closes[closes.length - 1 - days]) : null);
  const vsMovingAverage = (days) => (closes.length >= days ? percentDiff(last, average(closes.slice(-days))) : null);

  const volumes = candles.map((c) => c.volume);
  const volumeRatio = volumes.length >= 60
    ? Math.round((average(volumes.slice(-20)) / average(volumes.slice(-60))) * 100) / 100
    : null;

  // 52 週約 250 個交易日；資料不足一年時以現有資料計算
  const yearCandles = candles.slice(-250);
  const high = Math.max(...yearCandles.map((c) => c.high));
  const low = Math.min(...yearCandles.map((c) => c.low));

  return {
    close: last,
    returnPercent: { d5: returnOver(5), d20: returnOver(20), d60: returnOver(60) },
    vsMovingAveragePercent: { ma20: vsMovingAverage(20), ma60: vsMovingAverage(60) },
    volume20to60Ratio: volumeRatio,
    week52: {
      high,
      low,
      fromHighPercent: percentDiff(last, high),
      fromLowPercent: percentDiff(last, low),
      tradingDays: yearCandles.length,
    },
  };
}
