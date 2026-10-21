import { useState, useEffect, useRef } from 'react';
import { formatPrice } from '@/lib/format';
import { PriceVolumeTable } from './PriceVolumeTable';
import { colors } from '@/lib/theme';

/* =====================================================
   CandlestickChart - K 線 + 成交量 + 格線 + Tooltip
   ===================================================== */
export function CandlestickChart({ trendColors, candles = [] }) {
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

  const upColor = colors.up;
  const downColor = colors.down;

  const W = containerWidth;
  const H_CANDLE = 260;
  const H_VOL = 70;
  const SEP = 10;
  const H_XAXIS = 20;
  const H_TOTAL = H_CANDLE + SEP + H_VOL + H_XAXIS;
  const PAD_L = 62;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B_C = 6;

  const chartW = W - PAD_L - PAD_R;
  const n = candles.length;
  if (n === 0) return null;

  const priceMin = Math.min(...candles.map(c => c.low));
  const priceMax = Math.max(...candles.map(c => c.high));
  const priceRange = priceMax - priceMin || 1;
  const priceBuffer = priceRange * 0.05;

  const effectMin = priceMin - priceBuffer;
  const effectMax = priceMax + priceBuffer;
  const effectRange = effectMax - effectMin;

  const toY = (price) =>
    PAD_T + (H_CANDLE - PAD_T - PAD_B_C) * (1 - (price - effectMin) / effectRange);

  const volTop = H_CANDLE + SEP + 4;
  const volBottom = H_CANDLE + SEP + H_VOL - 4;
  const volMax = Math.max(...candles.map(c => c.volume), 1);
  const toVolH = (vol) => ((vol / volMax) * (volBottom - volTop));

  const candleSlot = n > 1 ? chartW / (n - 1) : chartW;
  const candleWidth = Math.max(2, Math.min(14, (chartW / n) * 0.6));

  const getX = (i) => n > 1 ? PAD_L + (i / (n - 1)) * chartW : PAD_L + chartW / 2;

  const GRID_COUNT = 5;
  const gridLines = Array.from({ length: GRID_COUNT }, (_, i) => {
    const frac = i / (GRID_COUNT - 1);
    const price = effectMax - frac * effectRange;
    const y = PAD_T + frac * (H_CANDLE - PAD_T - PAD_B_C);
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
    setTooltip({ candle: candles[idx], idx, x: getX(idx) });
  };

  const tableData = candles.slice(-12);

  return (
    <div className="flex flex-col w-full">
      <div ref={containerRef} className="w-full select-none">
        <svg ref={svgRef} width="100%" height={H_TOTAL}
          viewBox={'0 0 ' + W + ' ' + H_TOTAL}
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          // 觸控放開時保留 Tooltip，滑鼠移出才收起
          onPointerLeave={(e) => e.pointerType === "mouse" && setTooltip(null)}
          className="block cursor-crosshair touch-pan-y">

          <defs>
            <linearGradient id="cVGradUp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={upColor} stopOpacity="0.8" />
              <stop offset="100%" stopColor={upColor} stopOpacity="0.15" />
            </linearGradient>
            <linearGradient id="cVGradDown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={downColor} stopOpacity="0.8" />
              <stop offset="100%" stopColor={downColor} stopOpacity="0.15" />
            </linearGradient>
            <filter id="ttShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor="#000" floodOpacity="0.7" />
            </filter>
          </defs>

          <rect x={PAD_L} y={PAD_T} width={chartW} height={H_CANDLE - PAD_T - PAD_B_C} fill={colors.inset} rx="3" />

          {gridLines.map((g, i) => (
            <g key={i}>
              <line x1={PAD_L} y1={g.y} x2={PAD_L + chartW} y2={g.y}
                stroke={i === 0 || i === GRID_COUNT - 1 ? colors.line.DEFAULT : colors.line.subtle}
                strokeWidth="1"
                strokeDasharray={i === 0 || i === GRID_COUNT - 1 ? '' : '3,5'} />
              <text x={PAD_L - 5} y={g.y + 4} textAnchor="end"
                fill={colors.fg.dim} fontSize="10.5" fontFamily="'Courier New', monospace">
                {formatPrice(g.price)}
              </text>
            </g>
          ))}

          <line x1={PAD_L} y1={H_CANDLE + SEP / 2} x2={PAD_L + chartW} y2={H_CANDLE + SEP / 2}
            stroke={colors.line.DEFAULT} strokeWidth="1" />

          <rect x={PAD_L} y={H_CANDLE + SEP} width={chartW} height={H_VOL} fill={colors.canvas} rx="2" />

          {[0.5, 1].map((f, i) => {
            const vy = volBottom - f * (volBottom - volTop);
            return <line key={i} x1={PAD_L} y1={vy} x2={PAD_L + chartW} y2={vy} stroke={colors.surface.raised} strokeWidth="1" strokeDasharray="3,5" />;
          })}

          <text x={PAD_L - 5} y={volTop + 10} textAnchor="end" fill={colors.fg.dim} fontSize="9" fontFamily="'Courier New', monospace">{(volMax / 1000).toFixed(0)}K</text>
          <text x={PAD_L - 5} y={volBottom} textAnchor="end" fill={colors.fg.dim} fontSize="9" fontFamily="'Courier New', monospace">0</text>

          {candles.map((c, i) => {
            const cx = getX(i);
            const isUp = c.close >= c.open;
            const color = isUp ? upColor : downColor;
            const yO = toY(c.open);
            const yC = toY(c.close);
            const yH = toY(c.high);
            const yL = toY(c.low);
            const bodyTop = Math.min(yO, yC);
            const bodyH = Math.max(1.5, Math.abs(yC - yO));
            const vh = toVolH(c.volume);
            const vb = volBottom - vh;
            const isHov = tooltip && tooltip.idx === i;

            return (
              <g key={i}>
                {isHov && (
                  <rect x={cx - candleSlot / 2} y={PAD_T} width={candleSlot}
                    height={H_CANDLE - PAD_T - PAD_B_C} fill={colors.accent.DEFAULT} fillOpacity="0.07" />
                )}
                {isHov && (
                  <line x1={cx} y1={PAD_T} x2={cx} y2={H_CANDLE + SEP + H_VOL}
                    stroke={colors.accent.DEFAULT} strokeWidth="0.8" strokeDasharray="4,3" opacity="0.6" />
                )}
                <line x1={cx} y1={yH} x2={cx} y2={yL}
                  stroke={color} strokeWidth={isHov ? 2 : 1.2} />
                <rect x={cx - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyH}
                  fill={color} fillOpacity={isUp ? 1 : 0.85}
                  stroke={color} strokeWidth="0.4" rx="0.5" />
                <rect x={cx - candleWidth / 2} y={vb} width={candleWidth} height={Math.max(1, vh)}
                  fill={isUp ? 'url(#cVGradUp)' : 'url(#cVGradDown)'}
                  opacity={isHov ? 1 : 0.7} rx="1" />
              </g>
            );
          })}

          {timeLabels.map(({ i, time }) => (
            <text key={i} x={getX(i)} y={H_CANDLE + SEP + H_VOL + 14}
              textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fill={colors.fg.dim} fontSize="9.5"
              fontFamily="'Courier New', monospace">{time}</text>
          ))}

          {tooltip && (() => {
            const c = tooltip.candle;
            const isUp = c.close >= c.open;
            const col = isUp ? upColor : downColor;
            const TW = 138; const TH = 118;
            let tx = tooltip.x + 16;
            let ty = PAD_T + 8;
            if (tx + TW > W - PAD_R) tx = tooltip.x - TW - 12;
            if (ty + TH > H_CANDLE) ty = H_CANDLE - TH - 4;
            const rows = [
              { label: '開盤', val: formatPrice(c.open) },
              { label: '最高', val: formatPrice(c.high) },
              { label: '最低', val: formatPrice(c.low) },
              { label: '收盤', val: formatPrice(c.close) },
              { label: '成交量', val: (c.volume / 1000).toFixed(1) + 'K' },
            ];
            return (
              <g filter="url(#ttShadow)">
                <rect x={tx} y={ty} width={TW} height={TH} rx="7" fill={colors.surface.raised} stroke={colors.line.strong} strokeWidth="1.5" />
                <rect x={tx} y={ty} width={TW} height={20} rx="7" fill={col} fillOpacity="0.18" />
                <rect x={tx} y={ty + 13} width={TW} height={7} fill={col} fillOpacity="0.18" />
                <text x={tx + 10} y={ty + 14} fill={col} fontSize="11" fontWeight="bold" fontFamily="sans-serif">{c.time}</text>
                <text x={tx + TW - 10} y={ty + 14} textAnchor="end" fill={col} fontSize="10" fontFamily="sans-serif">{isUp ? '▲' : '▼'}</text>
                {rows.map((row, ri) => (
                  <g key={ri}>
                    <text x={tx + 10} y={ty + 32 + ri * 17} fill={colors.fg.faint} fontSize="10" fontFamily="sans-serif">{row.label}</text>
                    <text x={tx + TW - 10} y={ty + 32 + ri * 17} textAnchor="end"
                      fill={ri < 4 ? col : colors.fg.muted} fontSize="10.5" fontWeight="bold"
                      fontFamily="'Courier New', monospace">{row.val}</text>
                  </g>
                ))}
              </g>
            );
          })()}
        </svg>
      </div>

      <PriceVolumeTable candles={tableData} />
    </div>
  );
}
