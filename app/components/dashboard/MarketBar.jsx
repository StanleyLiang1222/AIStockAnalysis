import { formatPrice, getTrendColors } from '@/lib/format';

const signed = (v, digits = 1) => `${v > 0 ? '+' : ''}${v.toFixed(digits)}`;

function Item({ label, children }) {
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-fg-faint">{label}</span>
      {children}
    </div>
  );
}

function Amount({ value }) {
  if (value == null) return <span className="text-fg-dim">—</span>;
  return <span className={'font-mono ' + getTrendColors(value).text}>{signed(value)}億</span>;
}

/**
 * 頁首下方的大盤資訊列：加權指數、大盤三大法人買賣超、融資餘額增減。
 * 窄螢幕放不下時可以左右滑動。
 */
export function MarketBar({ market, loading }) {
  const { taiex, institutional, margin } = market ?? {};
  // 盤中加權指數是即時的，法人與融資仍是盤後資料，日期以盤後資料為準
  const date = institutional?.date ?? margin?.date ?? (taiex?.liveTime ? null : taiex?.date);

  return (
    <div className="bg-surface border-b-2 border-line-subtle overflow-x-auto">
      <div className="px-4 lg:px-6 py-2 flex items-center gap-5 text-xs font-bold min-w-max">
        {loading && !market ? (
          <span className="text-fg-dim">大盤資訊載入中...</span>
        ) : !taiex && !institutional && !margin ? (
          <span className="text-fg-dim">大盤資訊暫時無法取得</span>
        ) : (
          <>
            <Item label="加權指數">
              {taiex ? (
                <>
                  <span className="font-mono font-black text-white">{formatPrice(taiex.close)}</span>
                  <span className={'font-mono ' + getTrendColors(taiex.change).text}>
                    {signed(taiex.change)}{taiex.changePercent != null && ` (${signed(taiex.changePercent, 2)}%)`}
                  </span>
                  {taiex.liveTime && (
                    <span className="text-fg-dim font-mono flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />即時 {taiex.liveTime}
                    </span>
                  )}
                </>
              ) : <span className="text-fg-dim">—</span>}
            </Item>
            <span className="w-px h-3 bg-line-strong" />
            <Item label="外資"><Amount value={institutional?.foreign} /></Item>
            <Item label="投信"><Amount value={institutional?.trust} /></Item>
            <Item label="自營商"><Amount value={institutional?.dealer} /></Item>
            <span className="w-px h-3 bg-line-strong" />
            <Item label="融資"><Amount value={margin?.change} /></Item>
            {date && <span className="text-fg-dim font-mono">盤後・資料日期 {date}</span>}
          </>
        )}
      </div>
    </div>
  );
}
