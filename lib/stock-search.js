// 股票清單整理與搜尋排序（純函式，伺服器端搜尋與測試共用）

import { STOCK_ID_PATTERN } from '@/lib/stock-id';

export const MAX_RESULTS = 10;

/**
 * FinMind TaiwanStockInfo 原始資料 → 可搜尋清單 [{ id, name, category, market, isStock }]
 * - 只保留上市（twse）、上櫃（tpex）；興櫃在 FinMind 沒有日 K，加入也無法顯示
 * - 排除權證（產業類別為「所有證券」）
 * - 同一代碼可能有多筆（不同產業別），取第一筆
 */
export function buildStockList(rows) {
  const byId = new Map();
  for (const row of rows) {
    if (row.type !== 'twse' && row.type !== 'tpex') continue;
    if (row.industry_category === '所有證券') continue;
    if (!STOCK_ID_PATTERN.test(`${row.stock_id}.TW`)) continue;
    if (byId.has(row.stock_id)) continue;
    byId.set(row.stock_id, {
      id: row.stock_id,
      name: row.stock_name,
      category: row.industry_category,
      market: row.type,
      // 非 0 開頭的 4 位數字代碼是一般股票（0050～0061 這批早期 ETF 也是 4 位數，但 0 開頭）；
      // ETF、ETN、特別股等其他商品排在同層級的股票之後
      isStock: /^[1-9]\d{3}$/.test(row.stock_id),
    });
  }
  return [...byId.values()];
}

/**
 * 依名稱或代碼搜尋，排序：完全相符 → 開頭相符 → 名稱包含；同層級股票優先，再依代碼排序。
 * 回傳最多 MAX_RESULTS 筆，代碼加上 .TW。
 */
export function searchStockList(list, rawQuery) {
  const query = String(rawQuery ?? '').trim().toUpperCase().replace(/\.TW$/, '');
  if (!query) return [];

  const scored = [];
  for (const item of list) {
    const name = item.name.toUpperCase();
    let rank;
    if (item.id === query || name === query) rank = 0;
    else if (item.id.startsWith(query) || name.startsWith(query)) rank = 1;
    else if (name.includes(query)) rank = 2;
    else continue;
    scored.push({ item, rank });
  }

  scored.sort((a, b) => a.rank - b.rank
    || Number(b.item.isStock) - Number(a.item.isStock)
    || a.item.id.localeCompare(b.item.id));

  return scored.slice(0, MAX_RESULTS).map(({ item }) => ({
    id: `${item.id}.TW`,
    name: item.name,
    category: item.category,
    market: item.market,
  }));
}
