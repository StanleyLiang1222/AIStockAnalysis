import { useState, useEffect, useRef } from 'react';
import { formatPrice } from '@/lib/format';
import { colors } from '@/lib/theme';

/* =====================================================
   LineChart - 折線走勢圖
   帶格線、Y軸標籤、漸層填滿、滑鼠 Tooltip
   ===================================================== */
export function LineChart({ trendColors, candles = [] }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [containerWidth, setContainerWidth] = useState(900);

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setContainerWidth(w);
      }
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const color = trendColors.iconColor;
  const n = candles.length;
  if (n === 0) return null;

  const W = containerWidth;
  const H = 300;
  const PAD_L = 58;
  const PAD_R = 12;
  const PAD_T = 14;
  const PAD_B = 28;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const values = candles.map(c => c.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const buffer = range * 0.08;
  const effectMin = min - buffer;
  const effectMax = max + buffer;
  const effectRange = effectMax - effectMin;

  const toX = (i) => n > 1 ? PAD_L + (i / (n - 1)) * chartW : PAD_L + chartW / 2;
  const toY = (v) => PAD_T + chartH * (1 - (v - effectMin) / effectRange);

  const linePts = candles.map((c, i) => toX(i) + ',' + toY(c.close)).join(' ');

  const fillPath = 'M ' + PAD_L + ',' + (PAD_T + chartH)
    + ' ' + candles.map((c, i) => 'L ' + toX(i) + ',' + toY(c.close)).join(' ')
    + ' L ' + (PAD_L + chartW) + ',' + (PAD_T + chartH) + ' Z';

  const GRID = 5;
  const gridLines = Array.from({ length: GRID }, (_, i) => {
    const frac = i / (GRID - 1);
    const price = effectMax - frac * effectRange;
    const y = PAD_T + frac * chartH;
    return { y, price };
  });

  // 每個日期標籤至少保留約 80px，窄螢幕自動減少標籤數
  const maxLabels = Math.min(10, n, Math.max(2, Math.floor(chartW / 80)));
  // 含最後一根在內共 maxLabels 個標籤，平均分配間距
  const labelStep = Math.max(1, Math.ceil((n - 1) / Math.max(1, maxLabels - 1)));
  const timeLabels = candles.map((c, i) => ({ i, time: c.time })).filter((_, i) => (i % labelStep === 0 && n - 1 - i >= labelStep / 2) || i === n - 1);

  const handlePointer = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left - PAD_L;
    const rawIdx = (mx / chartW) * (n - 1);
    const idx = Math.max(0, Math.min(n - 1, Math.round(rawIdx)));
    if (mx < -20 || mx > chartW + 20) { setTooltip(null); return; }
    setTooltip({ candle: candles[idx], idx, x: toX(idx), y: toY(candles[idx].close) });
  };

  const gradId = 'wsLineGrad_taiwan';

  return (
    <div ref={containerRef} className="w-full select-none">
      <svg ref={svgRef} width="100%" height={H}
        viewBox={'0 0 ' + W + ' ' + H}
        onPointerMove={handlePointer}
        onPointerDown={handlePointer}
        // 觸控放開時保留 Tooltip，滑鼠移出才收起
        onPointerLeave={(e) => e.pointerType === "mouse" && setTooltip(null)}
        className="block cursor-crosshair touch-pan-y">

        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="60%" stopColor={color} stopOpacity="0.10" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <filter id="wsLineShadow">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.65" />
          </filter>
        </defs>

        <rect x={PAD_L} y={PAD_T} width={chartW} height={chartH} fill={colors.inset} rx="3" />

        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={PAD_L} y1={g.y} x2={PAD_L + chartW} y2={g.y}
              stroke={i === 0 || i === GRID - 1 ? colors.line.DEFAULT : colors.line.subtle}
              strokeWidth="1"
              strokeDasharray={i === 0 || i === GRID - 1 ? '' : '3,5'} />
            <text x={PAD_L - 5} y={g.y + 4}
              textAnchor="end" fill={colors.fg.dim} fontSize="10.5"
              fontFamily="'Courier New', monospace">
              {formatPrice(g.price)}
            </text>
          </g>
        ))}

        <path d={fillPath} fill={'url(#' + gradId + ')'} />

        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={linePts}
        />

        {tooltip && (
          <g>
            <line x1={tooltip.x} y1={PAD_T} x2={tooltip.x} y2={PAD_T + chartH}
              stroke={color} strokeWidth="1" strokeDasharray="4,3" opacity="0.55" />
            <circle cx={tooltip.x} cy={tooltip.y} r="5"
              fill={color} stroke={colors.surface.DEFAULT} strokeWidth="2" />
            <circle cx={tooltip.x} cy={tooltip.y} r="9"
              fill={color} fillOpacity="0.15" />
          </g>
        )}

        {timeLabels.map(({ i, time }) => (
          <text key={i} x={toX(i)} y={H - 6}
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fill={colors.fg.dim} fontSize="9.5"
            fontFamily="'Courier New', monospace">{time}</text>
        ))}

        {tooltip && (() => {
          const c = tooltip.candle;
          const isUp = c.close >= c.open;
          const diff = formatPrice(c.close - c.open);
          const diffPct = (((c.close - c.open) / c.open) * 100).toFixed(2);
          const TW = 148; const TH = 78;
          let tx = tooltip.x + 16;
          let ty = tooltip.y - 20;
          if (tx + TW > W - PAD_R) tx = tooltip.x - TW - 12;
          if (ty < PAD_T) ty = PAD_T + 4;
          if (ty + TH > PAD_T + chartH) ty = PAD_T + chartH - TH - 4;
          return (
            <g filter="url(#wsLineShadow)">
              <rect x={tx} y={ty} width={TW} height={TH} rx="7" fill={colors.surface.raised} stroke={colors.line.strong} strokeWidth="1.5" />
              <rect x={tx} y={ty} width={TW} height={3} rx="2" fill={color} />
              <text x={tx + 10} y={ty + 18} fill={colors.fg.faint} fontSize="10" fontFamily="sans-serif">時間</text>
              <text x={tx + TW - 10} y={ty + 18} textAnchor="end" fill="white" fontSize="10" fontWeight="bold" fontFamily="'Courier New', monospace">{c.time}</text>
              <text x={tx + 10} y={ty + 36} fill={colors.fg.faint} fontSize="10" fontFamily="sans-serif">收盤</text>
              <text x={tx + TW - 10} y={ty + 36} textAnchor="end" fill={color} fontSize="11" fontWeight="bold" fontFamily="'Courier New', monospace">{formatPrice(c.close)}</text>
              <text x={tx + 10} y={ty + 54} fill={colors.fg.faint} fontSize="10" fontFamily="sans-serif">漲跌</text>
              <text x={tx + TW - 10} y={ty + 54} textAnchor="end" fill={color} fontSize="10.5" fontWeight="bold" fontFamily="'Courier New', monospace">
                {isUp ? '+' : ''}{diff} ({isUp ? '+' : ''}{diffPct}%)
              </text>
              <text x={tx + 10} y={ty + 70} fill={colors.fg.faint} fontSize="10" fontFamily="sans-serif">成交量</text>
              <text x={tx + TW - 10} y={ty + 70} textAnchor="end" fill={colors.fg.muted} fontSize="10" fontWeight="bold" fontFamily="'Courier New', monospace">
                {c.volume >= 10000 ? (c.volume / 1000).toFixed(1) + 'K' : c.volume.toLocaleString()}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
