-- =============================================================
-- Добавляем поле exercise_type в grammar_exercises_cache
-- Позволяет хранить кэш для fill-in и sentence-builder в одной таблице
-- Применить через Supabase Dashboard → SQL Editor → Run
-- =============================================================

ALTER TABLE grammar_exercises_cache
  ADD COLUMN IF NOT EXISTS exercise_type text NOT NULL DEFAULT 'fill';

-- Пересоздаём индекс с учётом нового поля
DROP INDEX IF EXISTS idx_grammar_exercises_cache_note;

CREATE INDEX IF NOT EXISTS idx_grammar_exercises_cache_note
  ON grammar_exercises_cache (grammar_note_id, exercise_type, created_at DESC);
