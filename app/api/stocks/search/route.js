import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { searchStocks } from '@/lib/finmind';

// GET /api/stocks/search?q=長榮 → { results: [{ id: '2603.TW', name, category, market }] }
export async function GET(request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const query = (new URL(request.url).searchParams.get('q') ?? '').trim();
  if (!query || query.length > 20) {
    return NextResponse.json({ results: [] });
  }

  try {
    return NextResponse.json({ results: await searchStocks(query) });
  } catch (err) {
    console.error('[api/stocks/search] 搜尋失敗', err);
    return NextResponse.json({ error: 'search_unavailable' }, { status: 503 });
  }
}
