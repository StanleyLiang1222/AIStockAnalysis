import { formatPrice } from '@/lib/format';

/* =====================================================
   PriceVolumeTable - 走勢圖下方價量明細表（窄螢幕可左右捲動）
   ===================================================== */
export function PriceVolumeTable({ candles }) {
  return (
    <div className="mt-3 border-t-2 border-line-subtle pt-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-black text-fg-muted uppercase tracking-wider">近期價量明細</span>
        <span className="text-2xs text-fg-dim">最近 {candles.length} 根 K 棒</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line-subtle">
        <table className="w-full text-2xs border-collapse">
          <thead>
            <tr className="bg-inset">
              {['時間', '開盤', '最高', '最低', '收盤', '漲跌幅', '成交量(張)'].map(h => (
                <th key={h} className="py-2 px-3 text-left font-black whitespace-nowrap text-fg-dim border-b border-line-subtle">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...candles].reverse().map((c, i) => {
              const isUp = c.close >= c.open;
              const trendText = isUp ? 'text-up' : 'text-down';
              const diff = formatPrice(c.close - c.open);
              const diffPct = (((c.close - c.open) / c.open) * 100).toFixed(2);
              return (
                <tr key={i} className="border-b border-surface-raised hover:bg-surface-raised cursor-default">
                  <td className="py-2 px-3 font-mono whitespace-nowrap text-fg-dim">{c.time}</td>
                  <td className="py-2 px-3 font-mono text-fg-muted">{formatPrice(c.open)}</td>
                  <td className="py-2 px-3 font-mono font-bold text-up">{formatPrice(c.high)}</td>
                  <td className="py-2 px-3 font-mono font-bold text-down">{formatPrice(c.low)}</td>
                  <td className={'py-2 px-3 font-mono font-black ' + trendText}>{formatPrice(c.close)}</td>
                  <td className={'py-2 px-3 font-mono font-black whitespace-nowrap ' + trendText}>
                    {isUp ? '+' : ''}{diff} ({isUp ? '+' : ''}{diffPct}%)
                  </td>
                  <td className="py-2 px-3 font-mono text-fg-faint">
                    {c.volume >= 10000 ? (c.volume / 1000).toFixed(1) + 'K' : c.volume.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
