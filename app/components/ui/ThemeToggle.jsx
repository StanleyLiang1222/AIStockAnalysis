'use client';

import { Icon } from '@/app/components/ui/Icon';
import { THEME_OPTIONS } from '@/lib/theme-mode';
import { useTheme } from '@/app/components/ui/theme';

const LABELS = {
  system: { icon: 'monitor', text: '跟隨系統' },
  light: { icon: 'sun', text: '淺色' },
  dark: { icon: 'moon', text: '深色' },
};

/**
 * 深淺色切換按鈕：每按一下依序切換 跟隨系統 → 淺色 → 深色。手機寬度只顯示圖示。
 */
export function ThemeToggle({ className = '' }) {
  const { preference, change } = useTheme();
  const next = THEME_OPTIONS[(THEME_OPTIONS.indexOf(preference) + 1) % THEME_OPTIONS.length];
  const { icon, text } = LABELS[preference];

  return (
    <button
      onClick={() => change(next)}
      aria-label={`外觀：${text}（點擊切換為${LABELS[next].text}）`}
      title={`外觀：${text}`}
      className={'px-2 lg:px-3 py-1.5 rounded-lg border-2 flex items-center gap-1.5 font-black transition-all bg-surface-raised border-line-strong text-fg-faint hover:text-fg ' + className}
    >
      <Icon name={icon} className="w-3.5 h-3.5" />
      <span className="hidden lg:inline">{text}</span>
    </button>
  );
}
