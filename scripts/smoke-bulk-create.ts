/**
 * Smoke-тест /api/cards/bulk-create.
 * Читает extract response, собирает body с первыми 3 словами + 1 грамматикой,
 * шлёт на /api/cards/bulk-create.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

async function login(): Promise<string> {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: process.env.APP_PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error('no auth cookie');
  const cookie = setCookie.split(';')[0];
  return cookie;
}

function loadEnv() {
  const text = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function main() {
  loadEnv();
  const extractPath = join(os.tmpdir(), 'dt-extract.json');
  const extract = JSON.parse(readFileSync(extractPath, 'utf8'));

  console.log(`source_id: ${extract.source_id}`);
  console.log(`words available: ${extract.preview.words.length}`);
  console.log(`grammar available: ${extract.preview.grammar.length}`);

  // Берём первые 3 слова + первое грамматическое правило + 1 фразу
  const cards = [
    ...extract.preview.words.slice(0, 3).map((w: any) => ({
      kind: 'vocab' as const,
      front: w.de,
      back: w.ru,
      word_type: w.word_type || null,
      gender: w.gender || null,
      plural: w.plural || null,
      forms: w.forms ?? null,
      tags: w.level ? [w.level] : [],
    })),
    ...(extract.preview.phrases[0]
      ? [{
          kind: 'phrase' as const,
          front: extract.preview.phrases[0].de,
          back: extract.preview.phrases[0].ru,
        }]
      : []),
  ];

  const grammar_notes = extract.preview.grammar.slice(0, 1).map((g: any) => ({
    title: g.title,
    explanation: g.explanation_md,
    examples: g.examples ?? null,
  }));

  const body = { source_id: extract.source_id, cards, grammar_notes };

  console.log(`\nposting: ${cards.length} cards + ${grammar_notes.length} grammar notes`);

  const cookie = await login();
  const res = await fetch('http://localhost:3000/api/cards/bulk-create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  console.log(`\nstatus: ${res.status}`);
  console.log(JSON.stringify(json, null, 2));
  process.exit(res.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
