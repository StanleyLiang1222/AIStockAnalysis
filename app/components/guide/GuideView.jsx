import Link from 'next/link';
import { AppLogo } from '@/app/components/dashboard/AppHeader';
import { MobileTabBar } from '@/app/components/dashboard/MobileTabBar';
import { Icon } from '@/app/components/ui/Icon';
import { KlineGuide } from './KlineGuide';

// /guide 的版面（登入檢查在 app/guide/page.js）
export function GuideView() {
  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <header className="bg-surface border-b-2 border-line-subtle px-4 py-3 lg:px-6 lg:py-5 flex justify-between items-center gap-4">
        <AppLogo />
        <Link href="/" className="px-3 lg:px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 bg-line text-white border border-accent/20 shadow">
          <Icon name="activity" className="w-3.5 h-3.5 text-accent" /> 返回看盤
        </Link>
      </header>
      <main className="flex-1 w-full max-w-screen-2xl mx-auto px-4 pt-4 pb-20 lg:pb-4">
        <KlineGuide />
      </main>
      <MobileTabBar active="guide" />
    </div>
  );
}
