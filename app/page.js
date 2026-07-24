import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import StockApp from '@/app/components/StockApp';

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  return <StockApp user={session.user} />;
}
