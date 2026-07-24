import { sql } from '@vercel/postgres';

// 建立資料表（若尚未存在）。首次部署 / 開發環境啟動時呼叫一次即可。
export async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS allowed_users (
      email TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS watchlist (
      id SERIAL PRIMARY KEY,
      user_email TEXT NOT NULL REFERENCES allowed_users(email),
      stock_id TEXT NOT NULL,
      added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_email, stock_id)
    );
  `;
}

export async function isEmailAllowed(email) {
  const { rows } = await sql`SELECT 1 FROM allowed_users WHERE email = ${email};`;
  return rows.length > 0;
}

export async function getWatchlist(userEmail) {
  const { rows } = await sql`
    SELECT stock_id FROM watchlist
    WHERE user_email = ${userEmail}
    ORDER BY added_at ASC;
  `;
  return rows.map((r) => r.stock_id);
}

export async function addToWatchlist(userEmail, stockId) {
  await sql`
    INSERT INTO watchlist (user_email, stock_id)
    VALUES (${userEmail}, ${stockId})
    ON CONFLICT (user_email, stock_id) DO NOTHING;
  `;
}

export async function removeFromWatchlist(userEmail, stockId) {
  await sql`
    DELETE FROM watchlist
    WHERE user_email = ${userEmail} AND stock_id = ${stockId};
  `;
}
