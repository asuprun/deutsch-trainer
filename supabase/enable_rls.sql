-- =============================================================
-- Безопасность: включить Row-Level Security на всех таблицах.
-- Применить: Supabase Dashboard → SQL Editor → Run
--
-- Приложение ходит в БД ТОЛЬКО через service_role (на сервере),
-- а он RLS игнорирует. Поэтому включение RLS без политик:
--   • полностью закрывает публичный (anon) API — дыра устранена;
--   • НЕ ломает приложение — сервер работает как раньше.
-- =============================================================

do $$
declare r record;
begin
  for r in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security;', r.tablename);
  end loop;
end $$;

-- Проверка: у всех таблиц public должно быть rowsecurity = true
-- select tablename, rowsecurity from pg_tables where schemaname='public' order by tablename;
