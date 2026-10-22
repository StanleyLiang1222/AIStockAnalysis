import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getMarketSummary } from '@/lib/finmind-market';

// GET /api/market → { taiex, institutional, margin }（抓不到的項目為 null）
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.json(await getMarketSummary());
}
