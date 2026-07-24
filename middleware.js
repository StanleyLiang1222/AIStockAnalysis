import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

// 只用 edge-safe 設定（不含 Google provider / 資料庫查詢），middleware 跑在 Edge runtime
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // 除了登入相關路由與靜態資源以外，其餘所有路徑都需要先登入
  matcher: ['/((?!api/auth|login|access-denied|_next/static|_next/image|favicon.ico).*)'],
};
