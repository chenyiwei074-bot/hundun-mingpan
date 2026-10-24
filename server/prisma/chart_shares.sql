-- chart_shares（命盘分享链接）—— 与 server/prisma/schema.prisma 的 ChartShare 对应。
--
-- 生产库不要执行 `prisma db push`：现有 prisma schema 里没有 charts.ai_analysis
-- （该列由历史 raw SQL 添加），push 会把它判成"多余列"并删除，提示 accept-data-loss。
-- 因此本表用手工 DDL 添加；新环境初始化时按本文件执行。
--
-- 执行：sudo -u postgres psql -d hundun_mindpan -f server/prisma/chart_shares.sql

CREATE TABLE IF NOT EXISTS chart_shares (
  id         TEXT PRIMARY KEY,
  chart_id   TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS chart_shares_chart_id_idx ON chart_shares(chart_id);

-- 应用连接用户（DATABASE_URL 里的 hundun）
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE chart_shares TO hundun;
