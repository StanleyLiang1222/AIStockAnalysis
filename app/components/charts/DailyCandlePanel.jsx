import { formatPrice, getTrendColors } from '@/lib/format';
import { KlineDetailIcon } from './KlineDetailIcon';

/**
 * 1D：當日單根 K 棒（真實開高低收，以導引線標註價格）＋漲跌、漲跌幅、成交量。
 * 免費方案沒有盤中分 K，所以不畫盤中走勢。
 */
export function DailyCandlePanel({ candle, prevClose }) {
  if (!candle) return null;
  const { open, high, low, close, volume, time } = candle;

  // 價格映射到 y 座標 15（最高）～ 135（最低）；一字線（高低相同）置中
  const range = high - low;
  const toY = (price) => (range > 0 ? 15 + ((high - price) / range) * 120 : 75);
  const type = close > open ? 'up' : close < open ? 'down' : 'cross';

  const change = prevClose != null ? close - prevClose : null;
  const changePercent = change != null && prevClose > 0 ? (change / prevClose) * 100 : null;
  const trend = getTrendColors(change ?? 0);
  const sign = change > 0 ? '+' : '';

  return (
    <div className="flex flex-col items-center py-4">
      <span className="text-xs text-fg-muted font-bold font-mono mb-3">{time}</span>
      <KlineDetailIcon
        type={type}
        high={toY(high)}
        open={toY(open)}
        close={toY(close)}
        low={toY(low)}
        prices={{ open, high, low, close }}
      />
      <div className="grid grid-cols-3 gap-6 mt-4 text-center">
        <div>
          <div className="text-2xs text-fg-muted font-bold">漲跌</div>
          <div className={'text-sm font-mono ' + trend.text}>{change != null ? sign + formatPrice(change) : '—'}</div>
        </div>
        <div>
          <div className="text-2xs text-fg-muted font-bold">漲跌幅</div>
          <div className={'text-sm font-mono ' + trend.text}>{changePercent != null ? sign + changePercent.toFixed(2) + '%' : '—'}</div>
        </div>
        <div>
          <div className="text-2xs text-fg-muted font-bold">成交量（張）</div>
          <div className="text-sm font-mono font-black text-white">{volume.toLocaleString('en-US')}</div>
        </div>
      </div>
    </div>
  );
}
