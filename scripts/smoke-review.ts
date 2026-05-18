/**
 * Smoke-тест /api/review/queue и /api/review/answer.
 * Запуск: npx tsx scripts/smoke-review.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function loadEnv() {
  const text = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function login(): Promise<string> {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: process.env.APP_PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  return (res.headers.get('set-cookie') ?? '').split(';')[0];
}

async function main() {
  loadEnv();
  const cookie = await login();
  const auth = { Cookie: cookie, 'Content-Type': 'application/json' };

  console.log('=== GET /api/review/queue ===');
  const qRes = await fetch('http://localhost:3000/api/review/queue?limit=10', { headers: auth });
  const qData = await qRes.json();
  console.log(`status: ${qRes.status}, due_count_total: ${qData.due_count_total}, queue length: ${qData.queue?.length ?? 0}`);

  if (!qData.queue?.length) {
    console.log('Очередь пуста — нечего тестировать');
    process.exit(0);
  }

  const card = qData.queue[0];
  console.log(`\nПервая карта: [${card.kind}] ${card.gender ?? ''} ${card.front} → ${card.back}`);
  console.log(`fsrs_state: ${JSON.stringify(card.fsrs_state)}`);
  console.log(`intervals превью:`);
  for (const [r, v] of Object.entries(card.intervals ?? {})) {
    console.log(`  rating ${r}: due=${(v as any).due}, days=${(v as any).scheduled_days}`);
  }

  // Симулируем ответ "Хорошо" на первую карту
  console.log('\n=== POST /api/review/answer { rating: 3 (Good) } ===');
  const aRes = await fetch('http://localhost:3000/api/review/answer', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ card_id: card.id, rating: 3 }),
  });
  const aData = await aRes.json();
  console.log(`status: ${aRes.status}`);
  console.log(`next_due: ${aData.next_due}`);
  console.log(`scheduled_days: ${aData.scheduled_days}`);
  console.log(`new state.reps: ${aData.new_state?.reps}`);
  console.log(`new state.lapses: ${aData.new_state?.lapses}`);
  console.log(`new state.state: ${aData.new_state?.state} (0=New, 1=Learning, 2=Review, 3=Relearning)`);

  // Проверим что карта больше не в очереди
  console.log('\n=== Повторный GET /api/review/queue ===');
  const q2 = await fetch('http://localhost:3000/api/review/queue?limit=10', { headers: auth });
  const q2Data = await q2.json();
  console.log(`due_count_total: ${q2Data.due_count_total} (было ${qData.due_count_total})`);
  const stillThere = q2Data.queue?.find((c: any) => c.id === card.id);
  console.log(`карта ${card.id.slice(0, 8)}… в очереди: ${stillThere ? 'ДА (плохо)' : 'НЕТ (хорошо)'}`);

  // Проверим неверный input
  console.log('\n=== POST /api/review/answer с rating=99 (должно быть 400) ===');
  const badRes = await fetch('http://localhost:3000/api/review/answer', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ card_id: card.id, rating: 99 }),
  });
  console.log(`status: ${badRes.status} (ожидается 400)`);

  process.exit(0);
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
