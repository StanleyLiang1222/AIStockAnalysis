import { colors } from '@/lib/theme';

// 價格最多顯示到小數 2 位：ETF 與低價股的跳動單位是 0.01，只顯示 1 位會失真
export const formatPrice = (value) => value.toLocaleString('en-US', { maximumFractionDigits: 2 });

// 依漲跌回傳台股配色（漲紅跌綠）的 class 與色碼
export const getTrendColors = (value) => {
  const isPositive = value >= 0;
  return {
    text: isPositive ? 'text-up font-black' : 'text-down font-black',
    bg: isPositive ? 'bg-up/20' : 'bg-down/20',
    solidBg: isPositive ? 'bg-up' : 'bg-down',
    border: isPositive ? 'border-up/50' : 'border-down/50',
    iconColor: isPositive ? colors.up : colors.down,
  };
};
