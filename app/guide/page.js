import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { GuideView } from '@/app/components/guide/GuideView';

export const metadata = {
  title: 'K 線型態圖典｜股票投資分析',
};

export default async function GuidePage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  return <GuideView />;
}
