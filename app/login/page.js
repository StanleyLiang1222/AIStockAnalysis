import { auth, signIn } from '@/auth';
import { redirect } from 'next/navigation';

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect('/');
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-[#090a0c] px-4">
      <div className="bg-[#111315] border-2 border-[#22252a] rounded-2xl p-8 w-full max-w-sm text-center space-y-5">
        <div className="w-12 h-12 bg-[#3e63dd] rounded-xl flex items-center justify-center mx-auto shadow-lg shadow-[#3e63dd]/30">
          <span className="text-white font-black text-lg">K</span>
        </div>
        <div>
          <h1 className="text-lg font-black text-white">智慧籌碼K線</h1>
          <p className="text-xs text-[#9ba1a6] font-bold mt-1">請使用授權的 Google 帳號登入</p>
        </div>
        <form
          action={async () => {
            'use server';
            await signIn('google', { redirectTo: '/' });
          }}
        >
          <button
            type="submit"
            className="w-full py-2.5 bg-white text-[#1a1a1a] text-sm font-black rounded-lg hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
          >
            使用 Google 登入
          </button>
        </form>
      </div>
    </div>
  );
}
