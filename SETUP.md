# 部署設定（需要手動完成的步驟）

## 1. Google OAuth

1. 前往 [Google Cloud Console](https://console.cloud.google.com/) → 建立專案（若還沒有）
2. 「API 和服務」→「憑證」→「建立憑證」→「OAuth 用戶端 ID」，應用程式類型選「網頁應用程式」
3. 「已授權的重新導向 URI」加入：
   - 本機開發：`http://localhost:3000/api/auth/callback/google`
   - 正式環境：`https://<你的網域>/api/auth/callback/google`
4. 取得 Client ID / Client Secret，填入環境變數 `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`

## 2. Vercel Postgres

1. 在 Vercel Dashboard 開啟這個專案 → Storage → Create Database → Postgres
2. 建立後連接到本專案，Vercel 會自動注入 `POSTGRES_URL` 等環境變數
3. 本機開發可執行 `vercel env pull .env.local` 把環境變數拉到本機

## 3. 初始化資料庫

首次部署（或本機開發第一次登入）時，`allowed_users` / `watchlist` 兩張表會由 [auth.js](auth.js) 的登入流程自動建立（`ensureSchema()`）。

白名單初始成員需要手動匯入一次：

```bash
psql "$POSTGRES_URL" -f lib/seed.sql
```

之後要新增白名單成員，直接對 `allowed_users` 表下 `INSERT`，不需要重新部署：

```sql
INSERT INTO allowed_users (email) VALUES ('new-member@gmail.com') ON CONFLICT (email) DO NOTHING;
```

## 4. 環境變數

複製 `.env.local.example` 為 `.env.local` 並填入上述取得的值，另外用 `npx auth secret` 產生 `AUTH_SECRET`。
