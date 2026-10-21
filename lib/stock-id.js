// 台股代碼：4–6 位數字，可帶一個英文字尾（如特別股 2881A、債券 ETF 00679B），統一以 .TW 結尾
export const STOCK_ID_PATTERN = /^\d{4,6}[A-Z]?\.TW$/;

// 使用者輸入（2330 / 2330.tw）統一轉成 2330.TW
export function normalizeStockId(raw) {
  const id = String(raw ?? '').trim().toUpperCase();
  if (!id) return '';
  return id.endsWith('.TW') ? id : id + '.TW';
}

// 正規化後符合格式才回傳，否則回傳 null
export function parseStockId(raw) {
  const id = normalizeStockId(raw);
  return STOCK_ID_PATTERN.test(id) ? id : null;
}
