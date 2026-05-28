-- =============================================================
-- Кэш сгенерированных упражнений грамматики
-- Применить через Supabase Dashboard → SQL Editor → New query → Paste → Run
-- =============================================================

create table if not exists grammar_exercises_cache (
  id              uuid primary key default gen_random_uuid(),
  grammar_note_id uuid not null references grammar_notes(id) on delete cascade,
  exercises       jsonb not null,
  created_at      timestamptz default now()
);

-- Индекс для быстрого поиска по заметке и дате
create index if not exists idx_grammar_exercises_cache_note
  on grammar_exercises_cache (grammar_note_id, created_at desc);
