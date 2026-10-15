import { NextResponse } from 'next/server';
import { createEmptyCard } from 'ts-fsrs';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { normalizeTags } from '@/lib/utils';
import { parseWordList } from '@/lib/import/parse-wordlist';

export const runtime = 'nodejs';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err('BAD_REQUEST', 'Ожидается multipart/form-data', 400);
  }

  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return err('NO_FILE', 'Поле file обязательно', 400);
  }

  const text = await (file as File).text();
  const { sep, rows: valid } = parseWordList(text);

  if (valid.length === 0) {
    return err('NO_VALID_ROWS', 'Не удалось найти строки с двумя заполненными колонками (немецкий | перевод)', 400);
  }

  // preview=true — только вернуть предпросмотр без сохранения
  const url = new URL(req.url);
  if (url.searchParams.get('preview') === '1') {
    return NextResponse.json({
      total: valid.length,
      separator: sep === '\t' ? 'tab' : sep,
      preview: valid.slice(0, 10),
    });
  }

  // Сохраняем
  const db = getSupabaseAdmin();
  const emptyCard = createEmptyCard();
  const fsrsBase = JSON.parse(JSON.stringify(emptyCard));
  const now = new Date().toISOString();

  // Создаём виртуальный source
  const { data: sourceRow, error: srcErr } = await db
    .from('sources')
    .insert({ image_path: `import/anki-${Date.now()}`, title: sep === '|' ? 'Импорт списка слов' : 'Импорт из Anki' })
    .select('id')
    .single();

  if (srcErr || !sourceRow) {
    return err('DB_ERROR', srcErr?.message ?? 'source insert failed', 500);
  }

  const rows = valid.map((r) => ({
    source_id: sourceRow.id,
    kind: 'vocab' as const,
    front: r.front.slice(0, 500),
    back: r.back.slice(0, 2000),
    examples: r.example ? [{ de: r.example.slice(0, 500), ru: '' }] : null,
    tags: normalizeTags(r.tags).slice(0, 20),
    fsrs_state: fsrsBase,
    due_at: fsrsBase.due ?? now,
  }));

  // Вставляем батчами по 100
  const BATCH = 100;
  const ids: string[] = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const { data, error } = await db
      .from('cards')
      .insert(rows.slice(i, i + BATCH))
      .select('id');
    if (error) return err('DB_ERROR', error.message, 500);
    ids.push(...(data?.map((r) => r.id) ?? []));
  }

  return NextResponse.json(
    { imported: ids.length, source_id: sourceRow.id },
    { status: 201 },
  );
}
