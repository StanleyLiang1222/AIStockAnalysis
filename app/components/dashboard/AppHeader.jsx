'use client';

import { signOut } from 'next-auth/react';
import { Icon } from '@/app/components/ui/Icon';

export function AppLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 lg:w-10 lg:h-10 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent/30">
        <Icon name="trendingUp" className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
      </div>
      <div>
        <h1 className="text-base lg:text-lg font-black tracking-wide text-white flex items-center gap-2">
          智慧籌碼K線 <span className="text-2xs lg:text-xs bg-accent text-white px-2 lg:px-2.5 py-0.5 rounded-full font-black border border-accent-soft">測試中...</span>
        </h1>
        <p className="hidden lg:block text-xs text-fg-muted font-bold mt-0.5">專為暗光環境優化的清晰視覺系統</p>
      </div>
    </div>
  );
}

/**
 * 頁首。手機寬度只保留 Logo、更新、登出（只顯示圖示），email 在 1024px 以上才顯示。
 */
export function AppHeader({ user, refreshing, onRefresh }) {
  return (
    <header className="bg-surface border-b-2 border-line-subtle px-4 py-3 lg:px-6 lg:py-5 flex justify-between items-center gap-4">
      <AppLogo />
      <div className="flex items-center gap-2 lg:gap-3 text-xs">
        <button
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="更新數據"
          className={'px-3 py-1.5 rounded-lg border-2 flex items-center gap-1.5 font-black transition-all '
            + (refreshing ? 'bg-accent/15 border-accent/50 text-accent' : 'bg-surface-raised border-line-strong text-fg-faint hover:text-white')}
        >
          <Icon name="refreshCw" className={'w-3.5 h-3.5 ' + (refreshing ? 'animate-spin' : '')} />
          <span className="hidden lg:inline">{refreshing ? '更新中' : '更新數據'}</span>
        </button>
        {user && (
          <div className="flex items-center gap-2 bg-surface-raised border-2 border-line-strong rounded-xl px-3 py-1.5">
            <span className="hidden lg:inline text-fg-muted font-bold max-w-36 truncate">{user.email}</span>
            <button onClick={() => signOut()} aria-label="登出" className="text-fg-faint hover:text-white flex items-center gap-1 font-black">
              <Icon name="logOut" className="w-3.5 h-3.5" /> <span className="hidden lg:inline">登出</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
