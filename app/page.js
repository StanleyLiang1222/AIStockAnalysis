import { Suspense } from 'react';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Dashboard } from '@/app/components/dashboard/Dashboard';
import { LoadingScreen } from '@/app/components/dashboard/StatusScreen';

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  // Dashboard 用 useSearchParams 讀網址狀態，需包在 Suspense 裡
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Dashboard user={session.user} />
    </Suspense>
  );
}
