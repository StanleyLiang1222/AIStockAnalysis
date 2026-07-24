export default function AccessDeniedPage() {
  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-[#090a0c] px-4">
      <div className="bg-[#111315] border-2 border-[#22252a] rounded-2xl p-8 w-full max-w-sm text-center space-y-3">
        <h1 className="text-lg font-black text-[#ff453a]">存取被拒</h1>
        <p className="text-xs text-[#9ba1a6] font-bold">
          您的 Google 帳號不在允許存取的白名單中，請聯絡管理員新增權限。
        </p>
        <a href="/login" className="inline-block mt-2 text-xs text-[#3e63dd] font-black hover:underline">
          返回登入頁
        </a>
      </div>
    </div>
  );
}
