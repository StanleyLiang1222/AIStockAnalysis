import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getStockDetails } from '@/lib/finmind-details';
import { parseStockId } from '@/lib/stock-id';

// 冷啟動時要對 FinMind 發出十多個請求
export const maxDuration = 60;

// GET /api/stocks/details?id=2330.TW → 估值、籌碼延伸、基本面延伸、股利（抓不到的區塊為 null）
export async function GET(request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const stockId = parseStockId(new URL(request.url).searchParams.get('id'));
  if (!stockId) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  try {
    return NextResponse.json(await getStockDetails(stockId));
  } catch (err) {
    console.error('[api/stocks/details] 讀取快取失敗', err);
    return NextResponse.json({ error: 'db_unavailable' }, { status: 503 });
  }
}
