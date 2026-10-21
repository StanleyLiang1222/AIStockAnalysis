import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getStocks } from '@/lib/finmind';
import { parseStockId } from '@/lib/stock-id';

// 冷啟動且快取全空時，要對 FinMind 發出多個請求
export const maxDuration = 60;

const MAX_IDS = 50;

// GET /api/stocks?ids=2330.TW,2317.TW
// 必須登入：這支 API 用的是我們的 FinMind token，不能變成任何人都能耗用額度的公開代理
export async function GET(request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const parsed = (new URL(request.url).searchParams.get('ids') ?? '')
    .split(',')
    .filter(Boolean)
    .map(parseStockId);
  if (parsed.length === 0 || parsed.length > MAX_IDS || parsed.includes(null)) {
    return NextResponse.json({ error: 'invalid_ids' }, { status: 400 });
  }

  try {
    const results = await getStocks([...new Set(parsed)]);
    return NextResponse.json({ results });
  } catch (err) {
    console.error('[api/stocks] 讀取快取失敗', err);
    return NextResponse.json({ error: 'db_unavailable' }, { status: 503 });
  }
}
