-- =============================================================
-- Кэш текстов-с-пропусками по колодам (тема → связный текст)
-- Применить: Supabase Dashboard → SQL Editor → Run
-- Фича работает и без этой таблицы (просто без кэша — каждый
-- раз новая генерация). Таблица включает экономию токенов.
-- =============================================================

create table if not exists deck_cloze_cache (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete cascade,
  cloze jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists deck_cloze_cache_source_idx
  on deck_cloze_cache (source_id, created_at desc);
