import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getWatchlist, addToWatchlist, removeFromWatchlist } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const watchlist = await getWatchlist(session.user.email);
  return NextResponse.json({ watchlist });
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { stockId } = await request.json();
  if (!stockId || typeof stockId !== 'string') {
    return NextResponse.json({ error: 'stockId is required' }, { status: 400 });
  }
  await addToWatchlist(session.user.email, stockId.trim());
  const watchlist = await getWatchlist(session.user.email);
  return NextResponse.json({ watchlist });
}

export async function DELETE(request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const stockId = searchParams.get('stockId');
  if (!stockId) {
    return NextResponse.json({ error: 'stockId is required' }, { status: 400 });
  }
  await removeFromWatchlist(session.user.email, stockId);
  const watchlist = await getWatchlist(session.user.email);
  return NextResponse.json({ watchlist });
}
