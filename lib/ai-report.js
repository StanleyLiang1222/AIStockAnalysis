// AI 多空健檢：把個股的真實資料整理成精簡的輸入，呼叫 Claude 產生固定格式（JSON）的報告。
// 只能在伺服器端使用：ANTHROPIC_API_KEY 不可進到前端。
import Anthropic from '@anthropic-ai/sdk';
import { computeTechnicals } from '@/lib/technicals';

export const AI_MODEL = 'claude-opus-5-5';

export const STANCES = ['偏多', '中性', '偏空'];
export const FACET_STANCES = [...STANCES, '資料不足'];
export const FACETS = ['valuation', 'chips', 'fundamentals', 'dividends', 'technical', 'market'];

const facetSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['stance', 'points'],
  properties: {
    stance: { type: 'string', enum: FACET_STANCES },
    points: { type: 'array', items: { type: 'string' } },
  },
};

const REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['overall', 'facets', 'risks'],
  properties: {
    overall: {
      type: 'object',
      additionalProperties: false,
      required: ['stance', 'summary'],
      properties: {
        stance: { type: 'string', enum: STANCES },
        summary: { type: 'string' },
      },
    },
    facets: {
      type: 'object',
      additionalProperties: false,
      required: FACETS,
      properties: Object.fromEntries(FACETS.map((key) => [key, facetSchema])),
    },
    risks: { type: 'array', items: { type: 'string' } },
  },
};

const SYSTEM_PROMPT = `你是台股資料解讀助理，替一個私人自選股儀表板撰寫「多空健檢報告」。使用者會提供一檔股票的結構化資料（JSON），你依資料判斷各面向目前偏多、中性或偏空。

輸出欄位：
- overall.stance：綜合各面向的總評；overall.summary：一句話說明理由（40 字以內）。
- facets：六個面向，各自給 stance 與 2–3 個 points。
  - valuation 估值：本益比、淨值比、殖利率在近 3 年區間的位置（percentile 為百分位，越低代表越便宜）。
  - chips 籌碼：三大法人近 20 日買賣超與連續天數、融資融券、外資持股、借券賣出、當沖比率。
  - fundamentals 基本面：EPS、ROE、月營收 YoY／MoM 趨勢、近 8 季利潤率、自由現金流。
  - dividends 股利：近一年現金股利、殖利率、近年填息狀況、即將除息。
  - technical 技術面：5／20／60 日漲跌幅、與 20／60 日均線的距離、近 20 日相對 60 日均量的倍數、與 52 週高低點的距離。
  - market 大盤：加權指數漲跌、大盤三大法人買賣超、融資餘額增減。
- risks：1–3 點風險或彼此矛盾的訊號（例如股價創高但外資連賣）。

規則：
1. 只能引用輸入資料裡出現的數字，不可自行推算新的數字或補上外部資訊；引用時寫出具體數值與單位。
2. 某面向的資料為 null 或缺漏到無法判斷時，該面向 stance 填「資料不足」，points 說明缺少什麼即可。ETF 沒有本益比、財報、營收是正常情況。
3. 只描述資料呈現的多空傾向。不得出現買進、賣出、加碼、減碼、停損、目標價等操作建議。
4. 使用台灣慣用的繁體中文與台股術語（例如：外資、投信、自營商、買超、賣超、融資、融券、填息、均線）。
5. 每個 point 一句話，30 字左右，不要用 Markdown 語法。`;

const sum = (values) => values.reduce((total, v) => total + v, 0);
const lastOf = (series) => series?.[series.length - 1];

/**
 * 把 getStocks 與 getStockDetails、getMarketSummary 的結果整理成 AI 的輸入。
 * 圖表用的逐日序列只留下摘要，壓低 token 用量。
 */
export function buildReportInput({ stock, candles, dataDate }, details, market) {
  const { valuation, institutional, margin, foreignHolding, sbl, dayTrading, revenueTrend, profitability, cashflow, dividends } = details;
  const series = institutional?.series ?? [];
  return {
    stock: { id: stock.id, name: stock.name, category: stock.category, dataDate, close: stock.price, changePercent: stock.changePercent },
    technical: computeTechnicals(candles),
    valuation: valuation && { date: valuation.date, per: valuation.per, pbr: valuation.pbr, dividendYield: valuation.dividendYield },
    chips: {
      latestDayLots: stock.chips,
      institutional20d: institutional && {
        days: series.length,
        foreignNetLots: sum(series.map((d) => d.foreign)),
        trustNetLots: sum(series.map((d) => d.trust)),
        dealerNetLots: sum(series.map((d) => d.dealer)),
        foreignStreak: institutional.foreignStreak,
        trustStreak: institutional.trustStreak,
      },
      margin: margin && {
        marginBalanceLots: lastOf(margin.series)?.margin,
        shortBalanceLots: lastOf(margin.series)?.short,
        marginChange20dPercent: margin.marginChange,
        shortMarginRatioPercent: margin.shortMarginRatio,
      },
      foreignHolding: foreignHolding && { ratioPercent: lastOf(foreignHolding.series)?.ratio, change20dPoints: foreignHolding.change },
      sbl: sbl && { balanceLots: lastOf(sbl.series)?.balance, change20dPercent: sbl.change },
      dayTrading: dayTrading && { latestPercent: dayTrading.latest, average20dPercent: dayTrading.average },
    },
    fundamentals: {
      eps: stock.eps,
      epsPeriod: stock.epsPeriod,
      roeTTMPercent: stock.roe,
      revenue: revenueTrend && {
        latest: revenueTrend.latest,
        last12MonthsYoYPercent: revenueTrend.months.map((m) => ({ period: m.period, yoy: m.yoy })),
      },
      quarterlyMarginsPercent: profitability?.quarters ?? null,
      freeCashFlow: cashflow && (cashflow.notApplicable
        ? { notApplicable: '金融業不適用自由現金流' }
        : { unit: '億', quarters: cashflow.quarters, ttm: cashflow.fcfTTM }),
    },
    dividends: dividends && {
      lastYearCash: dividends.lastYearCash,
      upcoming: dividends.upcoming,
      recentEvents: dividends.events.slice(0, 4),
    },
    market: { unit: '法人與融資為億元', ...market },
  };
}

let client;
const getClient = () => (client ??= new Anthropic());

/**
 * 呼叫 Claude 產生報告。回傳 { report, model, inputTokens, outputTokens }；失敗時丟出錯誤。
 * 開啟伺服器端 fallback：模型因安全分類拒答時，由 API 自動改用其他模型完成這次請求。
 */
export async function generateReport(input) {
  const response = await getClient().beta.messages.create({
    model: AI_MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: REPORT_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  });

  if (response.stop_reason !== 'end_turn') {
    throw new Error(`AI 回應未完成（stop_reason: ${response.stop_reason}）`);
  }
  const text = response.content.find((block) => block.type === 'text')?.text;
  if (!text) throw new Error('AI 回應沒有內容');
  return {
    report: JSON.parse(text),
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
