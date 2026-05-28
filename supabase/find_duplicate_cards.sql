-- =============================================================
-- Функция поиска дублей карточек через pg_trgm similarity
-- Применить через Supabase Dashboard → SQL Editor → Run
-- pg_trgm уже включён в 0001_initial.sql
-- =============================================================

create or replace function find_duplicate_cards(threshold float default 0.75)
returns table (
  id1   uuid,
  front1 text,
  back1  text,
  kind1  text,
  id2   uuid,
  front2 text,
  back2  text,
  kind2  text,
  score  float
)
language sql stable
as $$
  select
    a.id,
    a.front,
    a.back,
    a.kind,
    b.id,
    b.front,
    b.back,
    b.kind,
    similarity(lower(a.front), lower(b.front))::float
  from cards a
  join cards b on a.id < b.id
  where similarity(lower(a.front), lower(b.front)) > threshold
  order by similarity(lower(a.front), lower(b.front)) desc
  limit 200;
$$;
