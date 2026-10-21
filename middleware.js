import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

// 只用 edge-safe 設定（不含 Google provider / 資料庫查詢），middleware 跑在 Edge runtime
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // 頁面一律需要先登入。API 不經過 middleware：route handler 自己檢查 session 並回 401 JSON，
  // 否則 fetch 會被 307 導到 /login、拿到 HTML，前端無法分辨是 session 過期還是伺服器錯誤。
  matcher: ['/((?!api|login|access-denied|_next/static|_next/image|favicon.ico).*)'],
};
