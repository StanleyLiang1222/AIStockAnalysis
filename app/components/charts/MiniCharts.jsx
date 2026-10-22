// 子分頁用的小型圖表。寬度隨容器縮放（viewBox 固定、preserveAspectRatio="none"），
// 線條用 vectorEffect="non-scaling-stroke" 避免拉伸後粗細不一。
import { colors } from '@/lib/theme';

const W = 300;

const extent = (values) => {
  const valid = values.filter((v) => v != null);
  return valid.length ? [Math.min(...valid), Math.max(...valid)] : [0, 1];
};

/**
 * 正負柱狀圖（漲紅跌綠，以 0 為基準）。用於每日買賣超、當沖比率等。
 * positiveColor 可覆寫正值顏色（例如營收這類非漲跌的數量）。
 */
export function BarSeries({ values, height = 48, positiveColor = colors.up, negativeColor = colors.down }) {
  const maxAbs = Math.max(...values.map((v) => Math.abs(v ?? 0)), 1);
  const hasNegative = values.some((v) => v < 0);
  const zeroY = hasNegative ? height / 2 : height;
  const scale = hasNegative ? height / 2 : height;
  const slot = W / values.length;
  const barW = Math.max(1, slot * 0.7);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="w-full block" style={{ height }}>
      {hasNegative && <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke={colors.line.strong} strokeWidth="1" vectorEffect="non-scaling-stroke" />}
      {values.map((v, i) => {
        if (!v) return null;
        const h = (Math.abs(v) / maxAbs) * scale;
        return (
          <rect key={i} x={i * slot + (slot - barW) / 2} y={v > 0 ? zeroY - h : zeroY} width={barW} height={Math.max(h, 1)}
            fill={v > 0 ? positiveColor : negativeColor} opacity="0.9" />
        );
      })}
    </svg>
  );
}

/**
 * 折線（不含座標軸），用於餘額、比率等趨勢。
 */
export function Sparkline({ values, height = 40, color = colors.accent.DEFAULT }) {
  const points = values.map((v, i) => (v == null ? null : [i, v])).filter(Boolean);
  if (points.length < 2) return null;
  const [min, max] = extent(values);
  const range = max - min || 1;
  const x = (i) => (values.length > 1 ? (i / (values.length - 1)) * W : W / 2);
  const y = (v) => 4 + (1 - (v - min) / range) * (height - 8);
  const d = points.map(([i, v], k) => `${k ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="w-full block" style={{ height }}>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * 近 3 年區間條：最低 ─ 中位數 ─ 最高，標出目前位置。
 */
export function RangeBar({ min, median, max, current }) {
  const range = max - min || 1;
  const pos = (v) => `${Math.min(100, Math.max(0, ((v - min) / range) * 100))}%`;
  return (
    <div className="pt-1">
      <div className="relative h-1.5 rounded-full bg-line-strong">
        <div className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-fg-muted" style={{ left: pos(median) }} />
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-accent border-2 border-surface" style={{ left: pos(current) }} />
      </div>
      <div className="flex justify-between text-3xs text-fg-dim font-mono mt-1.5">
        <span>低 {min}</span>
        <span>中 {median}</span>
        <span>高 {max}</span>
      </div>
    </div>
  );
}

/**
 * 柱狀（數量，左軸）＋ 折線（比率，右軸），用於月營收與 YoY。
 */
export function BarLineCombo({ bars, line, labels, height = 104 }) {
  const n = bars.length;
  const slot = W / n;
  const barW = slot * 0.6;
  const barMax = Math.max(...bars.map((b) => b ?? 0), 1);
  const [lineMin, lineMax] = extent(line);
  const lineRange = lineMax - lineMin || 1;
  const chartH = height;
  const lineY = (v) => 6 + (1 - (v - lineMin) / lineRange) * (chartH - 12);
  const linePoints = line.map((v, i) => (v == null ? null : [i * slot + slot / 2, lineY(v)])).filter(Boolean);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="w-full block" style={{ height }}>
        {bars.map((b, i) => {
          const h = ((b ?? 0) / barMax) * (chartH - 4);
          return <rect key={i} x={i * slot + (slot - barW) / 2} y={chartH - h} width={barW} height={h} fill={colors.accent.DEFAULT} opacity="0.55" />;
        })}
        {linePoints.length > 1 && (
          <path d={linePoints.map(([x, y], k) => `${k ? 'L' : 'M'}${x},${y}`).join(' ')} fill="none" stroke={colors.warn} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      <AxisLabels labels={labels} />
    </div>
  );
}

/**
 * 多條折線（共用座標），用於毛利率、營益率、淨利率。
 */
export function MultiLine({ series, labels, height = 94 }) {
  const all = series.flatMap((s) => s.values);
  const [min, max] = extent(all);
  const range = max - min || 1;
  const n = labels.length;
  const chartH = height;
  const slot = W / n;
  // 點落在每一欄的中央，與下方標籤對齊
  const x = (i) => i * slot + slot / 2;
  const y = (v) => 6 + (1 - (v - min) / range) * (chartH - 12);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="w-full block" style={{ height }}>
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
          if (pts.length < 2) return null;
          return <path key={s.label} d={pts.map(([px, py], k) => `${k ? 'L' : 'M'}${px},${py}`).join(' ')} fill="none" stroke={s.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
      <AxisLabels labels={labels} />
    </div>
  );
}

/**
 * 圖表下方的欄位標籤（HTML，不放在 SVG 裡以免被 preserveAspectRatio="none" 拉伸變形）。
 * 每欄等寬，對齊上方的柱子或折線點；標籤太多時隔一個顯示，最後一個一定顯示。
 */
function AxisLabels({ labels }) {
  const n = labels.length;
  const step = n > 6 ? 2 : 1;
  return (
    <div className="grid mt-1" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      {labels.map((label, i) => (
        <span key={i} className="text-3xs text-fg-dim font-mono text-center whitespace-nowrap overflow-visible">
          {(n - 1 - i) % step === 0 ? label : ''}
        </span>
      ))}
    </div>
  );
}
