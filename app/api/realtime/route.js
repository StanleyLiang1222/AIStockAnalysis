import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getRealtimeQuotes } from '@/lib/twse-realtime';
import { parseStockId } from '@/lib/stock-id';

const MAX_IDS = 50;

// GET /api/realtime?ids=2330.TW,2317.TW → { index, quotes: { '2330.TW': quote } }
// 只回傳今天的即時行情（盤後、假日為空）；證交所抓不到時也回傳空結果，畫面維持盤後資料
export async function GET(request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const parsed = (new URL(request.url).searchParams.get('ids') ?? '')
    .split(',')
    .filter(Boolean)
    .map(parseStockId);
  if (parsed.length > MAX_IDS || parsed.includes(null)) {
    return NextResponse.json({ error: 'invalid_ids' }, { status: 400 });
  }

  return NextResponse.json(await getRealtimeQuotes([...new Set(parsed)]));
}
