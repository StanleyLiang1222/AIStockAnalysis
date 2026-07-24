import { Pool } from 'pg';

// pg 解析連線字串時，字串裡的 sslmode 參數會覆蓋掉下面明確指定的 ssl 選項，
// 所以先把它拿掉，改用我們自己的 ssl 設定（Supabase 用的是自簽憑證，需要 rejectUnauthorized: false）。
// 用 URL API 刪除參數，避免手動字串操作把 ?/& 語法弄壞。
function stripSslMode(urlString) {
  if (!urlString) return urlString;
  try {
    const url = new URL(urlString);
    url.searchParams.delete('sslmode');
    return url.toString();
  } catch {
    return urlString;
  }
}

const connectionString = stripSslMode(process.env.POSTGRES_URL);

// 標準 Postgres TCP 連線（相容 Supabase / Neon / RDS 等任何 Postgres 供應商）
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

// 建立資料表（若尚未存在）。首次部署 / 開發環境啟動時呼叫一次即可。
export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS allowed_users (
      email TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS watchlist (
      id SERIAL PRIMARY KEY,
      user_email TEXT NOT NULL REFERENCES allowed_users(email),
      stock_id TEXT NOT NULL,
      added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_email, stock_id)
    );
  `);
}

export async function isEmailAllowed(email) {
  const { rows } = await pool.query('SELECT 1 FROM allowed_users WHERE email = $1;', [email]);
  return rows.length > 0;
}

export async function getWatchlist(userEmail) {
  const { rows } = await pool.query(
    'SELECT stock_id FROM watchlist WHERE user_email = $1 ORDER BY added_at ASC;',
    [userEmail]
  );
  return rows.map((r) => r.stock_id);
}

export async function addToWatchlist(userEmail, stockId) {
  await pool.query(
    `INSERT INTO watchlist (user_email, stock_id)
     VALUES ($1, $2)
     ON CONFLICT (user_email, stock_id) DO NOTHING;`,
    [userEmail, stockId]
  );
}

export async function removeFromWatchlist(userEmail, stockId) {
  await pool.query(
    'DELETE FROM watchlist WHERE user_email = $1 AND stock_id = $2;',
    [userEmail, stockId]
  );
}
