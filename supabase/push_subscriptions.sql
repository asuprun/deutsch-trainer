-- Таблица для хранения Web Push подписок
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         bigserial PRIMARY KEY,
  endpoint   text UNIQUE NOT NULL,
  auth       text NOT NULL,
  p256dh     text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON push_subscriptions (endpoint);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
