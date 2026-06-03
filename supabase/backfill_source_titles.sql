-- =============================================================
-- Бэкфилл заголовков источников из raw_extract.summary
-- Применить через Supabase Dashboard → SQL Editor → Run
-- Затрагивает только источники с title IS NULL
-- =============================================================

UPDATE sources
SET title = raw_extract->>'summary'
WHERE title IS NULL
  AND raw_extract->>'summary' IS NOT NULL
  AND trim(raw_extract->>'summary') != '';
