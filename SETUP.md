# 部署設定（需要手動完成的步驟）

## 1. Google OAuth

1. 前往 [Google Cloud Console](https://console.cloud.google.com/) → 建立專案（若還沒有）
2. 「API 和服務」→「憑證」→「建立憑證」→「OAuth 用戶端 ID」，應用程式類型選「網頁應用程式」
3. 「已授權的重新導向 URI」加入（**一定要是完整的 `/api/auth/callback/google` 路徑**，不能只填網域首頁或其他頁面）：
   - 本機開發：`http://localhost:3000/api/auth/callback/google`
   - 正式環境：`https://<你的正式網域>/api/auth/callback/google`（注意：是 Vercel 專案固定的正式網域，不是每次部署會變的專屬網址）
4. 取得 Client ID / Client Secret，到 Vercel Dashboard → 專案 → Settings → Environment Variables 設定：
   - `AUTH_GOOGLE_ID`
   - `AUTH_GOOGLE_SECRET`
   - `AUTH_SECRET`（用 `npx auth secret` 產生一組隨機值）
   
   **環境範圍記得三個都勾 Production、Preview、Development**，如果漏勾 Development，本機用 `vercel env pull` 拉環境變數時會拉不到這幾個值。

## 2. 資料庫（Vercel Marketplace → Supabase）

這個專案的資料庫是透過 Vercel Marketplace 安裝 **Supabase** 整合建立的（標準 Postgres，非 Neon）。因為 `@vercel/postgres` 套件只相容 Neon 的連線協定，這裡改用通用的 `pg`（node-postgres）存取，理論上可以接任何標準 Postgres 供應商。

1. 在 Vercel Dashboard 開啟這個專案 → Storage → Marketplace → 安裝 Supabase 整合，Region 依需求選（沒有亞洲區域也沒關係，這個專案用量很小）
2. Custom Prefix 記得填 `POSTGRES`，這樣產生的變數會是我們程式碼預期讀取的 `POSTGRES_URL`（不要留空，否則會變成別的名稱）
3. Connect a Project 時，Environments 記得三個（Production / Preview / **Development**）都勾，才能在本機用 `vercel env pull` 拉到
4. 建立完成後，Vercel 會自動注入 `POSTGRES_URL` 等一整組環境變數到專案

## 3. 本機開發拉環境變數

```bash
npx vercel link --project ai-stock-analysis   # 第一次要先 link 到正確的 Vercel 專案
npx vercel env pull .env.local --environment=development
```

## 4. 初始化資料庫

`allowed_users` / `watchlist` 兩張表理論上會由 [auth.js](auth.js) 的登入流程自動建立（`ensureSchema()`），但建議部署後先手動在 **Supabase Dashboard → SQL Editor** 貼上下面這段執行一次，順便把白名單初始成員也一起匯入：

```sql
CREATE TABLE IF NOT EXISTS allowed_users (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS watchlist (
  id SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL REFERENCES allowed_users(email),
  stock_id TEXT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_email, stock_id)
);

INSERT INTO allowed_users (email) VALUES
  ('stanleyliang1222@gmail.com'),
  ('zoeychueh22@gmail.com'),
  ('michecho89@gmail.com'),
  ('meiyu0129@gmail.com'),
  ('carolchueh@gmail.com')
ON CONFLICT (email) DO NOTHING;
```

（這段內容跟 [lib/db.js](lib/db.js) 的 `ensureSchema()` 和 [lib/seed.sql](lib/seed.sql) 是同一份。）

之後要新增白名單成員，一樣去 SQL Editor 貼一行執行，不需要重新部署：

```sql
INSERT INTO allowed_users (email) VALUES ('new-member@gmail.com') ON CONFLICT (email) DO NOTHING;
```

## 5. 已知的踩坑紀錄（給以後參考）

- **Vercel 專案的 Framework Preset 要設成 Next.js**：如果專案是從舊的靜態網站直接沿用設定，Framework Preset 可能還停留在舊的（預期輸出到 `public`），會導致建置失敗（`No Output Directory named "public" found`）。要去 Settings → General → Build & Development Settings 改成 Next.js。
- **Google 登入的重新導向 URI 一定要用固定的正式網域**，不能用 Vercel 每次部署產生的專屬網址（網址裡有一串隨機 hash，每次部署都不一樣）。
- **`pg` 連線字串裡的 `sslmode` 參數會蓋掉程式裡明確設定的 `ssl` 選項**：Supabase 的連線字串預設帶 `sslmode=require`，要先用 `URL` API 把這個參數拿掉（見 [lib/db.js](lib/db.js)），改用我們自己的 `ssl: { rejectUnauthorized: false }`，不然會出現 `self-signed certificate in certificate chain` 錯誤。
- **`pg` 不能被 middleware.js 匯入**：Next.js 的 middleware 跑在 Edge runtime，`pg` 依賴 Node.js 專屬模組（`net`、`tls`、`fs`），所以拆成 [auth.config.js](auth.config.js)（edge-safe，middleware 專用）跟 [auth.js](auth.js)（含 Google provider + 資料庫白名單檢查，只在一般 Node.js runtime 使用）兩份設定。
