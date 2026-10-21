import './globals.css';

export const metadata = {
  title: '股票投資分析',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <body className="bg-canvas text-fg antialiased">{children}</body>
    </html>
  );
}
