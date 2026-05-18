# 03 — База данных

Supabase Postgres. RLS включён без политик (defense in depth) — service_role на сервере обходит RLS, anon-ключ получает deny by default.

## Полная схема

```sql
-- =============================================
-- Таблица: sources
-- Назначение: оригинальные скриншоты страниц учебника
-- =============================================
create table sources (
  id           uuid primary key default gen_random_uuid(),
  image_path   text not null,                  -- путь в Supabase Storage (bucket 'sources')
  image_hash   text unique,                    -- sha256 для дедупликации
  raw_extract  jsonb,                          -- сырой JSON-ответ от Gemini
  title        text,                           -- автогенерируемое имя или ввод пользователя
  notes        text,                           -- личные заметки пользователя
  created_at   timestamptz default now()
);

create index idx_sources_created on sources (created_at desc);

-- =============================================
-- Таблица: cards
-- Назначение: флешкарты для тренировки
-- =============================================
create table cards (
  id             uuid primary key default gen_random_uuid(),
  source_id      uuid references sources(id) on delete cascade,
  kind           text not null check (kind in ('vocab','phrase','grammar_rule','sentence')),

  -- Лицо/обратная сторона
  front          text not null,                -- немецкая сторона (слово/фраза/предложение)
  back           text not null,                -- русский перевод или объяснение

  -- Метаданные для vocab-карт
  word_type      text,                          -- 'noun','verb','adj','adv','prep','conj','pron','num','interj','other'
  gender         text,                          -- 'der','die','das' (только для существительных)
  plural         text,                          -- форма множественного числа
  forms          jsonb,                         -- { praesens, praeteritum, partizip_2, ... } для глаголов
                                                -- { komp, sup } для прилагательных
  examples       jsonb,                         -- [ { de, ru }, ... ]
  mnemonic       text,                          -- мнемоническая ассоциация на русском
  tags           text[] default '{}',           -- свободные теги

  -- Состояние FSRS
  fsrs_state     jsonb,                         -- { due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review }
  due_at         timestamptz default now(),     -- денормализованное due для индексации

  -- Денормализованная статистика
  reps           int default 0,
  lapses         int default 0,

  -- Audit
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index idx_cards_due on cards (due_at);
create index idx_cards_source on cards (source_id);
create index idx_cards_kind on cards (kind);
create index idx_cards_tags on cards using gin (tags);
create index idx_cards_front_trgm on cards using gin (front gin_trgm_ops);  -- поиск по тексту

-- =============================================
-- Таблица: grammar_notes
-- Назначение: грамматические правила и заметки (не для SRS)
-- =============================================
create table grammar_notes (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid references sources(id) on delete cascade,
  title        text not null,                   -- "Konjunktiv II", "Предложное управление warten"
  explanation  text not null,                   -- markdown на русском
  examples     jsonb,                           -- [ { de, ru }, ... ]
  tags         text[] default '{}',
  created_at   timestamptz default now()
);

create index idx_grammar_source on grammar_notes (source_id);
create index idx_grammar_tags on grammar_notes using gin (tags);

-- =============================================
-- Таблица: review_logs
-- Назначение: лог всех ответов для статистики, heatmap и анализа
-- =============================================
create table review_logs (
  id           bigserial primary key,
  card_id      uuid references cards(id) on delete cascade,
  rating       int not null check (rating between 1 and 4),  -- 1=Again, 2=Hard, 3=Good, 4=Easy
  prev_state   jsonb,                           -- snapshot fsrs_state до ответа
  next_state   jsonb,                           -- snapshot fsrs_state после ответа
  reviewed_at  timestamptz default now()
);

create index idx_review_logs_card on review_logs (card_id);
create index idx_review_logs_date on review_logs (reviewed_at);

-- =============================================
-- Таблица: settings
-- Назначение: пользовательские настройки (single row)
-- =============================================
create table settings (
  id           int primary key default 1,
  level        text default 'A2-B1',
  daily_goal   int default 20,                  -- цель карт в день
  fsrs_params  jsonb,                           -- параметры FSRS (request_retention, weights и т.д.)
  ui_theme     text default 'dark',
  tts_voice    text default 'de-DE',
  tts_rate     numeric default 1.0,
  updated_at   timestamptz default now(),
  check (id = 1)
);

insert into settings (id) values (1) on conflict do nothing;

-- =============================================
-- Расширения
-- =============================================
create extension if not exists pg_trgm;        -- для поиска по тексту (gin_trgm_ops)
```

## Логика полей

### `cards.fsrs_state` (jsonb)

Хранит полное состояние FSRS-карты. Структура соответствует `ts-fsrs`:

```json
{
  "due": "2026-05-21T10:00:00.000Z",
  "stability": 4.93,
  "difficulty": 7.0,
  "elapsed_days": 0,
  "scheduled_days": 3,
  "reps": 5,
  "lapses": 1,
  "state": 2,
  "last_review": "2026-05-18T10:00:00.000Z"
}
```

- `state`: 0 = New, 1 = Learning, 2 = Review, 3 = Relearning
- `due` дублируется в колонку `due_at` для эффективного индексирования

### `cards.forms` (jsonb)

Для глаголов:
```json
{
  "infinitiv": "gehen",
  "praesens_3sg": "geht",
  "praeteritum": "ging",
  "partizip_2": "gegangen",
  "hilfsverb": "sein",
  "trennbar": false
}
```

Для прилагательных:
```json
{
  "komparativ": "schneller",
  "superlativ": "am schnellsten"
}
```

### `cards.examples` (jsonb)

```json
[
  { "de": "Ich gehe nach Hause.", "ru": "Я иду домой.", "level": "A1" },
  { "de": "Das geht nicht.", "ru": "Так не пойдёт.", "level": "A2" }
]
```

## Дедупликация

Любая загрузка проходит через проверку `image_hash`. Если запись уже существует — возвращается кешированный `raw_extract` без повторного вызова Gemini.

```sql
select id, raw_extract from sources where image_hash = $1;
```

## Триггер на updated_at

```sql
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger cards_touch
  before update on cards
  for each row execute function touch_updated_at();

create trigger settings_touch
  before update on settings
  for each row execute function touch_updated_at();
```

## Чистка старых данных

Опциональная процедура для освобождения места в Supabase Storage (1GB лимит):

```sql
-- Найти sources, на которые не ссылается ни одна карта
select s.id, s.image_path
from sources s
left join cards c on c.source_id = s.id
where c.id is null
  and s.created_at < now() - interval '90 days';
```

После — удалять файлы из Storage вручную или через scheduled function.

## Storage bucket

- **Имя:** `sources`
- **Режим:** приватный (private)
- **Доступ:** только через signed URLs от сервера
- **Структура:** `sources/<YYYY-MM-DD>/<hash>.webp`
- **TTL signed URLs:** 1 час

## Миграции

Все DDL хранятся в `db/migrations/0001_initial.sql`, `0002_*.sql` и т.д. Применяются вручную через Supabase SQL Editor (для проекта на одного пользователя CI/CD на миграциях избыточен).

## Дальше

- [04 — API](04-api.md): как этими данными управляют endpoints.
