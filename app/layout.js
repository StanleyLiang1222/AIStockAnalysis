import './globals.css';
import { THEME_SCRIPT } from '@/lib/theme-mode';

export const metadata = {
  title: '股票投資分析',
};

// <html> 的 light class 由 THEME_SCRIPT 在渲染前加上，與伺服器輸出不同，因此關閉這一層的 hydration 警告
export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="bg-canvas text-fg antialiased">{children}</body>
    </html>
  );
}
