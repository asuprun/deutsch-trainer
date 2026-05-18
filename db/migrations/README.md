# Миграции базы данных

Миграции применяются вручную через Supabase Dashboard → **SQL Editor**. Это самый простой и безопасный способ — не нужно хранить пароль БД на диске и не нужен Supabase CLI.

## Как применить миграцию `0001_initial.sql`

1. Открой проект в Supabase Dashboard:
   - URL: <https://supabase.com/dashboard/project/cvduyooabvtulxrnfbpy>
2. Слева в меню → **SQL Editor**.
3. Кнопка **New query**.
4. Открой [0001_initial.sql](0001_initial.sql), скопируй всё содержимое целиком.
5. Вставь в редактор.
6. Кнопка **Run** (или `Ctrl+Enter`).
7. В выводе должно появиться `Success. No rows returned`.

## Проверка

После применения миграции запусти из корня проекта:

```powershell
npx tsx scripts/verify-db.ts
```

Скрипт проверит, что все таблицы созданы и доступны через `service_role` ключ.

## Создание Storage bucket

Storage bucket `sources` нужно создать отдельно (SQL для этого не используем):

1. Dashboard → **Storage** → **Create bucket**.
2. Name: `sources`.
3. **Private** (НЕ публичный).
4. File size limit: `5 MB`.
5. Allowed MIME types: `image/webp, image/jpeg, image/png`.

## Будущие миграции

Новые SQL-файлы кладём сюда с возрастающим номером: `0002_*.sql`, `0003_*.sql` и т.д. Каждая миграция должна быть идемпотентной (`create table if not exists`, `drop trigger if exists` и т.п.) — чтобы повторное применение не ломало схему.
