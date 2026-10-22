// 把今天盤中的即時行情套到 FinMind 的盤後資料上。只有即時行情的日期比盤後資料新才套用；
// 收盤後 FinMind 補上今天的資料（日期相同）就改回 FinMind。

const round2 = (v) => Math.round(v * 100) / 100;

// 清單項目：股價、漲跌、成交量改用即時行情，並標記即時時間 liveTime
export function applyQuote(stock, quote) {
  if (!quote || stock.unavailable || quote.date <= stock.dataDate) return stock;
  const change = quote.price - quote.prevClose;
  return {
    ...stock,
    price: quote.price,
    change: round2(change),
    changePercent: round2((change / quote.prevClose) * 100),
    volume: quote.volume != null ? quote.volume.toLocaleString('en-US') : stock.volume,
    dataDate: quote.date,
    liveTime: quote.time,
  };
}

// 日 K：在最後面接上今天盤中這一根（開盤前開高低還沒有值時不接）
export function appendLiveCandle(candles, quote) {
  const last = candles[candles.length - 1];
  if (!quote || !last || quote.date <= last.time || quote.open == null) return candles;
  return [...candles, {
    time: quote.date,
    open: quote.open,
    high: Math.max(quote.high ?? quote.price, quote.price),
    low: Math.min(quote.low ?? quote.price, quote.price),
    close: quote.price,
    volume: quote.volume ?? 0,
  }];
}

// 大盤資訊列的加權指數
export function applyIndex(market, index) {
  if (!market || !index || (market.taiex && index.date <= market.taiex.date)) return market;
  const change = index.price - index.prevClose;
  return {
    ...market,
    taiex: {
      date: index.date,
      close: index.price,
      change: Math.round(change * 10) / 10,
      changePercent: round2((change / index.prevClose) * 100),
      liveTime: index.time,
    },
  };
}
