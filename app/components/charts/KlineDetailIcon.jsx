import { formatPrice } from '@/lib/format';
import { colors } from '@/lib/theme';

/**
 * 精美標記影線/實體的 SVG K 線圖示元件
 * high / open / close / low 是 SVG 的 y 座標（數值越小越高）。
 * 傳入 prices（真實價格）時，導引線的標籤會附上價格，圖示也會加寬容納文字。
 */
export function KlineDetailIcon({ type, high, open, close, low, prices }) {
  const upColor = colors.up;
  const downColor = colors.down;
  const crossColor = colors.fg.muted;

  const width = prices ? 300 : 200;
  const cx = width / 2;
  const entityW = 22;

  let color = crossColor;
  if (type === 'up') color = upColor;
  if (type === 'down') color = downColor;

  // 每個標籤：文字、對應的 y 座標、對應的價格欄位
  let leftTop = null;
  let leftBottom = null;
  let rightTop = null;
  let rightBottom = null;

  if (type === 'up') {
    const hasUpperShadow = high < close;
    const hasLowerShadow = low > open;
    leftTop = { text: hasUpperShadow ? '收盤價' : '收盤/最高', y: close, key: 'close' };
    leftBottom = { text: hasLowerShadow ? '開盤價' : '開盤/最低', y: open, key: 'open' };
    if (hasUpperShadow) rightTop = { text: '最高價', y: high, key: 'high' };
    if (hasLowerShadow) rightBottom = { text: '最低價', y: low, key: 'low' };
  } else if (type === 'down') {
    const hasUpperShadow = high < open;
    const hasLowerShadow = low > close;
    leftTop = { text: hasUpperShadow ? '開盤價' : '開盤/最高', y: open, key: 'open' };
    leftBottom = { text: hasLowerShadow ? '收盤價' : '收盤/最低', y: close, key: 'close' };
    if (hasUpperShadow) rightTop = { text: '最高價', y: high, key: 'high' };
    if (hasLowerShadow) rightBottom = { text: '最低價', y: low, key: 'low' };
  } else {
    leftTop = { text: '開盤 = 收盤', y: open, key: 'close' };
    rightTop = { text: '最高價', y: high, key: 'high' };
    rightBottom = { text: '最低價', y: low, key: 'low' };
  }

  // 實體很短時開盤、收盤兩個標籤會疊在一起：文字至少錯開 12px，導引線仍指向真實位置
  if (leftTop && leftBottom && leftBottom.y - leftTop.y < 12) {
    const mid = (leftTop.y + leftBottom.y) / 2;
    leftTop.textY = mid - 6;
    leftBottom.textY = mid + 6;
  }

  const labelOf = (label) => (prices ? `${label.text} ${formatPrice(prices[label.key])}` : label.text);

  const renderLeft = (label) => label && (
    <g className="transition-all duration-300">
      <line x1={cx - 14} y1={label.y} x2={cx - 36} y2={label.y} stroke={colors.line.strong} strokeWidth="1" strokeDasharray="2,3" />
      <text x={cx - 42} y={(label.textY ?? label.y) + 3.5} textAnchor="end" fill={colors.fg.muted} fontSize="9.5" className="svg-indicator-text">{labelOf(label)}</text>
    </g>
  );
  const renderRight = (label) => label && (
    <g className="transition-all duration-300">
      <line x1={cx} y1={label.y} x2={cx + 36} y2={label.y} stroke={colors.line.strong} strokeWidth="1" strokeDasharray="2,3" />
      <text x={cx + 42} y={label.y + 3.5} textAnchor="start" fill={colors.fg.muted} fontSize="9.5" className="svg-indicator-text">{labelOf(label)}</text>
    </g>
  );

  return (
    <svg width={width} height="150" viewBox={`0 0 ${width} 150`} className="mx-auto overflow-visible select-none">
      <line x1={cx} y1={high} x2={cx} y2={low} stroke={color} strokeWidth="2.5" strokeLinecap="round" />

      {type === 'up' && (
        <rect x={cx - entityW / 2} y={close} width={entityW} height={Math.max(2, open - close)} fill={color} stroke={color} strokeWidth="1" rx="1.5" />
      )}
      {type === 'down' && (
        <rect x={cx - entityW / 2} y={open} width={entityW} height={Math.max(2, close - open)} fill={color} stroke={color} strokeWidth="1" rx="1.5" />
      )}
      {type === 'cross' && (
        <line x1={cx - 18} y1={open} x2={cx + 18} y2={open} stroke={color} strokeWidth="4" strokeLinecap="round" />
      )}

      {renderLeft(leftTop)}
      {renderLeft(leftBottom)}
      {renderRight(rightTop)}
      {renderRight(rightBottom)}
    </svg>
  );
}
