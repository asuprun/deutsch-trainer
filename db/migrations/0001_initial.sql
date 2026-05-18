-- =============================================================
-- Deutsch Trainer — миграция 0001 (первичная схема)
-- Применить через Supabase Dashboard → SQL Editor → New query → Paste → Run
-- =============================================================

-- Расширения
create extension if not exists pg_trgm;

-- =============================================================
-- Таблица sources — оригинальные скриншоты страниц учебника
-- =============================================================
create table if not exists sources (
  id           uuid primary key default gen_random_uuid(),
  image_path   text not null,
  image_hash   text unique,
  raw_extract  jsonb,
  title        text,
  notes        text,
  created_at   timestamptz default now()
);

create index if not exists idx_sources_created on sources (created_at desc);

-- =============================================================
-- Таблица cards — флешкарты для тренировки
-- =============================================================
create table if not exists cards (
  id             uuid primary key default gen_random_uuid(),
  source_id      uuid references sources(id) on delete cascade,
  kind           text not null check (kind in ('vocab','phrase','grammar_rule','sentence')),

  front          text not null,
  back           text not null,

  word_type      text,
  gender         text,
  plural         text,
  forms          jsonb,
  examples       jsonb,
  mnemonic       text,
  tags           text[] default '{}',

  fsrs_state     jsonb,
  due_at         timestamptz default now(),

  reps           int default 0,
  lapses         int default 0,

  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists idx_cards_due on cards (due_at);
create index if not exists idx_cards_source on cards (source_id);
create index if not exists idx_cards_kind on cards (kind);
create index if not exists idx_cards_tags on cards using gin (tags);
create index if not exists idx_cards_front_trgm on cards using gin (front gin_trgm_ops);

-- =============================================================
-- Таблица grammar_notes — грамматические заметки (не для SRS)
-- =============================================================
create table if not exists grammar_notes (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid references sources(id) on delete cascade,
  title        text not null,
  explanation  text not null,
  examples     jsonb,
  tags         text[] default '{}',
  created_at   timestamptz default now()
);

create index if not exists idx_grammar_source on grammar_notes (source_id);
create index if not exists idx_grammar_tags on grammar_notes using gin (tags);

-- =============================================================
-- Таблица review_logs — лог ответов для статистики и heatmap
-- =============================================================
create table if not exists review_logs (
  id           bigserial primary key,
  card_id      uuid references cards(id) on delete cascade,
  rating       int not null check (rating between 1 and 4),
  prev_state   jsonb,
  next_state   jsonb,
  reviewed_at  timestamptz default now()
);

create index if not exists idx_review_logs_card on review_logs (card_id);
create index if not exists idx_review_logs_date on review_logs (reviewed_at);

-- =============================================================
-- Таблица settings — пользовательские настройки (single row, id=1)
-- =============================================================
create table if not exists settings (
  id           int primary key default 1,
  level        text default 'A2-B1',
  daily_goal   int default 20,
  fsrs_params  jsonb,
  ui_theme     text default 'dark',
  tts_voice    text default 'de-DE',
  tts_rate     numeric default 1.0,
  updated_at   timestamptz default now(),
  check (id = 1)
);

insert into settings (id) values (1) on conflict do nothing;

-- =============================================================
-- Триггеры на updated_at
-- =============================================================
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists cards_touch on cards;
create trigger cards_touch
  before update on cards
  for each row execute function touch_updated_at();

drop trigger if exists settings_touch on settings;
create trigger settings_touch
  before update on settings
  for each row execute function touch_updated_at();

-- =============================================================
-- RLS — включаем на всех таблицах без политик (defense in depth).
-- service_role обходит RLS, anon/authenticated получают deny by default.
-- =============================================================
alter table sources       enable row level security;
alter table cards         enable row level security;
alter table grammar_notes enable row level security;
alter table review_logs   enable row level security;
alter table settings      enable row level security;

-- =============================================================
-- Storage bucket 'sources' создаётся отдельно через Dashboard:
--   Storage → Create bucket → name=sources, private, size limit 5MB,
--   allowed MIME types: image/webp, image/jpeg, image/png
-- =============================================================
