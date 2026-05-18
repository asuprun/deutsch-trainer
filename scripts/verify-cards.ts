/**
 * Проверка что карты после bulk-create корректно записаны.
 * Запуск: npx tsx scripts/verify-cards.ts
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

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function main() {
  const { data: sources } = await sb.from('sources').select('id, title, image_path').order('created_at', { ascending: false }).limit(5);
  console.log(`sources: ${sources?.length ?? 0}`);
  sources?.forEach((s) => console.log(`  ${s.id.slice(0, 8)}… → ${s.image_path}`));

  const { data: cards } = await sb
    .from('cards')
    .select('id, kind, front, back, gender, fsrs_state, due_at, tags')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`\ncards: ${cards?.length ?? 0}`);
  cards?.forEach((c) => {
    const fsrs = c.fsrs_state as { state?: number; stability?: number; difficulty?: number } | null;
    console.log(`  [${c.kind}] ${c.gender ?? ''} ${c.front} → ${c.back}`);
    console.log(`    state=${fsrs?.state}, stab=${fsrs?.stability}, diff=${fsrs?.difficulty}, due=${c.due_at}, tags=${JSON.stringify(c.tags)}`);
  });

  const { data: grammar } = await sb.from('grammar_notes').select('id, title, explanation').order('created_at', { ascending: false }).limit(5);
  console.log(`\ngrammar_notes: ${grammar?.length ?? 0}`);
  grammar?.forEach((g) => console.log(`  ${g.title}: ${g.explanation.slice(0, 80)}...`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
