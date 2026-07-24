'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { signOut } from 'next-auth/react';

/**
 * 預設自選股（新使用者第一次登入時，會拿這份清單種入資料庫）
 * @type {Array<string>}
 */
const DEFAULT_WATCHLIST_IDS = ['2330.TW', '2317.TW', '2454.TW', '2603.TW', '2881.TW'];

/**
 * 將個股 ID (e.g. 2330.TW 或 2330) 轉換為 FinMind 格式 (e.g. 2330)
 */
const formatFinMindId = (id) => {
  return id.replace('.TW', '').trim();
};

/**
 * 從 FinMind API 獲取個股基本資訊 (名稱與產業分類)
 */
const fetchFinMindStockInfo = async (stockId) => {
  const cleanId = formatFinMindId(stockId);
  const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInfo&data_id=${cleanId}`;
  const json = await safeFetchJson(url);
  if (json.msg === 'success' && json.data && json.data.length > 0) {
    return {
      name: json.data[0].stock_name,
      category: json.data[0].industry_category || '台股'
    };
  }
  throw new Error('無法取得股票基本資訊');
};

/**
 * 取得一年前的 ISO 日期格式 (YYYY-MM-DD)
 */
const getOneYearAgoDate = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split('T')[0];
};

/**
 * 取得最近 N 天的 ISO 日期格式 (YYYY-MM-DD)
 */
const getRecentDaysAgoDate = (days = 30) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
};

/**
 * 封裝 Fetch，自動利用 AllOrigins CORS Proxy 以確保跨域取得資料
 */
const safeFetchJson = async (url) => {
  try {
    const res = await fetch(url);
    const json = await res.json();
    return json;
  } catch (err) {
    console.warn("直接 Fetch 發生 CORS 或連線錯誤，嘗試使用 AllOrigins Proxy...", err);
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      const proxyJson = await res.json();
      if (proxyJson && proxyJson.contents) {
        return JSON.parse(proxyJson.contents);
      }
    } catch (err2) {
      console.warn("AllOrigins Proxy 載入失敗，嘗試使用 CorsProxy.io...", err2);
      try {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl);
        const json = await res.json();
        return json;
      } catch (err3) {
        console.error("所有跨域方案皆失敗", err3);
      }
    }
  }
  throw new Error("無法跨域取得數據，請檢查網路連線或稍後再試。");
};

/**
 * 從 FinMind API 獲取個股日 K 線歷史資料
 */
const fetchFinMindDailyPrice = async (stockId) => {
  const cleanId = formatFinMindId(stockId);
  const startDate = getOneYearAgoDate();
  const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id=${cleanId}&start_date=${startDate}`;
  const json = await safeFetchJson(url);
  if (json.msg === 'success' && json.data && json.data.length > 0) {
    return json.data;
  }
  throw new Error('無法取得日K資料');
};

/**
 * 從 FinMind API 獲取個股三大法人買賣超
 */
const fetchFinMindInstitutionalInvestors = async (stockId) => {
  const cleanId = formatFinMindId(stockId);
  const startDate = getRecentDaysAgoDate(15);
  const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInstitutionalInvestorsBuySell&data_id=${cleanId}&start_date=${startDate}`;
  const json = await safeFetchJson(url);
  if (json.msg === 'success' && json.data && json.data.length > 0) {
    return json.data;
  }
  throw new Error('無法取得籌碼資料');
};

/**
 * 從 FinMind API 獲取個股財報 (EPS)
 */
const fetchFinMindFinancialStatements = async (stockId) => {
  const cleanId = formatFinMindId(stockId);
  const startDate = getRecentDaysAgoDate(365);
  const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockFinancialStatements&data_id=${cleanId}&start_date=${startDate}`;
  const json = await safeFetchJson(url);
  if (json.msg === 'success' && json.data && json.data.length > 0) {
    return json.data;
  }
  throw new Error('無法取得財務資料');
};

/**
 * 生成 OHLCV K 線蠟燭棒數據（載入真實資料前的骨架佔位圖）
 */
function generateCandleData(basePrice, count, labels) {
  let price = basePrice;
  return Array.from({ length: count }, (_, i) => {
    const open = parseFloat(price.toFixed(1));
    const change = (Math.random() - 0.47) * price * 0.025;
    const close = parseFloat(Math.max(1, price + change).toFixed(1));
    const high = parseFloat((Math.max(open, close) + Math.random() * price * 0.008).toFixed(1));
    const low = parseFloat((Math.min(open, close) - Math.random() * price * 0.008).toFixed(1));
    const volume = Math.floor(Math.random() * 30000) + 1000;
    price = close;
    return { time: labels[i] || String(i + 1), open, high, low, close, volume };
  });
}

/**
 * 使用真實的開高低收數據，模擬生成今日的 26 筆分時走勢點 (符合起點/終點與高低區間)
 */
function generateFittedIntradayPoints(candle) {
  if (!candle) return [];
  const { open, high, low, close, volume } = candle;
  const count = 26;
  const points = [];

  let currentPrice = open;
  const volPerPoint = Math.floor(volume / count);

  const labels = Array.from({ length: count }, (_, i) => {
    const totalMinutes = 9 * 60 + i * 10;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return h + ':' + (m === 0 ? '00' : String(m));
  });

  for (let i = 0; i < count; i++) {
    if (i === 0) {
      currentPrice = open;
    } else if (i === count - 1) {
      currentPrice = close;
    } else {
      const remainingSteps = count - 1 - i;
      const targetDiff = close - currentPrice;
      const targetStep = targetDiff / (remainingSteps + 1);
      const randomNoise = (Math.random() - 0.5) * (high - low) * 0.15;
      currentPrice = currentPrice + targetStep + randomNoise;
      currentPrice = Math.min(high, Math.max(low, currentPrice));
    }

    points.push({
      time: labels[i],
      open: parseFloat(open.toFixed(1)),
      high: parseFloat(high.toFixed(1)),
      low: parseFloat(low.toFixed(1)),
      close: parseFloat(currentPrice.toFixed(1)),
      volume: Math.floor(volPerPoint * (0.5 + Math.random()))
    });
  }

  return points;
}

/**
 * 骨架佔位 K 線數據（真實資料尚未載入完成前顯示）
 * @type {Object}
 */
const HISTORICAL_SAMPLES = {
  '1D': generateCandleData(900, 26, Array.from({ length: 26 }, (_, i) => {
    const h = 9 + Math.floor(i / 6);
    const m = (i % 6) * 10;
    return h + ':' + (m === 0 ? '00' : String(m));
  })),
  '5D': generateCandleData(880, 25, Array.from({ length: 25 }, (_, i) => 'D' + (Math.floor(i / 5) + 1) + '-' + ((i % 5) + 1))),
  '1M': generateCandleData(860, 22, Array.from({ length: 22 }, (_, i) => (i + 1) + '日')),
  '3M': generateCandleData(820, 30, Array.from({ length: 30 }, (_, i) => 'W' + (i + 1))),
  '1Y': generateCandleData(750, 24, Array.from({ length: 24 }, (_, i) => (i + 1) + '月')),
};

/**
 * SVG 圖示渲染元件
 */
const Icon = ({ name, className = "w-5 h-5", strokeWidth = 2.5 }) => {
  const svgs = {
    trendingUp: <path d="m22 7-8.5 8.5-5-5L2 17M22 7h-6M22 7v6" />,
    trendingDown: <path d="m22 17-8.5-8.5-5 5L2 7M22 17h-6M22 17v-6" />,
    search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
    plus: <path d="M5 12h14M12 5v14" />,
    trash2: <><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></>,
    activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
    barChart2: <><line x1="18" x2="18" y1="20" y2="10" /><line x1="12" x2="12" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="14" /></>,
    pieChart: <><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></>,
    sparkles: <><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z" /></>,
    smartphone: <><rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" /></>,
    monitor: <><rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" /></>,
    refreshCw: <><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M16 3h5v5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 21H3v-5" /></>,
    info: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>,
    bookOpen: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>,
    logOut: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></>,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round"
      strokeLinejoin="round" className={className}>
      {svgs[name] || null}
    </svg>
  );
};

/**
 * 13 種 K 線型態範本資料與特徵描述
 * @type {Array<Object>}
 */
const KLINE_TEMPLATES = [
  {
    id: 1,
    name: "大陽線",
    sub: "無上下影線紅 K",
    desc: "開盤價即為最低價，隨後股價一路上攻，最後收在股價最高點，代表買盤力道強勁，而實體紅 K 越長代表漲勢越強、上漲幅度越大。",
    tag: "多頭極強",
    tagColor: "bg-[#ff453a]/10 text-[#ff453a] border-[#ff453a]/30",
    type: "up",
    high: 25,
    close: 25,
    open: 125,
    low: 125
  },
  {
    id: 2,
    name: "小陽線",
    sub: "有上下影線紅 K",
    desc: "股價跌到低點時有買盤支撐，但漲到高點又遇到賣壓，經過多空雙方交戰之後，最終由多方略勝一籌，推升股價呈現上漲狀態，當中間實線長度越短，代表雙方勢均力敵的程度越高。K 線出現這樣的型態，通常是一種反轉訊號，如果在大漲後出現，表示高檔震盪﹔反之，如果在大跌後出現，可能表示股價已觸底，未來股價有望反彈。",
    tag: "多方略勝 / 反轉訊號",
    tagColor: "bg-[#ffb224]/10 text-[#ffb224] border-[#ffb224]/30",
    type: "up",
    high: 15,
    close: 55,
    open: 95,
    low: 135
  },
  {
    id: 3,
    name: "光頭陽線",
    sub: "僅有下影線紅 K",
    desc: "開盤後股價一度下跌，但因有買盤支撐，推升股價一路走升，最終收在最高價位，當下影線越長，代表反彈的力道越大，屬於多頭上漲的訊號。",
    tag: "多頭上漲",
    tagColor: "bg-[#ff453a]/10 text-[#ff453a] border-[#ff453a]/30",
    type: "up",
    high: 25,
    close: 25,
    open: 95,
    low: 135
  },
  {
    id: 4,
    name: "光腳陽線",
    sub: "僅有上影線紅 K",
    desc: "開盤後股價一度衝至最高點，但在高檔區遭遇賣壓，經過多空雙方交戰之後，最終由多方略勝一籌，收盤價仍高於開盤價，當上影線越長，代表賣盤力道較強、拉回程度越大。",
    tag: "上檔遭遇賣壓",
    tagColor: "bg-[#ffb224]/10 text-[#ffb224] border-[#ffb224]/30",
    type: "up",
    high: 15,
    close: 55,
    open: 125,
    low: 125
  },
  {
    id: 5,
    name: "陽線錘子",
    sub: "長下影線紅 K",
    desc: "股價大跌之後，空方力道減弱、多頭力量慢慢凝聚，隨後買盤一路買到最高價作收，如果在長期下跌的情況下，看到 K 線出現這樣的型態，代表買盤已積累一段時間後開始釋放，可以視為股價底部支撐的訊號。",
    tag: "底部支撐強烈",
    tagColor: "bg-[#ff453a]/10 text-[#ff453a] border-[#ff453a]/30",
    type: "up",
    high: 25,
    close: 25,
    open: 55,
    low: 135
  },
  {
    id: 6,
    name: "倒錘陽線",
    sub: "長上影線紅 K",
    desc: "股價大漲之後，多方力道減弱、空方力量慢慢凝聚，隨後股價被賣盤拉回，但最終由多方略勝一籌，收盤價仍高於開盤價，上影線的長度表示拉回的程度，上影線越長，代表賣壓越大。",
    tag: "高檔賣壓湧現",
    tagColor: "bg-[#30d158]/10 text-[#30d158] border-[#30d158]/30",
    type: "up",
    high: 15,
    close: 95,
    open: 125,
    low: 125
  },
  {
    id: 7,
    name: "大陰線",
    sub: "無上下影線黑 K",
    desc: "開盤價即是最高價，隨後股價一路下滑，最後收在股價最低點，代表賣方力道強勁，而實體綠 K 越長代表跌勢越慘、下跌幅度越大，如果在長期下跌的情況下，又看到 K 線出現這樣的型態，股價可能會加速暴跌。",
    tag: "空頭極強",
    tagColor: "bg-[#30d158]/10 text-[#30d158] border-[#30d158]/30",
    type: "down",
    high: 25,
    open: 25,
    close: 125,
    low: 125
  },
  {
    id: 8,
    name: "小陰線",
    sub: "有上下影線黑 K",
    desc: "股價跌到低點時有買盤支撐，但漲到高點又遇到賣壓，經過多空雙方交戰之後，最終由空方略勝一籌，使得股價呈現下跌狀態，當中間實線長度越短，代表雙方勢均力敵的程度越高。K 線出現這樣的型態，通常代表市場進入弱勢盤整。",
    tag: "空方略勝 / 弱勢盤整",
    tagColor: "bg-[#ffb224]/10 text-[#ffb224] border-[#ffb224]/30",
    type: "down",
    high: 15,
    open: 55,
    close: 95,
    low: 135
  },
  {
    id: 9,
    name: "光頭陰線",
    sub: "僅有下影線黑 K",
    desc: "開盤後股價一度下跌，但有買盤支撐，推升股價回升，最終收盤價仍低於開盤價，如果在長期下跌的情況下，K 線出現這樣的型態，可能為股價觸底的訊號，而下影線越長、反彈力道越強。",
    tag: "觸底反彈訊號",
    tagColor: "bg-[#ffb224]/10 text-[#ffb224] border-[#ffb224]/30",
    type: "down",
    high: 25,
    open: 25,
    close: 95,
    low: 135
  },
  {
    id: 10,
    name: "光腳陰線",
    sub: "僅有上影線黑 K",
    desc: "開盤後股價一度衝至最高點，但因上檔賣壓沉重，最終由空方略勝一籌，拉回至最低價收盤，當上影線越長，代表賣盤力道較強、拉回的程度越大。如果是在上漲末升段，K 線出現這樣的型態，通常被視為反轉下跌的訊號，多頭可能會陷入被套牢的窘境。",
    tag: "反轉下跌訊號",
    tagColor: "bg-[#30d158]/10 text-[#30d158] border-[#30d158]/30",
    type: "down",
    high: 15,
    open: 55,
    close: 125,
    low: 125
  },
  {
    id: 11,
    name: "陰線錘子",
    sub: "長下影線黑 K",
    desc: "股價大跌之後，空方力道減弱、多頭力量慢慢凝聚，隨後買盤一路推升股價走升，最終仍由空方略勝一籌，如果在持續走空後的低檔區，看到 K 線出現這樣的型態，通常視為空頭轉向多頭的訊號﹔反之，出現在高檔區則可能由多轉空。",
    tag: "轉折關鍵 / 空轉多",
    tagColor: "bg-[#ffb224]/10 text-[#ffb224] border-[#ffb224]/30",
    type: "down",
    high: 25,
    open: 25,
    close: 55,
    low: 135
  },
  {
    id: 12,
    name: "倒錘陰線",
    sub: "長上影線黑 K",
    desc: "股價大漲之後，多方力道減弱、空方力量慢慢凝聚，隨後賣盤一路賣到最低價作收，上影線的長度表示拉回的程度，上影線越長，代表賣壓越大。",
    tag: "高檔轉折 / 空方聚",
    tagColor: "bg-[#30d158]/10 text-[#30d158] border-[#30d158]/30",
    type: "down",
    high: 15,
    open: 95,
    close: 125,
    low: 125
  },
  {
    id: 13,
    name: "十字線",
    sub: "開盤價=收盤價",
    desc: "十字線代表多空雙方勢均力敵，開盤價與收盤價一致，當十字線出現在近期波段的高點，則表示多方力量減弱，股價可能會下跌﹔反之，十字線出現在近期波段的低點，則表示空方力量轉弱，股價則有上漲的可能。",
    tag: "多空均勢 / 轉折關鍵",
    tagColor: "bg-[#6e8eff]/10 text-[#6e8eff] border-[#6e8eff]/30",
    type: "cross",
    high: 15,
    open: 75,
    close: 75,
    low: 135
  }
];

/**
 * 精美標記影線/實體的 SVG K 線圖示元件
 */
function KlineDetailIcon({ type, high, open, close, low }) {
  const upColor = '#ff453a';
  const downColor = '#30d158';
  const crossColor = '#a0a5ad';

  const cx = 100;
  const entityW = 22;

  let color = crossColor;
  if (type === 'up') color = upColor;
  if (type === 'down') color = downColor;

  let leftTopText = '';
  let leftTopY = 0;
  let leftBottomText = '';
  let leftBottomY = 0;

  let rightTopText = '';
  let rightTopY = 0;
  let rightBottomText = '';
  let rightBottomY = 0;

  if (type === 'up') {
    const hasUpperShadow = high < close;
    const hasLowerShadow = low > open;

    leftTopText = hasUpperShadow ? '收盤價' : '收盤/最高';
    leftTopY = close;

    leftBottomText = hasLowerShadow ? '開盤價' : '開盤/最低';
    leftBottomY = open;

    if (hasUpperShadow) {
      rightTopText = '最高價';
      rightTopY = high;
    }
    if (hasLowerShadow) {
      rightBottomText = '最低價';
      rightBottomY = low;
    }
  } else if (type === 'down') {
    const hasUpperShadow = high < open;
    const hasLowerShadow = low > close;

    leftTopText = hasUpperShadow ? '開盤價' : '開盤/最高';
    leftTopY = open;

    leftBottomText = hasLowerShadow ? '收盤價' : '收盤/最低';
    leftBottomY = close;

    if (hasUpperShadow) {
      rightTopText = '最高價';
      rightTopY = high;
    }
    if (hasLowerShadow) {
      rightBottomText = '最低價';
      rightBottomY = low;
    }
  } else {
    leftTopText = '開盤 = 收盤';
    leftTopY = open;

    rightTopText = '最高價';
    rightTopY = high;

    rightBottomText = '最低價';
    rightBottomY = low;
  }

  return (
    <svg width="200" height="150" viewBox="0 0 200 150" className="mx-auto overflow-visible select-none">
      <line x1={cx} y1={high} x2={cx} y2={low} stroke={color} strokeWidth="2.5" strokeLinecap="round" />

      {type === 'up' && (
        <rect x={cx - entityW / 2} y={close} width={entityW} height={Math.max(2, open - close)} fill={color} stroke={color} strokeWidth="1" rx="1.5" />
      )}
      {type === 'down' && (
        <rect x={cx - entityW / 2} y={open} width={entityW} height={Math.max(2, close - open)} fill={color} stroke={color} strokeWidth="1" rx="1.5" />
      )}
      {type === 'cross' && (
        <line x1={cx - 18} y1={open} x2={cx + 18} y2={open} stroke={color} strokeWidth="4" strokeLinecap="round" />
      )}

      {leftTopText && (
        <g className="transition-all duration-300">
          <line x1={cx - 14} y1={leftTopY} x2={64} y2={leftTopY} stroke="#323842" strokeWidth="1" strokeDasharray="2,3" />
          <text x={58} y={leftTopY + 3.5} textAnchor="end" fill="#8e96a3" fontSize="9.5" className="svg-indicator-text">{leftTopText}</text>
        </g>
      )}
      {leftBottomText && (
        <g className="transition-all duration-300">
          <line x1={cx - 14} y1={leftBottomY} x2={64} y2={leftBottomY} stroke="#323842" strokeWidth="1" strokeDasharray="2,3" />
          <text x={58} y={leftBottomY + 3.5} textAnchor="end" fill="#8e96a3" fontSize="9.5" className="svg-indicator-text">{leftBottomText}</text>
        </g>
      )}

      {rightTopText && (
        <g className="transition-all duration-300">
          <line x1={cx} y1={rightTopY} x2={136} y2={rightTopY} stroke="#323842" strokeWidth="1" strokeDasharray="2,3" />
          <text x={142} y={rightTopY + 3.5} textAnchor="start" fill="#8e96a3" fontSize="9.5" className="svg-indicator-text">{rightTopText}</text>
        </g>
      )}
      {rightBottomText && (
        <g className="transition-all duration-300">
          <line x1={cx} y1={rightBottomY} x2={136} y2={rightBottomY} stroke="#323842" strokeWidth="1" strokeDasharray="2,3" />
          <text x={142} y={rightBottomY + 3.5} textAnchor="start" fill="#8e96a3" fontSize="9.5" className="svg-indicator-text">{rightBottomText}</text>
        </g>
      )}
    </svg>
  );
}

/**
 * K 線型態圖典主面板元件
 */
function KlineGuide() {
  const [filter, setFilter] = useState('all'); // 'all' | 'up' | 'down' | 'cross'

  const filteredTemplates = useMemo(() => {
    if (filter === 'all') return KLINE_TEMPLATES;
    return KLINE_TEMPLATES.filter(t => t.type === filter);
  }, [filter]);

  return (
    <div className="w-full space-y-5 fade-in-up">
      <div className="bg-[#111315] border-2 border-[#22252a] rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3e63dd] inline-block"></span>
            K 線經典型態圖典
          </h2>
          <p className="text-xs text-[#9ba1a6] font-bold mt-1">
            收錄 13 種技術分析必學 K 線型態。圖示中的導引點線即時呈現「開、高、低、收」的對應邏輯。
          </p>
        </div>
        <div className="flex bg-[#0d0f12] p-1 rounded-lg border-2 border-[#22252a] text-xs font-black self-stretch md:self-auto justify-between md:justify-start gap-1">
          <button onClick={() => setFilter('all')} className={'px-3.5 py-1.5 rounded-md transition-all ' + (filter === 'all' ? 'bg-[#22252a] text-white border border-[#2d3137] shadow' : 'text-[#888d92] hover:text-white')}>全部 ({KLINE_TEMPLATES.length})</button>
          <button onClick={() => setFilter('up')} className={'px-3.5 py-1.5 rounded-md transition-all ' + (filter === 'up' ? 'bg-[#22252a] text-[#ff453a] border border-[#ff453a]/20 shadow' : 'text-[#888d92] hover:text-white')}>陽線 ({KLINE_TEMPLATES.filter(t => t.type === 'up').length})</button>
          <button onClick={() => setFilter('down')} className={'px-3.5 py-1.5 rounded-md transition-all ' + (filter === 'down' ? 'bg-[#22252a] text-[#30d158] border border-[#30d158]/20 shadow' : 'text-[#888d92] hover:text-white')}>陰線 ({KLINE_TEMPLATES.filter(t => t.type === 'down').length})</button>
          <button onClick={() => setFilter('cross')} className={'px-3.5 py-1.5 rounded-md transition-all ' + (filter === 'cross' ? 'bg-[#22252a] text-[#8e96a3] border border-[#8e96a3]/20 shadow' : 'text-[#888d92] hover:text-white')}>十字線 ({KLINE_TEMPLATES.filter(t => t.type === 'cross').length})</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTemplates.map(template => (
          <div key={template.id} className="glass-k-card rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start gap-2 mb-3">
                <div>
                  <span className="text-[10px] font-mono text-[#6e8eff] font-black uppercase">型態 #{template.id}</span>
                  <h3 className="text-sm font-black text-white mt-0.5 flex items-center gap-1.5">
                    {template.name}
                    <span className="text-xs text-[#a0a5ad] font-bold">({template.sub})</span>
                  </h3>
                </div>
                <span className={'px-2.5 py-0.5 rounded text-[10px] font-black border tracking-wider ' + template.tagColor}>
                  {template.tag}
                </span>
              </div>

              <div className="bg-[#090a0c] border-2 border-[#1f2227] rounded-xl py-4 flex items-center justify-center relative overflow-hidden">
                <div className="absolute top-1 right-2 text-[9px] text-[#3e4550] font-mono select-none">SVG Vector Map</div>
                <KlineDetailIcon
                  type={template.type}
                  high={template.high}
                  open={template.open}
                  close={template.close}
                  low={template.low}
                />
              </div>
            </div>

            <p className="text-xs text-slate-300 font-bold leading-relaxed pt-3.5 border-t border-[#1f2125]/80 mt-4">
              {template.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =====================================================
   主應用程式
   ===================================================== */
export default function StockApp({ user }) {
  const [deviceMode, setDeviceMode] = useState('phone');
  const [activeTab, setActiveTab] = useState('watchlist');
  const [stocks, setStocks] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [timeRange, setTimeRange] = useState('1D');
  const [chartType, setChartType] = useState('line'); // 'line' | 'candle'
  const [aiAnalysis, setAiAnalysis] = useState({});
  const [aiLoading, setAiLoading] = useState(false);
  const [widescreenTab, setWidescreenTab] = useState('dashboard'); // 'dashboard' | 'guide'

  const [realDataLoading, setRealDataLoading] = useState(false);
  const [realHistoricalCandles, setRealHistoricalCandles] = useState({}); // { [stockId]: [candles] }

  /**
   * 依代碼向 FinMind 抓取完整個股資料（報價、籌碼、財報、名稱）與歷史 K 線
   */
  const fetchFullStockData = useCallback(async (rawId) => {
    const cleanId = rawId.includes('.TW') ? rawId : rawId + '.TW';
    const pureId = formatFinMindId(cleanId);

    const data = await fetchFinMindDailyPrice(pureId);
    if (!data || data.length === 0) {
      throw new Error('查無此台股代碼');
    }

    const latest = data[data.length - 1];
    const prev = data.length > 1 ? data[data.length - 2] : latest;
    const closePrice = latest.close;
    const changeAmount = parseFloat((closePrice - prev.close).toFixed(1));
    const changePercent = prev.close > 0 ? parseFloat(((changeAmount / prev.close) * 100).toFixed(2)) : 0;
    const volumeK = Math.round(latest.Trading_Volume / 1000).toLocaleString();

    let chips = { foreign: 0, trust: 0, dealer: 0 };
    try {
      const chipsData = await fetchFinMindInstitutionalInvestors(pureId);
      if (chipsData && chipsData.length > 0) {
        const latestDate = chipsData[chipsData.length - 1].date;
        const latestChips = chipsData.filter(c => c.date === latestDate);
        let foreign = 0; let trust = 0; let dealer = 0;
        latestChips.forEach(item => {
          const diffZhang = Math.round((item.buy - item.sell) / 1000);
          if (item.name === 'Foreign_Investor') foreign = diffZhang;
          if (item.name === 'Investment_Trust') trust = diffZhang;
          if (item.name === 'Dealer_self' || item.name === 'Dealer_Hedging') dealer += diffZhang;
        });
        chips = { foreign, trust, dealer };
      }
    } catch (err) { console.warn("無法取得籌碼數據", err); }

    let eps = 0;
    try {
      const finData = await fetchFinMindFinancialStatements(pureId);
      if (finData && finData.length > 0) {
        const epsItems = finData.filter(f => f.type === 'EPS');
        if (epsItems.length > 0) eps = epsItems[epsItems.length - 1].value;
      }
    } catch (err) { console.warn("無法取得財報數據", err); }

    let name = '台股 ' + pureId;
    let category = '自選股';
    try {
      const info = await fetchFinMindStockInfo(pureId);
      name = info.name;
      category = info.category;
    } catch (err) {
      console.warn("無法取得基本資訊", err);
    }

    const stock = {
      id: cleanId,
      name,
      price: closePrice,
      change: changeAmount,
      changePercent,
      volume: volumeK,
      category,
      eps,
      yoy: 15.0,
      roe: 12.0,
      chips
    };

    const candles = data.map(item => ({
      time: item.date,
      open: item.open,
      high: item.max,
      low: item.min,
      close: item.close,
      volume: Math.round(item.Trading_Volume / 1000)
    }));

    return { stock, candles };
  }, []);

  // 首次載入：從資料庫讀取使用者的自選股清單，若為新使用者則種入預設清單
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setWatchlistLoading(true);
      try {
        const res = await fetch('/api/watchlist');
        const { watchlist: savedIds } = await res.json();
        let ids = savedIds && savedIds.length > 0 ? savedIds : DEFAULT_WATCHLIST_IDS;

        if (!savedIds || savedIds.length === 0) {
          await Promise.all(ids.map((id) =>
            fetch('/api/watchlist', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ stockId: id }),
            })
          ));
        }

        const results = await Promise.all(ids.map(async (id) => {
          try {
            return await fetchFullStockData(id);
          } catch (err) {
            console.error(`載入 ${id} 失敗`, err);
            return null;
          }
        }));

        if (cancelled) return;

        const valid = results.filter(Boolean);
        setStocks(valid.map(r => r.stock));
        setWatchlist(valid.map(r => r.stock.id));
        setRealHistoricalCandles(prev => {
          const next = { ...prev };
          valid.forEach(r => { next[r.stock.id] = r.candles; });
          return next;
        });
        if (valid.length > 0) setSelectedStock(valid[0].stock);
      } catch (err) {
        console.error('載入自選清單失敗', err);
      } finally {
        if (!cancelled) setWatchlistLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchFullStockData]);

  // 更新自選清單內所有個股的今日最新真實行情（手動刷新按鈕）
  const loadRealStockPrices = useCallback(async () => {
    setRealDataLoading(true);
    try {
      const updatedStocks = await Promise.all(
        stocks.map(async (stock) => {
          try {
            const { stock: refreshed } = await fetchFullStockData(stock.id);
            return refreshed;
          } catch (error) {
            console.error(`載入真實股價失敗: ${stock.id}`, error);
            return stock;
          }
        })
      );

      setStocks(updatedStocks);
      const currentSelected = selectedStock && updatedStocks.find(s => s.id === selectedStock.id);
      if (currentSelected) {
        setSelectedStock(currentSelected);
      }
    } catch (e) {
      console.error("載入真實台股資料出錯", e);
    } finally {
      setRealDataLoading(false);
    }
  }, [stocks, selectedStock, fetchFullStockData]);

  // 載入特定股票的歷史日 K 線（切換選中股票時，若尚未快取）
  const loadHistoricalCandles = useCallback(async (stockId) => {
    if (realHistoricalCandles[stockId]) return;
    try {
      const data = await fetchFinMindDailyPrice(stockId);
      if (data && data.length > 0) {
        const converted = data.map(item => ({
          time: item.date,
          open: item.open,
          high: item.max,
          low: item.min,
          close: item.close,
          volume: Math.round(item.Trading_Volume / 1000)
        }));
        setRealHistoricalCandles(prev => ({
          ...prev,
          [stockId]: converted
        }));
      }
    } catch (e) {
      console.error(`載入 ${stockId} 歷史 K 線失敗`, e);
    }
  }, [realHistoricalCandles]);

  useEffect(() => {
    if (selectedStock) {
      loadHistoricalCandles(selectedStock.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStock?.id]);

  // 同步手機預覽版分頁與寬螢幕主分頁，防止裝置模式切換時視圖錯亂
  useEffect(() => {
    if (activeTab === 'guide') {
      setWidescreenTab('guide');
    } else {
      setWidescreenTab('dashboard');
    }
  }, [activeTab]);

  useEffect(() => {
    if (widescreenTab === 'guide') {
      setActiveTab('guide');
    } else {
      if (activeTab === 'guide') {
        setActiveTab('watchlist');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widescreenTab]);

  const getTrendColors = (value) => {
    const isPositive = value >= 0;
    return {
      text: isPositive ? 'text-[#ff453a] font-black' : 'text-[#30d158] font-black',
      bg: isPositive ? 'bg-[#ff453a]/20' : 'bg-[#30d158]/20',
      solidBg: isPositive ? 'bg-[#ff453a]' : 'bg-[#30d158]',
      border: isPositive ? 'border-[#ff453a]/50' : 'border-[#30d158]/50',
      iconColor: isPositive ? '#ff453a' : '#30d158'
    };
  };

  const currentCandles = useMemo(() => {
    if (!selectedStock) return [];
    const allCandles = realHistoricalCandles[selectedStock.id] || [];
    if (allCandles.length === 0) {
      return HISTORICAL_SAMPLES[timeRange] || [];
    }

    switch (timeRange) {
      case '5D':
        return allCandles.slice(-5);
      case '1M':
        return allCandles.slice(-22);
      case '3M':
        return allCandles.slice(-66);
      case '1Y':
        return allCandles.slice(-250);
      case '1D':
        const latestCandle = allCandles[allCandles.length - 1];
        return generateFittedIntradayPoints(latestCandle);
      default:
        return allCandles;
    }
  }, [timeRange, selectedStock, realHistoricalCandles]);

  const handleAddStock = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setRealDataLoading(true);
    try {
      const { stock, candles } = await fetchFullStockData(searchQuery.trim().toUpperCase());

      setRealHistoricalCandles(prev => ({ ...prev, [stock.id]: candles }));
      setStocks(prev => [stock, ...prev]);
      setWatchlist(prev => [stock.id, ...prev]);
      setSelectedStock(stock);
      setSearchQuery('');
      setShowAddModal(false);

      await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockId: stock.id }),
      });
    } catch (error) {
      console.error("驗證新增個股失敗", error);
      alert('載入此台股數據失敗，請確認代碼是否正確 (例如 2002 或 2330)。');
    } finally {
      setRealDataLoading(false);
    }
  };

  const handleRemoveStock = async (id) => {
    setWatchlist(prev => prev.filter(item => item !== id));
    if (selectedStock && selectedStock.id === id) {
      const remaining = stocks.filter(s => s.id !== id && watchlist.includes(s.id));
      if (remaining.length > 0) setSelectedStock(remaining[0]);
    }
    try {
      await fetch(`/api/watchlist?stockId=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (err) {
      console.error('刪除自選股失敗', err);
    }
  };

  const runAiStockEvaluation = (stock) => {
    setAiLoading(true);
    setTimeout(() => {
      setAiAnalysis(prev => ({
        ...prev,
        [stock.id]: '### 🤖 Radix AI 盤後綜合評級報告\n\n**評級：中性偏多 (Accumulate)**\n\n- **籌碼動向分析**：昨日三大法人整體呈現淨買超，' + (stock.chips.foreign > 0 ? '外資主動買盤明顯' : '外資微幅調節避險') + '，同時內資投信於支撐帶展現強防守意圖，底部籌碼結構紮實。\n- **財務基本健檢**：當前營收年增率 (YoY) 為 ' + stock.yoy + '%，配合高達 ' + stock.roe + '% 的 ROE 表現，利潤分配能力極強，估值落在合理中線區間。\n- **技術操作策略**：根據 15 分鐘線型結構，價格守穩主要均線。建議中長線投資人可趁回檔時分批策略性佈局。'
      }));
      setAiLoading(false);
    }, 1500);
  };

  if (watchlistLoading || !selectedStock) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-[#090a0c]">
        <div className="text-center space-y-3">
          <span className="w-3 h-3 rounded-full bg-[#3e63dd] animate-ping inline-block" />
          <p className="text-xs text-[#9ba1a6] font-bold">載入自選清單中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-[#121417] border-b-2 border-[#1f2125] px-6 py-5 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#3e63dd] rounded-xl flex items-center justify-center shadow-lg shadow-[#3e63dd]/30">
            <Icon name="trendingUp" className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wide text-white flex items-center gap-2">
              智慧籌碼K線 <span className="text-xs bg-[#3e63dd] text-white px-2.5 py-0.5 rounded-full font-black border border-[#5c7ce5]">測試中...</span>
            </h1>
            <p className="text-xs text-[#a0a5ad] font-bold mt-0.5">專為暗光環境優化的清晰視覺系統</p>
          </div>
        </div>
        {widescreenTab === 'guide' && (
          <div className="hidden md:flex bg-[#16181b] border-2 border-[#22252a] p-1 rounded-xl items-center text-xs">
            <button onClick={() => setWidescreenTab('dashboard')} className="px-4 py-1.5 rounded-lg font-black transition-all flex items-center gap-1.5 bg-[#22252a] text-[#3e63dd] border border-[#3e63dd]/20 shadow text-white">
              <Icon name="activity" className="w-3.5 h-3.5" /> 返回智慧看盤
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="bg-[#16181b] border-2 border-[#2f3238] p-1 rounded-xl flex items-center">
            <button onClick={() => setDeviceMode('phone')} className={'p-1.5 px-4 rounded-lg flex items-center gap-1.5 transition-all font-black ' + (deviceMode === 'phone' ? 'bg-[#22252a] text-white' : 'text-[#888d92]')}>
              <Icon name="smartphone" className="w-4 h-4" /> 手機版
            </button>
            <button onClick={() => setDeviceMode('fullscreen')} className={'p-1.5 px-4 rounded-lg flex items-center gap-1.5 transition-all font-black ' + (deviceMode === 'fullscreen' ? 'bg-[#22252a] text-white' : 'text-[#888d92]')}>
              <Icon name="monitor" className="w-4 h-4" /> 電腦版
            </button>
          </div>
          <button onClick={() => loadRealStockPrices()} disabled={realDataLoading} className={'px-3 py-1.5 rounded-lg border-2 flex items-center gap-1.5 font-black transition-all ' + (realDataLoading ? 'bg-[#3e63dd]/15 border-[#3e63dd]/50 text-[#3e63dd]' : 'bg-[#1a1c1e] border-[#2d3034] text-[#888d92] hover:text-white')}>
            <Icon name="refreshCw" className={'w-3.5 h-3.5 ' + (realDataLoading ? 'animate-spin' : '')} />
            {realDataLoading ? '更新中' : '更新數據'}
          </button>
          {user && (
            <div className="flex items-center gap-2 bg-[#16181b] border-2 border-[#2f3238] rounded-xl px-3 py-1.5">
              <span className="text-[#9ba1a6] font-bold max-w-[140px] truncate">{user.email}</span>
              <button onClick={() => signOut()} className="text-[#888d92] hover:text-white flex items-center gap-1 font-black">
                <Icon name="logOut" className="w-3.5 h-3.5" /> 登出
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex justify-center items-start bg-[#090a0c] p-4">
        {deviceMode === 'phone' ? (
          /* PHONE WRAPPER */
          <div className="relative w-full max-w-[355px] h-[610px] rounded-[44px] border-[8px] border-[#2c2d30] bg-[#090a0c] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-4.5 bg-black rounded-b-xl z-30"></div>
            <div className="px-5 pt-7 pb-3 flex justify-between items-center border-b-2 border-[#1f2125]">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#6e8eff] font-black">{activeTab === 'guide' ? 'K-Line Guide' : 'Watchlist'}</span>
                <h2 className="text-sm font-black text-white mt-0.5">{activeTab === 'guide' ? 'K線經典圖典' : '自選監控面板'}</h2>
              </div>
              {activeTab !== 'guide' && (
                <button onClick={() => setShowAddModal(true)} className="w-8 h-8 rounded-full bg-[#3e63dd] hover:bg-[#3451b2] flex items-center justify-center text-white transition-all shadow-lg shadow-[#3e63dd]/35">
                  <Icon name="plus" className="w-4 h-4 stroke-[3]" />
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto pb-16 px-3.5 pt-3 space-y-3.5">
              {renderPhoneContent()}
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-15 bg-[#121417]/95 border-t-2 border-[#1f2125] flex justify-around items-center pb-2 z-20">
              <button onClick={() => setActiveTab('watchlist')} className={'flex flex-col items-center gap-0.5 ' + (activeTab === 'watchlist' ? 'text-[#3e63dd]' : 'text-[#888d92]')}>
                <Icon name="activity" className="w-4 h-4" /><span className="text-[10px] font-black">自選</span>
              </button>
              <button onClick={() => setActiveTab('analysis')} className={'flex flex-col items-center gap-0.5 ' + (activeTab === 'analysis' ? 'text-[#3e63dd]' : 'text-[#888d92]')}>
                <Icon name="barChart2" className="w-4 h-4" /><span className="text-[10px] font-black">籌碼</span>
              </button>
              <button onClick={() => setActiveTab('ai')} className={'flex flex-col items-center gap-0.5 ' + (activeTab === 'ai' ? 'text-[#3e63dd]' : 'text-[#888d92]')}>
                <Icon name="sparkles" className="w-4 h-4" /><span className="text-[10px] font-black">AI</span>
              </button>
              <button onClick={() => setActiveTab('guide')} className={'flex flex-col items-center gap-0.5 ' + (activeTab === 'guide' ? 'text-[#3e63dd]' : 'text-[#888d92]')}>
                <Icon name="bookOpen" className="w-4 h-4" /><span className="text-[10px] font-black">圖典</span>
              </button>
            </div>
          </div>
        ) : widescreenTab === 'guide' ? (
          /* WIDESCREEN KLINE GUIDE VIEW */
          <div className="w-full" style={{ minHeight: 'calc(100vh - 120px)' }}>
            <KlineGuide />
          </div>
        ) : (
          /* FULLSCREEN WIDESCREEN */
          <div className="w-full grid grid-cols-12 gap-4" style={{ minHeight: 'calc(100vh - 120px)' }}>
            {/* Left: Watchlist */}
            <div className="col-span-3 bg-[#111315] border-2 border-[#22252a] rounded-xl p-4 flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 130px)' }}>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#9ba1a6] flex items-center gap-1.5">
                  我的自選清單
                  {realDataLoading && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3e63dd] animate-ping" />
                  )}
                </h3>
                <button onClick={() => setShowAddModal(true)} className="p-1.5 px-3 bg-[#1d2127] border-2 border-[#2d3139] hover:bg-[#2c323c] rounded-lg flex items-center gap-1 font-bold text-white transition-all shadow-md">
                  <Icon name="plus" className="w-3.5 h-3.5 stroke-[2.5]" /> 新增標的
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                {stocks.filter(s => watchlist.includes(s.id)).map(stock => {
                  const colors = getTrendColors(stock.change);
                  const isSelected = selectedStock.id === stock.id;
                  return (
                    <div key={stock.id} onClick={() => setSelectedStock(stock)}
                      className={'p-3 rounded-lg border-2 transition-all cursor-pointer flex justify-between items-center '
                        + (isSelected ? 'bg-[#1a1d23] border-[#3e63dd] shadow-lg shadow-[#3e63dd]/15 scale-[0.99]' : 'bg-[#15171a] border-[#1f2226] hover:border-[#32363b]')}>
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-1.5">{stock.name}<span className="text-xs text-slate-300 font-mono font-bold">{stock.id}</span></div>
                        <span className="text-xs text-slate-400 font-bold">{stock.category}</span>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <div className="text-sm font-mono font-extrabold text-white">{stock.price.toFixed(1)}</div>
                          <div className={'text-xs font-mono font-black ' + colors.text}>{stock.change >= 0 ? '+' : ''}{stock.changePercent}%</div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleRemoveStock(stock.id); }} className="p-1 text-slate-500 hover:text-[#ff453a] transition-all">
                          <Icon name="trash2" className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Chart + Details */}
            <div className="col-span-9 flex flex-col gap-4 overflow-y-auto pr-0.5" style={{ maxHeight: 'calc(100vh - 130px)' }}>
              {/* Stock Banner */}
              <div className="bg-[#111315] border-2 border-[#22252a] rounded-xl p-4 flex justify-between items-center shadow-lg flex-shrink-0">
                <div>
                  <span className="text-xs bg-[#1c2024] text-white px-2.5 py-0.5 rounded border border-[#2d3137] font-mono font-bold">{selectedStock.id}</span>
                  <h2 className="text-lg font-black text-white mt-1 flex items-center gap-2">
                    {selectedStock.name}
                    <span className="text-xs font-bold text-[#9ba1a6] flex items-center gap-1.5">
                      {realDataLoading ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-[#3e63dd] animate-ping" />
                          真實數據載入中...
                        </>
                      ) : '盤後高解析度診斷儀表板'}
                    </span>
                  </h2>
                </div>
                <div className="text-right">
                  <div className="text-xl font-mono font-black text-white">{selectedStock.price.toFixed(1)}</div>
                  <span className={'text-xs font-black ' + getTrendColors(selectedStock.change).text}>
                    {selectedStock.change >= 0 ? '+' : ''}{selectedStock.change.toFixed(1)} ({selectedStock.changePercent}%)
                  </span>
                </div>
              </div>

              {/* 走勢圖區域（折線 / K線 可切換） */}
              <div className="bg-[#111315] border-2 border-[#22252a] rounded-xl p-4 shadow-md flex-shrink-0 flex flex-col">
                <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                  <span className="text-sm font-black text-white flex items-center gap-1.5">
                    <Icon name="activity" className="w-5 h-5 text-[#3e63dd]" />
                    {chartType === 'line' ? '分時走勢圖' : 'K線走勢圖'}
                    <span className="text-xs text-[#9ba1a6] font-normal ml-1">(含格線・Tooltip{chartType === 'candle' ? '・成交量' : ''})</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex bg-[#0d0f12] p-1 rounded-lg border-2 border-[#2a2e36] text-xs">
                      <button
                        onClick={() => setChartType('line')}
                        className={'px-3 py-1 rounded-md font-black transition-all flex items-center gap-1 ' + (chartType === 'line' ? 'bg-[#22252a] text-[#3e63dd] border border-[#3e63dd]/30 shadow' : 'text-[#888d92] hover:text-white')}
                      >
                        折線
                      </button>
                      <button
                        onClick={() => setChartType('candle')}
                        className={'px-3 py-1 rounded-md font-black transition-all flex items-center gap-1 ' + (chartType === 'candle' ? 'bg-[#22252a] text-[#ffb224] border border-[#ffb224]/30 shadow' : 'text-[#888d92] hover:text-white')}
                      >
                        K線
                      </button>
                    </div>
                    <div className="flex bg-[#16181a] p-1 rounded-lg border-2 border-[#2d3137] text-xs">
                      {['1D', '5D', '1M', '3M', '1Y'].map(r => (
                        <button key={r} onClick={() => setTimeRange(r)} className={'px-3 py-1 rounded-md font-black transition-all ' + (timeRange === r ? 'bg-[#22252a] text-white shadow' : 'text-[#888d92]')}>{r}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {chartType === 'line' ? (
                  <WidescreenLineChart
                    trendColors={getTrendColors(selectedStock.change)}
                    candles={currentCandles}
                  />
                ) : (
                  <CandlestickChart
                    trendColors={getTrendColors(selectedStock.change)}
                    candles={currentCandles}
                  />
                )}
              </div>

              {/* Bottom Diagnostics */}
              <div className="grid grid-cols-3 gap-4 flex-shrink-0">
                <div className="bg-[#111315] border-2 border-[#22252a] rounded-xl p-3 flex flex-col justify-between shadow-md" style={{ minHeight: '160px' }}>
                  <span className="text-xs font-black text-white flex items-center gap-1.5"><Icon name="barChart2" className="w-4 h-4 text-[#7c3aed]" /> 三大法人買賣超 (張)</span>
                  <div className="flex-1 flex flex-col justify-center"><ChipsBarChart chips={selectedStock.chips} getTrendColors={getTrendColors} /></div>
                </div>
                <div className="bg-[#111315] border-2 border-[#22252a] rounded-xl p-3 flex flex-col justify-between shadow-md" style={{ minHeight: '160px' }}>
                  <span className="text-xs font-black text-white flex items-center gap-1.5"><Icon name="pieChart" className="w-4 h-4 text-[#30d158] font-black" /> 財務季度診斷</span>
                  <div className="flex items-center justify-between gap-1 mt-1">
                    <div className="text-[10px] space-y-0.5 text-slate-300 font-bold leading-tight">
                      <div>EPS: <span className="text-white font-mono">{selectedStock.eps}元</span></div>
                      <div>YoY: <span className={getTrendColors(selectedStock.yoy).text}>{selectedStock.yoy}%</span></div>
                      <div>ROE: <span className="text-white font-mono">{selectedStock.roe}%</span></div>
                    </div>
                    <div className="flex-shrink-0"><FinancialRadar /></div>
                  </div>
                </div>
                <div className="bg-[#111315] border-2 border-[#22252a] rounded-xl p-3 flex flex-col justify-between shadow-md" style={{ minHeight: '160px' }}>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-white flex items-center gap-1.5"><Icon name="sparkles" className="w-4 h-4 text-[#3e63dd]" /> AI 多空健檢</span>
                    <button onClick={() => runAiStockEvaluation(selectedStock)} disabled={aiLoading} className="px-2 py-0.5 bg-[#3e63dd] hover:bg-[#3451b2] text-white rounded text-[10px] font-black transition-all">{aiLoading ? '...' : '分析'}</button>
                  </div>
                  <div className="bg-[#15171a] border-2 border-[#1e2023] rounded-lg p-2 h-24 overflow-y-auto text-[10px] leading-relaxed text-slate-200 font-bold whitespace-pre-line scrollbar-thin mt-1">
                    {aiAnalysis[selectedStock.id] ? aiAnalysis[selectedStock.id] : '點擊「分析」產出大數據投顧診斷。'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 電腦版最下方的 K 線說明連結 */}
      {deviceMode !== 'phone' && (
        <footer className="bg-[#111315] border-t-2 border-[#1f2125] py-4 px-6 text-center text-xs text-[#888d92] flex-shrink-0 flex items-center justify-center gap-1">
          <span className="font-black text-white mr-2">K 線是什麼？</span>
          <button
            onClick={() => setWidescreenTab(widescreenTab === 'guide' ? 'dashboard' : 'guide')}
            className="text-[#3e63dd] hover:text-[#5c7ce5] font-black transition-all underline focus:outline-none"
          >
            {widescreenTab === 'guide' ? '返回智慧看盤' : '點此查看 K線型態圖典'}
          </button>
        </footer>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111315] border-2 border-[#2d3035] w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-5 py-3 border-b-2 border-[#1f2125] flex justify-between items-center">
              <h4 className="text-sm font-black text-white flex items-center gap-1.5"><Icon name="plus" className="w-4 h-4 text-[#3e63dd] stroke-[2.5]" /> 新增自選監控標的</h4>
              <button onClick={() => setShowAddModal(false)} className="text-[#888d92] hover:text-white text-xs font-black">關閉</button>
            </div>
            <form onSubmit={handleAddStock} className="p-5 space-y-3">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="例如: 2330, 2454, 長榮"
                className="w-full bg-[#16181a] border-2 border-[#2d3137] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#6f737a] font-bold focus:outline-none focus:border-[#3e63dd]"
                autoFocus />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2 bg-[#1a1c1e] text-slate-400 text-xs font-bold rounded-lg border-2 border-[#2a2d32]">取消</button>
                <button type="submit" className="flex-1 py-2 bg-[#3e63dd] text-white text-xs font-bold rounded-lg hover:bg-[#3451b2]">確認新增</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  function renderPhoneContent() {
    switch (activeTab) {
      case 'watchlist':
        return (
          <div className="space-y-2">
            {stocks.filter(s => watchlist.includes(s.id)).map(stock => {
              const colors = getTrendColors(stock.change);
              const isSelected = selectedStock.id === stock.id;
              return (
                <div key={stock.id} onClick={() => { setSelectedStock(stock); setActiveTab('analysis'); }}
                  className={'p-3 rounded-xl border-2 transition-all flex items-center justify-between ' + (isSelected ? 'bg-[#1a1d23] border-[#3e63dd]' : 'bg-[#111315] border-[#1f2226]')}>
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-1.5">{stock.name}<span className="text-xs text-slate-400 font-normal font-mono">{stock.id.replace('.TW', '')}</span></div>
                    <span className="text-xs text-slate-400 font-bold">{stock.category}</span>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <span className="text-sm font-mono font-bold text-white">{stock.price.toFixed(1)}</span>
                    <span className={'w-16 py-1 rounded-lg text-center text-xs font-extrabold text-white ' + colors.solidBg}>{stock.change >= 0 ? '+' : ''}{stock.changePercent}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      case 'analysis':
        return (
          <div className="space-y-4">
            <div className="bg-[#111315] border-2 border-[#22252a] rounded-xl p-3">
              <span className="text-xs text-slate-400 block uppercase font-black">當前標的</span>
              <h3 className="text-sm font-black text-white mt-0.5">{selectedStock.name} ({selectedStock.id})</h3>
              <div className="mt-2 pt-2 border-t border-[#1f2125]">
                <SimpleLineChart trendColors={getTrendColors(selectedStock.change)} points={currentCandles} />
              </div>
            </div>
            <div className="bg-[#111315] border-2 border-[#22252a] rounded-xl p-3">
              <span className="text-xs font-black text-white block mb-2">三大法人買賣超 (張)</span>
              <ChipsBarChart chips={selectedStock.chips} getTrendColors={getTrendColors} />
            </div>
          </div>
        );
      case 'ai':
        return (
          <div className="space-y-4">
            <div className="bg-gradient-to-b from-[#1c243d] to-[#111315] border-2 border-[#2b355a] rounded-xl p-4 text-center space-y-2">
              <Icon name="sparkles" className="w-6 h-6 text-[#6e8eff] mx-auto" />
              <h3 className="text-xs font-black text-white">AI 籌碼多空分析師</h3>
              <button onClick={() => runAiStockEvaluation(selectedStock)} disabled={aiLoading} className="w-full py-2 bg-[#3e63dd] text-white text-xs font-bold rounded-lg shadow-md">
                {aiLoading ? '大數據分析中...' : '產生 ' + selectedStock.name + ' 報告'}
              </button>
            </div>
            <div className="bg-[#111315] border-2 border-[#22252a] rounded-xl p-3 text-xs leading-relaxed text-slate-200 font-bold whitespace-pre-line min-h-[140px]">
              {aiAnalysis[selectedStock.id] ? aiAnalysis[selectedStock.id] : '尚未產生報告，請點擊上方按鈕獲取智能解讀。'}
            </div>
          </div>
        );
      case 'guide':
        return <KlineGuide />;
      default:
        return null;
    }
  }
}

/* =====================================================
   WidescreenLineChart - 寬螢幕版折線走勢圖
   帶格線、Y軸標籤、漸層填滿、滑鼠 Tooltip
   ===================================================== */
function WidescreenLineChart({ trendColors, candles = [] }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [containerWidth, setContainerWidth] = useState(900);

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setContainerWidth(w);
      }
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const color = trendColors.iconColor;
  const n = candles.length;
  if (n === 0) return null;

  const W = containerWidth;
  const H = 300;
  const PAD_L = 58;
  const PAD_R = 12;
  const PAD_T = 14;
  const PAD_B = 28;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const values = candles.map(c => c.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const buffer = range * 0.08;
  const effectMin = min - buffer;
  const effectMax = max + buffer;
  const effectRange = effectMax - effectMin;

  const toX = (i) => n > 1 ? PAD_L + (i / (n - 1)) * chartW : PAD_L + chartW / 2;
  const toY = (v) => PAD_T + chartH * (1 - (v - effectMin) / effectRange);

  const linePts = candles.map((c, i) => toX(i) + ',' + toY(c.close)).join(' ');

  const fillPath = 'M ' + PAD_L + ',' + (PAD_T + chartH)
    + ' ' + candles.map((c, i) => 'L ' + toX(i) + ',' + toY(c.close)).join(' ')
    + ' L ' + (PAD_L + chartW) + ',' + (PAD_T + chartH) + ' Z';

  const GRID = 5;
  const gridLines = Array.from({ length: GRID }, (_, i) => {
    const frac = i / (GRID - 1);
    const price = effectMax - frac * effectRange;
    const y = PAD_T + frac * chartH;
    return { y, price };
  });

  const maxLabels = Math.min(10, n);
  const labelStep = Math.max(1, Math.floor(n / maxLabels));
  const timeLabels = candles.map((c, i) => ({ i, time: c.time })).filter((_, i) => i % labelStep === 0 || i === n - 1);

  const handleMouseMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left - PAD_L;
    const rawIdx = (mx / chartW) * (n - 1);
    const idx = Math.max(0, Math.min(n - 1, Math.round(rawIdx)));
    if (mx < -20 || mx > chartW + 20) { setTooltip(null); return; }
    setTooltip({ candle: candles[idx], idx, x: toX(idx), y: toY(candles[idx].close) });
  };

  const gradId = 'wsLineGrad_taiwan';

  return (
    <div ref={containerRef} className="w-full" style={{ userSelect: 'none' }}>
      <svg ref={svgRef} width="100%" height={H}
        viewBox={'0 0 ' + W + ' ' + H}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        style={{ cursor: 'crosshair', display: 'block' }}>

        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="60%" stopColor={color} stopOpacity="0.10" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <filter id="wsLineShadow">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.65" />
          </filter>
        </defs>

        <rect x={PAD_L} y={PAD_T} width={chartW} height={chartH} fill="#0c0e10" rx="3" />

        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={PAD_L} y1={g.y} x2={PAD_L + chartW} y2={g.y}
              stroke={i === 0 || i === GRID - 1 ? '#272b32' : '#191c21'}
              strokeWidth="1"
              strokeDasharray={i === 0 || i === GRID - 1 ? '' : '3,5'} />
            <text x={PAD_L - 5} y={g.y + 4}
              textAnchor="end" fill="#4e5868" fontSize="10.5"
              fontFamily="'Courier New', monospace">
              {g.price.toFixed(1)}
            </text>
          </g>
        ))}

        <path d={fillPath} fill={'url(#' + gradId + ')'} />

        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={linePts}
        />

        {tooltip && (
          <g>
            <line x1={tooltip.x} y1={PAD_T} x2={tooltip.x} y2={PAD_T + chartH}
              stroke={color} strokeWidth="1" strokeDasharray="4,3" opacity="0.55" />
            <circle cx={tooltip.x} cy={tooltip.y} r="5"
              fill={color} stroke="#111315" strokeWidth="2" />
            <circle cx={tooltip.x} cy={tooltip.y} r="9"
              fill={color} fillOpacity="0.15" />
          </g>
        )}

        {timeLabels.map(({ i, time }) => (
          <text key={i} x={toX(i)} y={H - 6}
            textAnchor="middle" fill="#404c5a" fontSize="9.5"
            fontFamily="'Courier New', monospace">{time}</text>
        ))}

        {tooltip && (() => {
          const c = tooltip.candle;
          const isUp = c.close >= c.open;
          const diff = (c.close - c.open).toFixed(1);
          const diffPct = (((c.close - c.open) / c.open) * 100).toFixed(2);
          const TW = 148; const TH = 78;
          let tx = tooltip.x + 16;
          let ty = tooltip.y - 20;
          if (tx + TW > W - PAD_R) tx = tooltip.x - TW - 12;
          if (ty < PAD_T) ty = PAD_T + 4;
          if (ty + TH > PAD_T + chartH) ty = PAD_T + chartH - TH - 4;
          return (
            <g filter="url(#wsLineShadow)">
              <rect x={tx} y={ty} width={TW} height={TH} rx="7" fill="#181b22" stroke="#2a2f3a" strokeWidth="1.5" />
              <rect x={tx} y={ty} width={TW} height={3} rx="2" fill={color} />
              <text x={tx + 10} y={ty + 18} fill="#7a8898" fontSize="10" fontFamily="sans-serif">時間</text>
              <text x={tx + TW - 10} y={ty + 18} textAnchor="end" fill="white" fontSize="10" fontWeight="bold" fontFamily="'Courier New', monospace">{c.time}</text>
              <text x={tx + 10} y={ty + 36} fill="#7a8898" fontSize="10" fontFamily="sans-serif">收盤</text>
              <text x={tx + TW - 10} y={ty + 36} textAnchor="end" fill={color} fontSize="11" fontWeight="bold" fontFamily="'Courier New', monospace">{c.close.toFixed(1)}</text>
              <text x={tx + 10} y={ty + 54} fill="#7a8898" fontSize="10" fontFamily="sans-serif">漲跌</text>
              <text x={tx + TW - 10} y={ty + 54} textAnchor="end" fill={color} fontSize="10.5" fontWeight="bold" fontFamily="'Courier New', monospace">
                {isUp ? '+' : ''}{diff} ({isUp ? '+' : ''}{diffPct}%)
              </text>
              <text x={tx + 10} y={ty + 70} fill="#7a8898" fontSize="10" fontFamily="sans-serif">成交量</text>
              <text x={tx + TW - 10} y={ty + 70} textAnchor="end" fill="#9aabb8" fontSize="10" fontWeight="bold" fontFamily="'Courier New', monospace">
                {c.volume >= 10000 ? (c.volume / 1000).toFixed(1) + 'K' : c.volume.toLocaleString()}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

/* =====================================================
   CandlestickChart - K 線 + 成交量 + 格線 + Tooltip
   ===================================================== */
function CandlestickChart({ trendColors, candles = [] }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [containerWidth, setContainerWidth] = useState(900);

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setContainerWidth(w);
      }
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const upColor = '#ff453a';
  const downColor = '#30d158';

  const W = containerWidth;
  const H_CANDLE = 260;
  const H_VOL = 70;
  const SEP = 10;
  const H_XAXIS = 20;
  const H_TOTAL = H_CANDLE + SEP + H_VOL + H_XAXIS;
  const PAD_L = 62;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B_C = 6;

  const chartW = W - PAD_L - PAD_R;
  const n = candles.length;
  if (n === 0) return null;

  const priceMin = Math.min(...candles.map(c => c.low));
  const priceMax = Math.max(...candles.map(c => c.high));
  const priceRange = priceMax - priceMin || 1;
  const priceBuffer = priceRange * 0.05;

  const effectMin = priceMin - priceBuffer;
  const effectMax = priceMax + priceBuffer;
  const effectRange = effectMax - effectMin;

  const toY = (price) =>
    PAD_T + (H_CANDLE - PAD_T - PAD_B_C) * (1 - (price - effectMin) / effectRange);

  const volTop = H_CANDLE + SEP + 4;
  const volBottom = H_CANDLE + SEP + H_VOL - 4;
  const volMax = Math.max(...candles.map(c => c.volume), 1);
  const toVolH = (vol) => ((vol / volMax) * (volBottom - volTop));

  const candleSlot = n > 1 ? chartW / (n - 1) : chartW;
  const candleWidth = Math.max(2, Math.min(14, (chartW / n) * 0.6));

  const getX = (i) => n > 1 ? PAD_L + (i / (n - 1)) * chartW : PAD_L + chartW / 2;

  const GRID_COUNT = 5;
  const gridLines = Array.from({ length: GRID_COUNT }, (_, i) => {
    const frac = i / (GRID_COUNT - 1);
    const price = effectMax - frac * effectRange;
    const y = PAD_T + frac * (H_CANDLE - PAD_T - PAD_B_C);
    return { y, price };
  });

  const maxLabels = Math.min(10, n);
  const labelStep = Math.max(1, Math.floor(n / maxLabels));
  const timeLabels = candles.map((c, i) => ({ i, time: c.time })).filter((_, i) => i % labelStep === 0 || i === n - 1);

  const handleMouseMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left - PAD_L;
    const rawIdx = (mx / chartW) * (n - 1);
    const idx = Math.max(0, Math.min(n - 1, Math.round(rawIdx)));
    if (mx < -20 || mx > chartW + 20) { setTooltip(null); return; }
    setTooltip({ candle: candles[idx], idx, x: getX(idx) });
  };

  const tableData = candles.slice(-12);

  return (
    <div className="flex flex-col w-full">
      <div ref={containerRef} className="w-full" style={{ userSelect: 'none' }}>
        <svg ref={svgRef} width="100%" height={H_TOTAL}
          viewBox={'0 0 ' + W + ' ' + H_TOTAL}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
          style={{ cursor: 'crosshair', display: 'block' }}>

          <defs>
            <linearGradient id="cVGradUp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={upColor} stopOpacity="0.8" />
              <stop offset="100%" stopColor={upColor} stopOpacity="0.15" />
            </linearGradient>
            <linearGradient id="cVGradDown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={downColor} stopOpacity="0.8" />
              <stop offset="100%" stopColor={downColor} stopOpacity="0.15" />
            </linearGradient>
            <filter id="ttShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor="#000" floodOpacity="0.7" />
            </filter>
          </defs>

          <rect x={PAD_L} y={PAD_T} width={chartW} height={H_CANDLE - PAD_T - PAD_B_C} fill="#0c0e10" rx="3" />

          {gridLines.map((g, i) => (
            <g key={i}>
              <line x1={PAD_L} y1={g.y} x2={PAD_L + chartW} y2={g.y}
                stroke={i === 0 || i === GRID_COUNT - 1 ? '#282c33' : '#1a1d22'}
                strokeWidth="1"
                strokeDasharray={i === 0 || i === GRID_COUNT - 1 ? '' : '3,5'} />
              <text x={PAD_L - 5} y={g.y + 4} textAnchor="end"
                fill="#505a68" fontSize="10.5" fontFamily="'Courier New', monospace">
                {g.price.toFixed(1)}
              </text>
            </g>
          ))}

          <line x1={PAD_L} y1={H_CANDLE + SEP / 2} x2={PAD_L + chartW} y2={H_CANDLE + SEP / 2}
            stroke="#22262c" strokeWidth="1" />

          <rect x={PAD_L} y={H_CANDLE + SEP} width={chartW} height={H_VOL} fill="#09090b" rx="2" />

          {[0.5, 1].map((f, i) => {
            const vy = volBottom - f * (volBottom - volTop);
            return <line key={i} x1={PAD_L} y1={vy} x2={PAD_L + chartW} y2={vy} stroke="#161920" strokeWidth="1" strokeDasharray="3,5" />;
          })}

          <text x={PAD_L - 5} y={volTop + 10} textAnchor="end" fill="#505a68" fontSize="9" fontFamily="'Courier New', monospace">{(volMax / 1000).toFixed(0)}K</text>
          <text x={PAD_L - 5} y={volBottom} textAnchor="end" fill="#505a68" fontSize="9" fontFamily="'Courier New', monospace">0</text>

          {candles.map((c, i) => {
            const cx = getX(i);
            const isUp = c.close >= c.open;
            const color = isUp ? upColor : downColor;
            const yO = toY(c.open);
            const yC = toY(c.close);
            const yH = toY(c.high);
            const yL = toY(c.low);
            const bodyTop = Math.min(yO, yC);
            const bodyH = Math.max(1.5, Math.abs(yC - yO));
            const vh = toVolH(c.volume);
            const vb = volBottom - vh;
            const isHov = tooltip && tooltip.idx === i;

            return (
              <g key={i}>
                {isHov && (
                  <rect x={cx - candleSlot / 2} y={PAD_T} width={candleSlot}
                    height={H_CANDLE - PAD_T - PAD_B_C} fill="rgba(62,99,221,0.07)" />
                )}
                {isHov && (
                  <line x1={cx} y1={PAD_T} x2={cx} y2={H_CANDLE + SEP + H_VOL}
                    stroke="#3e63dd" strokeWidth="0.8" strokeDasharray="4,3" opacity="0.6" />
                )}
                <line x1={cx} y1={yH} x2={cx} y2={yL}
                  stroke={color} strokeWidth={isHov ? 2 : 1.2} />
                <rect x={cx - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyH}
                  fill={color} fillOpacity={isUp ? 1 : 0.85}
                  stroke={color} strokeWidth="0.4" rx="0.5" />
                <rect x={cx - candleWidth / 2} y={vb} width={candleWidth} height={Math.max(1, vh)}
                  fill={isUp ? 'url(#cVGradUp)' : 'url(#cVGradDown)'}
                  opacity={isHov ? 1 : 0.7} rx="1" />
              </g>
            );
          })}

          {timeLabels.map(({ i, time }) => (
            <text key={i} x={getX(i)} y={H_CANDLE + SEP + H_VOL + 14}
              textAnchor="middle" fill="#424c5a" fontSize="9.5"
              fontFamily="'Courier New', monospace">{time}</text>
          ))}

          {tooltip && (() => {
            const c = tooltip.candle;
            const isUp = c.close >= c.open;
            const col = isUp ? upColor : downColor;
            const TW = 138; const TH = 118;
            let tx = tooltip.x + 16;
            let ty = PAD_T + 8;
            if (tx + TW > W - PAD_R) tx = tooltip.x - TW - 12;
            if (ty + TH > H_CANDLE) ty = H_CANDLE - TH - 4;
            const rows = [
              { label: '開盤', val: c.open.toFixed(1) },
              { label: '最高', val: c.high.toFixed(1) },
              { label: '最低', val: c.low.toFixed(1) },
              { label: '收盤', val: c.close.toFixed(1) },
              { label: '成交量', val: (c.volume / 1000).toFixed(1) + 'K' },
            ];
            return (
              <g filter="url(#ttShadow)">
                <rect x={tx} y={ty} width={TW} height={TH} rx="7" fill="#181b22" stroke="#2a2f3a" strokeWidth="1.5" />
                <rect x={tx} y={ty} width={TW} height={20} rx="7" fill={col} fillOpacity="0.18" />
                <rect x={tx} y={ty + 13} width={TW} height={7} fill={col} fillOpacity="0.18" />
                <text x={tx + 10} y={ty + 14} fill={col} fontSize="11" fontWeight="bold" fontFamily="sans-serif">{c.time}</text>
                <text x={tx + TW - 10} y={ty + 14} textAnchor="end" fill={col} fontSize="10" fontFamily="sans-serif">{isUp ? '▲' : '▼'}</text>
                {rows.map((row, ri) => (
                  <g key={ri}>
                    <text x={tx + 10} y={ty + 32 + ri * 17} fill="#7a8898" fontSize="10" fontFamily="sans-serif">{row.label}</text>
                    <text x={tx + TW - 10} y={ty + 32 + ri * 17} textAnchor="end"
                      fill={ri < 4 ? col : '#9aabb8'} fontSize="10.5" fontWeight="bold"
                      fontFamily="'Courier New', monospace">{row.val}</text>
                  </g>
                ))}
              </g>
            );
          })()}
        </svg>
      </div>

      <PriceVolumeTable candles={tableData} />
    </div>
  );
}

/* =====================================================
   PriceVolumeTable - 走勢圖下方價量明細表
   ===================================================== */
function PriceVolumeTable({ candles }) {
  const upColor = '#ff453a';
  const downColor = '#30d158';

  return (
    <div className="mt-3 border-t-2 border-[#1a1d22] pt-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-black text-[#9ba1a6] uppercase tracking-wider">近期價量明細</span>
        <span className="text-[10px] text-[#3e4550]">最近 {candles.length} 根 K 棒</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[#1e2228]">
        <table className="w-full text-[11px] border-collapse" style={{ minWidth: '560px' }}>
          <thead>
            <tr style={{ background: '#0f1114' }}>
              {['時間', '開盤', '最高', '最低', '收盤', '漲跌幅', '成交量(張)'].map(h => (
                <th key={h} className="py-2 px-3 text-left font-black whitespace-nowrap" style={{ color: '#505a68', borderBottom: '1px solid #1e2228' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...candles].reverse().map((c, i) => {
              const isUp = c.close >= c.open;
              const color = isUp ? upColor : downColor;
              const diff = (c.close - c.open).toFixed(1);
              const diffPct = (((c.close - c.open) / c.open) * 100).toFixed(2);
              return (
                <tr key={i} style={{ borderBottom: '1px solid #141720', cursor: 'default' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#141720'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td className="py-2 px-3 font-mono whitespace-nowrap" style={{ color: '#5a6680' }}>{c.time}</td>
                  <td className="py-2 px-3 font-mono" style={{ color: '#b0bac8' }}>{c.open.toFixed(1)}</td>
                  <td className="py-2 px-3 font-mono font-bold" style={{ color: upColor }}>{c.high.toFixed(1)}</td>
                  <td className="py-2 px-3 font-mono font-bold" style={{ color: downColor }}>{c.low.toFixed(1)}</td>
                  <td className="py-2 px-3 font-mono font-black" style={{ color }}>{c.close.toFixed(1)}</td>
                  <td className="py-2 px-3 font-mono font-black whitespace-nowrap" style={{ color }}>
                    {isUp ? '+' : ''}{diff} ({isUp ? '+' : ''}{diffPct}%)
                  </td>
                  <td className="py-2 px-3 font-mono" style={{ color: '#7888a0' }}>
                    {c.volume >= 10000 ? (c.volume / 1000).toFixed(1) + 'K' : c.volume.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =====================================================
   SimpleLineChart - 手機版折線圖
   ===================================================== */
function SimpleLineChart({ trendColors, points = [] }) {
  const width = 220;
  const height = 80;
  const padding = 6;
  const values = points.map(p => p.close);
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const svgPts = values.map((v, i) => {
    const x = padding + (i * (width - padding * 2)) / (values.length - 1);
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return x + ',' + y;
  }).join(' ');

  const closed = svgPts ? padding + ',' + (height - padding) + ' ' + svgPts + ' ' + (width - padding) + ',' + (height - padding) : '';

  return (
    <svg viewBox={'0 0 ' + width + ' ' + height} className="w-full h-full overflow-visible">
      <defs>
        <linearGradient id="mobGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={trendColors.iconColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={trendColors.iconColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1={height * 0.25} x2={width} y2={height * 0.25} stroke="#22252a" strokeWidth="1" strokeDasharray="3,3" />
      <line x1="0" y1={height * 0.5} x2={width} y2={height * 0.5} stroke="#22252a" strokeWidth="1" strokeDasharray="3,3" />
      <line x1="0" y1={height * 0.75} x2={width} y2={height * 0.75} stroke="#22252a" strokeWidth="1" strokeDasharray="3,3" />
      <path d={'M ' + closed} fill="url(#mobGrad)" />
      <polyline fill="none" stroke={trendColors.iconColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={svgPts} />
    </svg>
  );
}

/* =====================================================
   ChipsBarChart - 三大法人柱狀圖
   ===================================================== */
function ChipsBarChart({ chips, getTrendColors }) {
  const targets = [{ label: '外資 (FI)', val: chips.foreign }, { label: '投信 (IT)', val: chips.trust }, { label: '自營商 (DL)', val: chips.dealer }];
  return (
    <div className="space-y-3 flex-1 flex flex-col justify-center">
      {targets.map((t, i) => {
        const colors = getTrendColors(t.val);
        const widthPercent = Math.min(100, (Math.abs(t.val) / 4500) * 100);
        return (
          <div key={i} className="text-xs">
            <div className="flex justify-between mb-1 text-slate-200 font-black">
              <span>{t.label}</span>
              <span className={'font-mono font-black ' + colors.text}>{t.val > 0 ? '+' : ''}{t.val}</span>
            </div>
            <div className="h-4 bg-[#16181a] border-2 border-[#2d3137] rounded flex overflow-hidden">
              <div className="w-1/2 flex justify-end pr-px">{t.val < 0 && <div style={{ width: widthPercent + '%' }} className={colors.solidBg + ' opacity-95'} />}</div>
              <div className="w-1/2 flex justify-start pl-px">{t.val >= 0 && <div style={{ width: widthPercent + '%' }} className={colors.solidBg + ' opacity-95'} />}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =====================================================
   FinancialRadar - 財務雷達圖
   ===================================================== */
function FinancialRadar() {
  const cx = 35; const cy = 35; const r = 24;
  const angles = [-Math.PI / 2, -Math.PI / 2 + (2 * Math.PI) / 5, -Math.PI / 2 + (4 * Math.PI) / 5, -Math.PI / 2 + (6 * Math.PI) / 5, -Math.PI / 2 + (8 * Math.PI) / 5];
  const scores = [0.85, 0.7, 0.9, 0.65, 0.8];
  const scorePath = angles.map((a, i) => (i === 0 ? 'M' : 'L') + ' ' + (cx + r * scores[i] * Math.cos(a)) + ' ' + (cy + r * scores[i] * Math.sin(a))).join(' ') + ' Z';
  const ringPath = (s) => angles.map((a, i) => (i === 0 ? 'M' : 'L') + ' ' + (cx + r * s * Math.cos(a)) + ' ' + (cy + r * s * Math.sin(a))).join(' ') + ' Z';
  return (
    <svg viewBox="0 0 70 70" className="w-20 h-20 overflow-visible">
      <path d={ringPath(1)} fill="none" stroke="#2c2e32" strokeWidth="1.2" />
      <path d={ringPath(0.6)} fill="none" stroke="#2c2e32" strokeWidth="0.8" strokeDasharray="1.5,1.5" />
      <path d={scorePath} fill="#3e63dd" fillOpacity="0.35" stroke="#3e63dd" strokeWidth="2.0" />
    </svg>
  );
}
