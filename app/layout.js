import './globals.css';

export const metadata = {
  title: '股票投資分析',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <body className="bg-[#0c0d0e] text-[#eeeeef] antialiased">{children}</body>
    </html>
  );
}
