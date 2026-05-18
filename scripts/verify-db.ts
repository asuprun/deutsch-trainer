/**
 * Проверка миграции БД.
 * Запуск: npx tsx scripts/verify-db.ts
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function loadEnv() {
  const text = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !key) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY не заданы в .env.local');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const TABLES = ['sources', 'cards', 'grammar_notes', 'review_logs', 'settings'] as const;

async function main() {
  console.log(`🔗 Подключение: ${url}`);
  let ok = 0;
  let fail = 0;

  for (const t of TABLES) {
    const { error, count } = await sb.from(t).select('*', { count: 'exact' }).limit(1);
    if (error) {
      console.log(`❌ ${t.padEnd(15)} — ${error.message}`);
      fail++;
    } else {
      console.log(`✅ ${t.padEnd(15)} — ${count ?? 0} строк`);
      ok++;
    }
  }

  const { data: s, error: sErr } = await sb.from('settings').select('*').eq('id', 1).single();
  if (sErr) {
    console.log(`❌ settings row id=1 — ${sErr.message}`);
    fail++;
  } else {
    console.log(`✅ settings row id=1 — level=${s.level}, daily_goal=${s.daily_goal}, ui_theme=${s.ui_theme}`);
    ok++;
  }

  console.log('');
  console.log(`Итого: ${ok} ok, ${fail} ошибок`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('❌ Непредвиденная ошибка:', e);
  process.exit(1);
});
