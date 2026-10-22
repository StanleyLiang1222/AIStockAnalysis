'use client';

import { Icon } from '@/app/components/ui/Icon';
import { ChipsBarChart } from '@/app/components/charts/ChipsBarChart';
import { BarSeries, Sparkline, RangeBar, BarLineCombo, MultiLine } from '@/app/components/charts/MiniCharts';
import { getTrendColors } from '@/lib/format';
import { colors } from '@/lib/theme';
import { AiCard } from './AiReport';

export const VIEWS = [
  { key: 'overview', label: '總覽' },
  { key: 'chips', label: '籌碼' },
  { key: 'fundamentals', label: '基本面' },
  { key: 'dividends', label: '股利' },
  { key: 'ai', label: 'AI 健檢' },
];

const CARD = 'bg-surface border-2 border-line rounded-xl p-4';
const signed = (v, digits = 1) => `${v > 0 ? '+' : ''}${Number(v).toFixed(digits)}`;
const lots = (v) => `${v.toLocaleString('en-US')} 張`;

function Card({ title, icon, iconClass = 'text-accent', aside, children, className = '' }) {
  return (
    <div className={CARD + ' flex flex-col gap-3 ' + className}>
      <div className="flex justify-between items-center gap-2">
        <span className="text-xs font-black text-fg flex items-center gap-1.5">
          {icon && <Icon name={icon} className={'w-4 h-4 ' + iconClass} />} {title}
        </span>
        {aside}
      </div>
      {children}
    </div>
  );
}

// 區塊資料的三種狀態：載入中、抓不到、有資料
function Section({ status, data, emptyText = '資料暫時無法取得', children }) {
  if (data == null) {
    return <p className="text-xs text-fg-muted font-bold py-4 text-center">{status === 'loading' ? '載入中...' : emptyText}</p>;
  }
  return children(data);
}

function Metric({ label, value, sub, valueClass = 'text-fg', onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={'text-left ' + (onClick ? 'bg-surface-raised border-2 border-line-subtle hover:border-line-strong rounded-lg p-3 transition-all' : '')}>
      <div className="text-2xs text-fg-muted font-bold">{label}</div>
      <div className={'text-lg font-mono font-black mt-0.5 ' + valueClass}>{value}</div>
      {sub && <div className="text-2xs text-fg-dim font-bold mt-0.5">{sub}</div>}
    </Tag>
  );
}

const streakText = (streak) => {
  if (!streak?.direction) return { text: '無買賣', className: 'text-fg-muted' };
  // 台股配色：買超紅、賣超綠
  return streak.direction === 'buy'
    ? { text: `連續買超 ${streak.days} 天`, className: 'text-up' }
    : { text: `連續賣超 ${streak.days} 天`, className: 'text-down' };
};

export function ViewTabs({ view, onChange }) {
  return (
    <div className="flex bg-surface-raised p-1 rounded-lg border-2 border-line-strong text-xs">
      {VIEWS.map(v => (
        <button key={v.key} onClick={() => onChange(v.key)}
          className={'flex-1 px-3 py-1.5 rounded-md font-black transition-all ' + (view === v.key ? 'bg-line text-fg shadow' : 'text-fg-faint hover:text-fg')}>
          {v.label}
        </button>
      ))}
    </div>
  );
}

// ==================== 總覽 ====================

export function OverviewPanel({ stock, details, status, ai, onNavigate }) {
  const pending = status === 'loading' && !details ? '...' : '—';
  const { valuation, institutional, margin, revenueTrend, dividends } = details ?? {};
  const foreign = streakText(institutional?.foreignStreak);
  const latestDividend = dividends?.events[0];
  const yoy = revenueTrend?.latest.yoy ?? stock.yoy;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Metric label="本益比" onClick={() => onNavigate('fundamentals')}
        value={valuation?.per ? `${valuation.per.current} 倍` : pending}
        sub={valuation?.per?.percentile != null ? `近 3 年 ${valuation.per.percentile}% 位置` : null} />
      <Metric label="殖利率" onClick={() => onNavigate('fundamentals')}
        value={valuation?.dividendYield ? `${valuation.dividendYield.current}%` : pending}
        sub={valuation?.dividendYield?.estimated ? '依近一年配息估算'
          : valuation?.dividendYield?.percentile != null ? `近 3 年 ${valuation.dividendYield.percentile}% 位置` : null} />
      <Metric label="外資" onClick={() => onNavigate('chips')}
        value={institutional ? foreign.text : pending} valueClass={'text-sm ' + foreign.className} />
      <Metric label="融資（近 20 日）" onClick={() => onNavigate('chips')}
        value={margin?.marginChange != null ? `${signed(margin.marginChange)}%` : pending}
        sub={margin ? `${lots(margin.series[margin.series.length - 1].margin)}` : null} />
      <Metric label={`營收 YoY${revenueTrend ? `（${revenueTrend.latest.period}）` : ''}`} onClick={() => onNavigate('fundamentals')}
        value={yoy != null ? `${signed(yoy)}%` : pending}
        valueClass={yoy != null ? getTrendColors(yoy).text : 'text-fg'}
        sub={revenueTrend?.latest.mom != null ? `MoM ${signed(revenueTrend.latest.mom)}%` : null} />
      <Metric label={`EPS${stock.epsPeriod ? `（${stock.epsPeriod}）` : ''}`} onClick={() => onNavigate('fundamentals')}
        value={stock.eps != null ? `${stock.eps} 元` : '—'} />
      <Metric label={dividends?.upcoming ? '即將除息' : '最近一次配息'} onClick={() => onNavigate('dividends')}
        value={dividends?.upcoming ? `${dividends.upcoming.cash} 元`
          : latestDividend ? `${latestDividend.cash || latestDividend.stock} 元` : pending}
        sub={dividends?.upcoming ? dividends.upcoming.exDate
          : latestDividend ? (latestDividend.filled ? `第 ${latestDividend.fillDays} 天填息` : '尚未填息') : null} />
      <AiCard ai={ai} onNavigate={onNavigate} className="hidden lg:flex" />
    </div>
  );
}

// ==================== 籌碼 ====================

export function ChipsPanel({ stock, details, status }) {
  const { institutional, margin, foreignHolding, sbl, dayTrading } = details ?? {};
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card title="三大法人買賣超（張）" icon="barChart2" iconClass="text-violet" className="lg:col-span-2">
        <ChipsBarChart chips={stock.chips} />
        <Section status={status} data={institutional}>
          {(d) => (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-line-subtle">
              {[['外資', 'foreign', d.foreignStreak], ['投信', 'trust', d.trustStreak], ['自營商', 'dealer', null]].map(([label, field, s]) => {
                const st = s ? streakText(s) : null;
                return (
                  <div key={field}>
                    <div className="flex justify-between text-2xs font-bold mb-1">
                      <span className="text-fg-muted">{label}（近 {d.series.length} 日）</span>
                      {st && <span className={st.className}>{st.text}</span>}
                    </div>
                    <BarSeries values={d.series.map(x => x[field])} />
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      </Card>

      <Card title="融資融券" icon="activity">
        <Section status={status} data={margin}>
          {(d) => {
            const latest = d.series[d.series.length - 1];
            return (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Metric label="融資餘額" value={lots(latest.margin)} sub={d.marginChange != null ? `近 20 日 ${signed(d.marginChange)}%` : null} />
                  <Metric label="融券餘額" value={lots(latest.short)} />
                  <Metric label="券資比" value={d.shortMarginRatio != null ? `${d.shortMarginRatio}%` : '—'} />
                </div>
                <Sparkline values={d.series.map(x => x.margin)} />
              </>
            );
          }}
        </Section>
      </Card>

      <Card title="外資持股比率" icon="pieChart">
        <Section status={status} data={foreignHolding}>
          {(d) => (
            <>
              <Metric label="目前持股" value={`${d.series[d.series.length - 1].ratio}%`} sub={`近 20 日 ${signed(d.change, 2)} 個百分點`} />
              <Sparkline values={d.series.map(x => x.ratio)} />
            </>
          )}
        </Section>
      </Card>

      <Card title="借券賣出餘額" icon="trendingUp">
        <Section status={status} data={sbl}>
          {(d) => (
            <>
              <Metric label="目前餘額" value={lots(d.series[d.series.length - 1].balance)} sub={d.change != null ? `近 20 日 ${signed(d.change)}%` : null} />
              <Sparkline values={d.series.map(x => x.balance)} color={colors.warn} />
            </>
          )}
        </Section>
      </Card>

      <Card title="當沖比率" icon="refreshCw">
        <Section status={status} data={dayTrading}>
          {(d) => (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Metric label="最新" value={`${d.latest}%`} />
                <Metric label="近 20 日平均" value={`${d.average}%`} />
              </div>
              <BarSeries values={d.series.map(x => x.ratio)} positiveColor={colors.accent.DEFAULT} />
            </>
          )}
        </Section>
      </Card>
    </div>
  );
}

// ==================== 基本面 ====================

function ValuationRow({ label, stat, unit, emptyText }) {
  return (
    <div>
      <div className="flex justify-between items-baseline">
        <span className="text-2xs text-fg-muted font-bold">{label}</span>
        <span className="text-sm font-mono font-black text-fg">{stat ? `${stat.current}${unit}` : '—'}</span>
      </div>
      {stat?.percentile != null ? (
        <>
          <RangeBar min={stat.min} median={stat.median} max={stat.max} current={stat.current} />
          <div className="text-2xs text-fg-muted font-bold mt-1">位於近 3 年的 {stat.percentile}% 位置</div>
        </>
      ) : (
        <div className="text-2xs text-fg-dim font-bold mt-1">{stat?.estimated ? '依近一年現金股利 ÷ 目前股價估算，無歷史區間' : stat ? '歷史資料不足，無法計算區間' : emptyText}</div>
      )}
    </div>
  );
}

function Legend({ items }) {
  return (
    <div className="flex flex-wrap gap-3 text-2xs text-fg-muted font-bold">
      {items.map(([label, className]) => (
        <span key={label} className="flex items-center gap-1"><span className={'w-2 h-2 rounded-full ' + className} />{label}</span>
      ))}
    </div>
  );
}

export function FundamentalsPanel({ stock, details, status }) {
  const { valuation, revenueTrend, profitability, cashflow } = details ?? {};
  const latestQuarter = profitability?.quarters[profitability.quarters.length - 1];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card title="估值" icon="pieChart" iconClass="text-down" aside={valuation?.date && <span className="text-2xs text-fg-dim font-mono">{valuation.date}</span>}>
        <Section status={status} data={valuation}>
          {(d) => (
            <div className="space-y-4">
              <ValuationRow label="本益比" stat={d.per} unit=" 倍" emptyText="ETF 或虧損時無本益比" />
              <ValuationRow label="淨值比" stat={d.pbr} unit=" 倍" emptyText="ETF 無淨值比資料" />
              <ValuationRow label="殖利率" stat={d.dividendYield} unit="%" emptyText="近一年無現金股利" />
            </div>
          )}
        </Section>
      </Card>

      <Card title="核心指標" icon="activity">
        <div className="grid grid-cols-2 gap-3">
          <Metric label="EPS" value={stock.eps != null ? `${stock.eps} 元` : '—'} sub={stock.epsPeriod} />
          <Metric label="ROE" value={stock.roe != null ? `${stock.roe}%` : '—'} sub={stock.roe != null ? '近四季' : null} />
          <Metric label="營收 YoY" value={stock.yoy != null ? `${signed(stock.yoy)}%` : '—'}
            valueClass={stock.yoy != null ? getTrendColors(stock.yoy).text : 'text-fg'} sub={stock.yoyPeriod} />
          <Metric label="營收 MoM" value={revenueTrend?.latest.mom != null ? `${signed(revenueTrend.latest.mom)}%` : status === 'loading' && !details ? '...' : '—'}
            valueClass={revenueTrend?.latest.mom != null ? getTrendColors(revenueTrend.latest.mom).text : 'text-fg'} sub={revenueTrend?.latest.period} />
        </div>
      </Card>

      <Card title="月營收（近 12 個月）" icon="barChart2">
        <Section status={status} data={revenueTrend} emptyText="無月營收資料（ETF 等商品沒有營收）">
          {(d) => (
            <>
              <Legend items={[['營收（億）', 'bg-accent'], ['YoY %', 'bg-warn']]} />
              <BarLineCombo bars={d.months.map(m => m.revenue)} line={d.months.map(m => m.yoy)} labels={d.months.map(m => m.period.slice(5))} />
            </>
          )}
        </Section>
      </Card>

      <Card title="獲利能力（近 8 季）" icon="trendingUp">
        <Section status={status} data={profitability} emptyText="無財報資料（ETF 等商品沒有財報）">
          {(d) => (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Metric label="毛利率" value={latestQuarter?.grossMargin != null ? `${latestQuarter.grossMargin}%` : '—'} />
                <Metric label="營益率" value={latestQuarter?.operatingMargin != null ? `${latestQuarter.operatingMargin}%` : '—'} />
                <Metric label="淨利率" value={latestQuarter?.netMargin != null ? `${latestQuarter.netMargin}%` : '—'} />
              </div>
              <Legend items={[['毛利率', 'bg-accent'], ['營益率', 'bg-warn'], ['淨利率', 'bg-violet']]} />
              <MultiLine
                labels={d.quarters.map(q => q.period.slice(2))}
                series={[
                  { label: '毛利率', color: colors.accent.DEFAULT, values: d.quarters.map(q => q.grossMargin) },
                  { label: '營益率', color: colors.warn, values: d.quarters.map(q => q.operatingMargin) },
                  { label: '淨利率', color: colors.violet, values: d.quarters.map(q => q.netMargin) },
                ]}
              />
              <div>
                <div className="text-2xs text-fg-muted font-bold mb-1">每季 EPS（元）</div>
                <BarSeries values={d.quarters.map(q => q.eps)} positiveColor={colors.accent.DEFAULT} />
                <div className="grid mt-1 text-3xs text-fg-dim font-mono text-center" style={{ gridTemplateColumns: `repeat(${d.quarters.length}, minmax(0, 1fr))` }}>
                  {d.quarters.map(q => <span key={q.period}>{q.eps ?? '—'}</span>)}
                </div>
              </div>
            </>
          )}
        </Section>
      </Card>

      <Card title="自由現金流（近 4 季，億）" icon="refreshCw" className="lg:col-span-2">
        <Section status={status} data={cashflow} emptyText="無現金流量資料（ETF 等商品沒有財報）">
          {(d) => d.notApplicable ? (
            <p className="text-xs text-fg-muted font-bold py-2">金融業的營業現金流包含放款、存款等資金往來，自由現金流不適用。</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {d.quarters.map(q => (
                <Metric key={q.period} label={q.period} value={signed(q.fcf)} valueClass={getTrendColors(q.fcf).text}
                  sub={`營業 ${q.ocf}・資本支出 ${q.capex}`} />
              ))}
              <Metric label="近四季合計" value={d.fcfTTM != null ? signed(d.fcfTTM) : '—'}
                valueClass={d.fcfTTM != null ? getTrendColors(d.fcfTTM).text : 'text-fg'} />
            </div>
          )}
        </Section>
      </Card>
    </div>
  );
}

// ==================== 股利 ====================

export function DividendsPanel({ details, status }) {
  return (
    <Section status={status} data={details?.dividends}>
      {(d) => (
        <div className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className={CARD}><Metric label="近一年現金股利" value={`${d.lastYearCash} 元`} /></div>
            <div className={CARD}>
              {d.upcoming ? (
                <Metric label="即將除息" value={`${d.upcoming.cash} 元`} valueClass="text-warn"
                  sub={`除息日 ${d.upcoming.exDate}${d.upcoming.payDate ? `・發放日 ${d.upcoming.payDate}` : ''}`} />
              ) : (
                <Metric label="即將除息" value="尚未公告" valueClass="text-fg-muted text-sm" />
              )}
            </div>
          </div>

          <Card title={`近 ${d.events.length} 次配息`} icon="pieChart">
            {d.events.length === 0 ? (
              <p className="text-xs text-fg-muted font-bold py-4 text-center">近年沒有配息紀錄</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-line-subtle">
                <table className="w-full text-2xs border-collapse">
                  <thead>
                    <tr className="bg-inset">
                      {['除息日', '現金股利', '股票股利', '除息前股價', '填息'].map(h => (
                        <th key={h} className="py-2 px-3 text-left font-black whitespace-nowrap text-fg-dim border-b border-line-subtle">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.events.map(e => (
                      <tr key={e.exDate} className="border-b border-surface-raised hover:bg-surface-raised">
                        <td className="py-2 px-3 font-mono whitespace-nowrap text-fg-muted">{e.exDate}</td>
                        <td className="py-2 px-3 font-mono text-fg">{e.cash ? `${e.cash} 元` : '—'}</td>
                        <td className="py-2 px-3 font-mono text-fg">{e.stock ? `${e.stock} 元` : '—'}</td>
                        <td className="py-2 px-3 font-mono text-fg-muted">{e.beforePrice ?? '—'}</td>
                        <td className={'py-2 px-3 font-bold whitespace-nowrap ' + (e.filled ? 'text-up' : 'text-fg-muted')}>
                          {e.beforePrice == null ? '—' : e.filled ? `已填息（第 ${e.fillDays} 天）` : '尚未填息'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </Section>
  );
}
