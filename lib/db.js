import { Pool } from 'pg';
import { SUPABASE_CA_CERT } from '@/lib/supabase-ca';

// pg 解析連線字串時，字串裡的 sslmode 參數會覆蓋掉下面明確指定的 ssl 選項，
// 所以先把它拿掉，改用我們自己的 ssl 設定（以 Supabase 根憑證做完整驗證）。
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
// serverless 每個 instance 只保留少量連線，真正的連線池交給 Supabase pooler。
// 設定 timeout：Supabase 暫停時連線會卡在交握階段，不設的話要等到 Vercel 函式逾時才會失敗。
const pool = new Pool({
  connectionString,
  // Supabase 的伺服器憑證由它自己的根 CA 簽發，不在 Node 內建信任清單裡；
  // 明確指定 CA 後即可完整驗證憑證鏈與主機名稱，不必關閉驗證。
  ssl: { ca: SUPABASE_CA_CERT, rejectUnauthorized: true },
  max: 3,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 10000,
  query_timeout: 10000,
});

async function createSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS allowed_users (
      email TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // seeded：是否已種入過預設自選清單。用來區分「新使用者」與「自己把清單刪光的使用者」。
  await pool.query('ALTER TABLE allowed_users ADD COLUMN IF NOT EXISTS seeded BOOLEAN NOT NULL DEFAULT false;');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS watchlist (
      id SERIAL PRIMARY KEY,
      user_email TEXT NOT NULL REFERENCES allowed_users(email),
      stock_id TEXT NOT NULL,
      added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_email, stock_id)
    );
  `);
  // 擋掉 Supabase REST API（anon / authenticated 角色）的存取。
  // 我們以表擁有者 postgres 連線，不受 RLS 限制；不建立任何 policy 即等於全部拒絕。
  await pool.query('ALTER TABLE allowed_users ENABLE ROW LEVEL SECURITY;');
  await pool.query('ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;');
  // 加入 seeded 欄位前就已有自選股的使用者，視為已種入過
  await pool.query(`
    UPDATE allowed_users SET seeded = true
    WHERE seeded = false AND email IN (SELECT user_email FROM watchlist);
  `);
}

// 每個 serverless instance 只建一次 schema；失敗時清掉快取，下次呼叫會重試
let schemaReady;
export function ensureSchema() {
  if (!schemaReady) {
    schemaReady = createSchema().catch((err) => {
      schemaReady = undefined;
      throw err;
    });
  }
  return schemaReady;
}

export async function isEmailAllowed(email) {
  await ensureSchema();
  const { rows } = await pool.query('SELECT 1 FROM allowed_users WHERE email = $1;', [email]);
  return rows.length > 0;
}

// 新加入的排最前面；同一批種入的預設清單（added_at 相同）依寫入順序排列
export async function getWatchlist(userEmail) {
  await ensureSchema();
  const { rows } = await pool.query(
    'SELECT stock_id FROM watchlist WHERE user_email = $1 ORDER BY added_at DESC, id ASC;',
    [userEmail]
  );
  return rows.map((r) => r.stock_id);
}

// 讀取自選清單；若使用者從未種入過預設清單，在同一個交易內種入並標記 seeded
export async function getOrSeedWatchlist(userEmail, defaultStockIds) {
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT seeded FROM allowed_users WHERE email = $1 FOR UPDATE;',
      [userEmail]
    );
    if (rows.length > 0 && !rows[0].seeded) {
      await client.query(
        `INSERT INTO watchlist (user_email, stock_id)
         SELECT $1, unnest($2::text[])
         ON CONFLICT (user_email, stock_id) DO NOTHING;`,
        [userEmail, defaultStockIds]
      );
      await client.query('UPDATE allowed_users SET seeded = true WHERE email = $1;', [userEmail]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  return getWatchlist(userEmail);
}

export async function addToWatchlist(userEmail, stockId) {
  await ensureSchema();
  await pool.query(
    `INSERT INTO watchlist (user_email, stock_id)
     VALUES ($1, $2)
     ON CONFLICT (user_email, stock_id) DO NOTHING;`,
    [userEmail, stockId]
  );
}

export async function removeFromWatchlist(userEmail, stockId) {
  await ensureSchema();
  await pool.query(
    'DELETE FROM watchlist WHERE user_email = $1 AND stock_id = $2;',
    [userEmail, stockId]
  );
}
