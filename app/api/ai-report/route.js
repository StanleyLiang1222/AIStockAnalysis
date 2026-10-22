import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getStocks } from '@/lib/finmind';
import { getStockDetails } from '@/lib/finmind-details';
import { getMarketSummary } from '@/lib/finmind-market';
import { buildReportInput, generateReport } from '@/lib/ai-report';
import { claimAiReport, getAiReport, releaseAiReport, saveAiReport } from '@/lib/db';
import { parseStockId } from '@/lib/stock-id';

// 抓資料 + AI 產生報告（effort low 約 20–60 秒）
export const maxDuration = 120;

const unauthorized = () => NextResponse.json({ error: 'unauthorized' }, { status: 401 });

// 報告以「最新一筆日 K 的交易日」為版本；回傳 { stock, dataDate } 或錯誤回應
async function resolveStock(stockId) {
  const [result] = await getStocks([stockId]);
  if (!result.ok) {
    const status = result.error === 'not_found' ? 404 : 503;
    return { error: NextResponse.json({ error: result.error }, { status }) };
  }
  return { result };
}

const toResponse = (dataDate, row) => NextResponse.json({
  dataDate,
  status: row?.status ?? 'none',
  report: row?.status === 'ready' ? row.report : null,
  createdAt: row?.status === 'ready' ? row.createdAt : null,
});

// GET /api/ai-report?id=2330.TW → { dataDate, status: 'none' | 'generating' | 'ready', report, createdAt }
export async function GET(request) {
  const session = await auth();
  if (!session?.user?.email) return unauthorized();

  const stockId = parseStockId(new URL(request.url).searchParams.get('id'));
  if (!stockId) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });

  try {
    const { result, error } = await resolveStock(stockId);
    if (error) return error;
    return toResponse(result.dataDate, await getAiReport(stockId, result.dataDate));
  } catch (err) {
    console.error('[api/ai-report] 讀取失敗', err);
    return NextResponse.json({ error: 'db_unavailable' }, { status: 503 });
  }
}

// POST /api/ai-report { stockId } → 產生報告。已有報告直接回傳；別人正在產生時回 202 { status: 'generating' }
export async function POST(request) {
  const session = await auth();
  if (!session?.user?.email) return unauthorized();

  const body = await request.json().catch(() => null);
  const stockId = parseStockId(body?.stockId);
  if (!stockId) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[api/ai-report] 未設定 ANTHROPIC_API_KEY');
    return NextResponse.json({ error: 'ai_not_configured' }, { status: 503 });
  }

  let resolved;
  try {
    resolved = await resolveStock(stockId);
    if (resolved.error) return resolved.error;
    const { dataDate } = resolved.result;
    const existing = await getAiReport(stockId, dataDate);
    if (existing?.status === 'ready') return toResponse(dataDate, existing);
    if (!(await claimAiReport(stockId, dataDate))) {
      return NextResponse.json({ dataDate, status: 'generating', report: null, createdAt: null }, { status: 202 });
    }
  } catch (err) {
    console.error('[api/ai-report] 讀取失敗', err);
    return NextResponse.json({ error: 'db_unavailable' }, { status: 503 });
  }

  const { result } = resolved;
  try {
    const [details, market] = await Promise.all([getStockDetails(stockId), getMarketSummary()]);
    const generated = await generateReport(buildReportInput(result, details, market));
    await saveAiReport(stockId, result.dataDate, generated);
    console.info(`[api/ai-report] ${stockId} ${result.dataDate} 產生完成（${generated.model}，輸入 ${generated.inputTokens}／輸出 ${generated.outputTokens} tokens）`);
    return toResponse(result.dataDate, await getAiReport(stockId, result.dataDate));
  } catch (err) {
    console.error(`[api/ai-report] ${stockId} 產生失敗`, err);
    await releaseAiReport(stockId, result.dataDate).catch((releaseErr) => {
      console.error('[api/ai-report] 釋放鎖失敗', releaseErr);
    });
    return NextResponse.json({ error: 'generation_failed' }, { status: 502 });
  }
}
