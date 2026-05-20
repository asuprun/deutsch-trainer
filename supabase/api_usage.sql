-- =============================================================
-- Таблица api_usage_log — лог вызовов Gemini API
-- Применить через Supabase Dashboard → SQL Editor → Run
-- =============================================================

CREATE TABLE IF NOT EXISTS api_usage_log (
  id          bigserial PRIMARY KEY,
  provider    text DEFAULT 'gemini',
  model       text,
  route       text,          -- enrich | chat | grammar | upload
  tokens_in   int DEFAULT 0,
  tokens_out  int DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_created ON api_usage_log (created_at DESC);

ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;
