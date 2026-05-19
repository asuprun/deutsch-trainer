-- Run this in Supabase SQL Editor once
-- https://supabase.com/dashboard/project/_/sql

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint  text NOT NULL UNIQUE,
  auth      text NOT NULL,
  p256dh    text NOT NULL,
  created_at timestamptz DEFAULT now()
);
