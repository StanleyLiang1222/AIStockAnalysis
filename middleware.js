export { auth as middleware } from '@/auth';

export const config = {
  // 除了登入相關路由與靜態資源以外，其餘所有路徑都需要先登入
  matcher: ['/((?!api/auth|login|access-denied|_next/static|_next/image|favicon.ico).*)'],
};
