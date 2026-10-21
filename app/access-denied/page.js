const REASONS = {
  'db-down': {
    title: '無法連線',
    message: '請確認 Supabase 是否有啟動。',
  },
  'not-whitelisted': {
    title: '存取被拒',
    message: '請與管理者申請白名單，再使用 Google 帳號登入。',
  },
};

export default async function AccessDeniedPage({ searchParams }) {
  const { reason } = await searchParams;
  const { title, message } = REASONS[reason] || REASONS['not-whitelisted'];

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="bg-surface border-2 border-line rounded-2xl p-8 w-full max-w-sm text-center space-y-3">
        <h1 className="text-lg font-black text-up">{title}</h1>
        <p className="text-xs text-fg-muted font-bold">{message}</p>
        <a href="/login" className="inline-block mt-2 text-xs text-accent font-black hover:underline">
          返回登入頁
        </a>
      </div>
    </div>
  );
}
