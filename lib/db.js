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
  // FinMind 回應快取（所有使用者共用）。key 形如 price:2330，payload 是整理過的資料。
  await pool.query(`
    CREATE TABLE IF NOT EXISTS finmind_cache (
      key TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // AI 健檢報告（所有使用者共用）。同一檔股票、同一個資料日期只產生一份。
  // status：generating（產生中，作為鎖）→ ready；產生失敗時刪除該列。
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_reports (
      stock_id TEXT NOT NULL,
      data_date DATE NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('generating', 'ready')),
      report JSONB,
      model TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (stock_id, data_date)
    );
  `);
  // 擋掉 Supabase REST API（anon / authenticated 角色）的存取。
  // 我們以表擁有者 postgres 連線，不受 RLS 限制；不建立任何 policy 即等於全部拒絕。
  await pool.query('ALTER TABLE allowed_users ENABLE ROW LEVEL SECURITY;');
  await pool.query('ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;');
  await pool.query('ALTER TABLE finmind_cache ENABLE ROW LEVEL SECURITY;');
  await pool.query('ALTER TABLE ai_reports ENABLE ROW LEVEL SECURITY;');
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

// 一次讀出多個快取 key；回傳 Map<key, { payload, fetchedAt }>
export async function readFinMindCache(keys) {
  await ensureSchema();
  const { rows } = await pool.query(
    'SELECT key, payload, fetched_at FROM finmind_cache WHERE key = ANY($1::text[]);',
    [keys]
  );
  return new Map(rows.map((r) => [r.key, { payload: r.payload, fetchedAt: r.fetched_at }]));
}

export async function writeFinMindCache(key, payload) {
  await ensureSchema();
  await pool.query(
    `INSERT INTO finmind_cache (key, payload, fetched_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = EXCLUDED.fetched_at;`,
    [key, JSON.stringify(payload)]
  );
}

// 「產生中」超過這個時間視為卡住（例如函式逾時被中斷），允許其他人接手重新產生
const AI_LOCK_MINUTES = 3;

const toAiReport = (row) => row && ({
  status: row.status === 'generating' && row.stale ? 'none' : row.status,
  report: row.report,
  model: row.model,
  createdAt: row.created_at,
});

// 讀取某檔股票某個資料日期的報告；沒有時回傳 null
export async function getAiReport(stockId, dataDate) {
  await ensureSchema();
  const { rows } = await pool.query(
    `SELECT status, report, model, created_at,
            created_at < now() - make_interval(mins => $3) AS stale
     FROM ai_reports WHERE stock_id = $1 AND data_date = $2;`,
    [stockId, dataDate, AI_LOCK_MINUTES]
  );
  return toAiReport(rows[0]);
}

// 搶下產生報告的鎖。沒有紀錄、或前一次「產生中」已卡住時才搶得到；回傳是否搶到
export async function claimAiReport(stockId, dataDate) {
  await ensureSchema();
  const { rowCount } = await pool.query(
    `INSERT INTO ai_reports (stock_id, data_date, status) VALUES ($1, $2, 'generating')
     ON CONFLICT (stock_id, data_date) DO UPDATE SET created_at = now()
     WHERE ai_reports.status = 'generating' AND ai_reports.created_at < now() - make_interval(mins => $3);`,
    [stockId, dataDate, AI_LOCK_MINUTES]
  );
  return rowCount > 0;
}

export async function saveAiReport(stockId, dataDate, { report, model, inputTokens, outputTokens }) {
  await ensureSchema();
  await pool.query(
    `UPDATE ai_reports
     SET status = 'ready', report = $3::jsonb, model = $4, input_tokens = $5, output_tokens = $6, created_at = now()
     WHERE stock_id = $1 AND data_date = $2;`,
    [stockId, dataDate, JSON.stringify(report), model, inputTokens, outputTokens]
  );
}

// 產生失敗時釋放鎖，下一位使用者可以再試
export async function releaseAiReport(stockId, dataDate) {
  await ensureSchema();
  await pool.query(
    "DELETE FROM ai_reports WHERE stock_id = $1 AND data_date = $2 AND status = 'generating';",
    [stockId, dataDate]
  );
}
