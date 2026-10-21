import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getOrSeedWatchlist, addToWatchlist, removeFromWatchlist, getWatchlist } from '@/lib/db';

// 新使用者第一次載入時種入的預設自選股
const DEFAULT_WATCHLIST_IDS = ['2330.TW', '2317.TW', '2454.TW', '2603.TW', '2881.TW'];

// 台股代碼：4–6 位數字，可帶一個英文字尾（如特別股 2881A、債券 ETF 00679B）
const STOCK_ID_PATTERN = /^\d{4,6}[A-Z]?\.TW$/;

function parseStockId(value) {
  if (typeof value !== 'string') return null;
  const stockId = value.trim().toUpperCase();
  return STOCK_ID_PATTERN.test(stockId) ? stockId : null;
}

async function withUser(handler) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    return await handler(email);
  } catch (err) {
    console.error('[api/watchlist] 資料庫操作失敗', err);
    return NextResponse.json({ error: 'db_unavailable' }, { status: 503 });
  }
}

export function GET() {
  return withUser(async (email) => {
    const watchlist = await getOrSeedWatchlist(email, DEFAULT_WATCHLIST_IDS);
    return NextResponse.json({ watchlist });
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const stockId = parseStockId(body?.stockId);
  return withUser(async (email) => {
    if (!stockId) {
      return NextResponse.json({ error: 'invalid_stock_id' }, { status: 400 });
    }
    await addToWatchlist(email, stockId);
    return NextResponse.json({ watchlist: await getWatchlist(email) });
  });
}

export function DELETE(request) {
  const stockId = parseStockId(new URL(request.url).searchParams.get('stockId'));
  return withUser(async (email) => {
    if (!stockId) {
      return NextResponse.json({ error: 'invalid_stock_id' }, { status: 400 });
    }
    await removeFromWatchlist(email, stockId);
    return NextResponse.json({ watchlist: await getWatchlist(email) });
  });
}
