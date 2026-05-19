import { NextResponse } from 'next/server';
import { createEmptyCard } from 'ts-fsrs';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function err(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** Убираем HTML-теги, которые Anki может добавлять в поля */
function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

/** Определяем разделитель: таб → запятая → точка с запятой */
function detectSep(firstLine: string): string {
  if (firstLine.includes('\t')) return '\t';
  if (firstLine.includes(',')) return ',';
  return ';';
}

/** Разбираем одну строку CSV с учётом кавычек */
function parseLine(line: string, sep: string): string[] {
  if (sep !== ',') return line.split(sep);
  const fields: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === sep && !inQ) {
      fields.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
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
  const rawLines = text.split(/\r?\n/).filter((l) => l.trim());

  // Пропускаем комментарии Anki (#separator:tab, #html:true и т.п.)
  const lines = rawLines.filter((l) => !l.startsWith('#'));

  if (lines.length === 0) {
    return err('EMPTY', 'Файл не содержит строк с данными', 400);
  }

  const sep = detectSep(lines[0]);

  const parsed = lines.map((l) => parseLine(l, sep).map(stripHtml));

  // Валидируем минимум: нужны хотя бы 2 колонки
  const valid = parsed.filter((r) => r.length >= 2 && r[0].trim() && r[1].trim());

  if (valid.length === 0) {
    return err('NO_VALID_ROWS', 'Не удалось найти строки с двумя заполненными колонками (немецкий | перевод)', 400);
  }

  // preview=true — только вернуть предпросмотр без сохранения
  const url = new URL(req.url);
  if (url.searchParams.get('preview') === '1') {
    return NextResponse.json({
      total: valid.length,
      separator: sep === '\t' ? 'tab' : sep,
      preview: valid.slice(0, 10).map((r) => ({
        front: r[0],
        back: r[1],
        tags: r[2] ? r[2].split('::').map((t) => t.trim()).filter(Boolean) : [],
      })),
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
    .insert({ image_path: `import/anki-${Date.now()}`, title: 'Импорт из Anki' })
    .select('id')
    .single();

  if (srcErr || !sourceRow) {
    return err('DB_ERROR', srcErr?.message ?? 'source insert failed', 500);
  }

  const rows = valid.map((r) => ({
    source_id: sourceRow.id,
    kind: 'vocab' as const,
    front: r[0].slice(0, 500),
    back: r[1].slice(0, 2000),
    tags: r[2] ? r[2].split('::').map((t) => t.trim()).filter(Boolean).slice(0, 20) : [],
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
