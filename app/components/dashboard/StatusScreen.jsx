// 整頁置中的狀態畫面：載入中、錯誤、空清單

export function LoadingScreen() {
  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-canvas">
      <div className="text-center space-y-3">
        <span className="w-3 h-3 rounded-full bg-accent animate-ping inline-block" />
        <p className="text-xs text-fg-muted font-bold">載入自選清單中...</p>
      </div>
    </div>
  );
}

export function StatusCard({ title, titleClassName = 'text-white', message, actionLabel, onAction, children }) {
  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="bg-surface border-2 border-line rounded-2xl p-8 w-full max-w-sm text-center space-y-3">
        <h1 className={'text-lg font-black ' + titleClassName}>{title}</h1>
        <p className="text-xs text-fg-muted font-bold">{message}</p>
        <button
          onClick={onAction}
          className="mt-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-black rounded-lg transition-all"
        >
          {actionLabel}
        </button>
        {children}
      </div>
    </div>
  );
}

const ERRORS = {
  quote: { title: '無法取得股價', message: 'FinMind 股價資料暫時無法取得，請稍後再試。' },
  db: { title: '無法連線', message: '請確認 Supabase 是否有啟動。' },
};

export function ErrorScreen({ kind, onRetry }) {
  const { title, message } = ERRORS[kind] ?? ERRORS.db;
  return <StatusCard title={title} titleClassName="text-up" message={message} actionLabel="重試" onAction={onRetry} />;
}
