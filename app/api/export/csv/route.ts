import { getSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Оборачиваем в кавычки если содержит запятую, кавычку или перенос строки
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export async function GET() {
  try {
    const db = getSupabaseAdmin();

    const { data, error } = await db
      .from('cards')
      .select('id, kind, front, back, gender, plural, word_type, tags, reps, lapses, due_at, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      return new Response(
        JSON.stringify({ error: { code: 'db', message: error.message } }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const headers = ['id', 'kind', 'front', 'back', 'gender', 'plural', 'word_type', 'tags', 'reps', 'lapses', 'due_at', 'created_at'];
    const rows = [headers.join(',')];

    for (const card of data ?? []) {
      const tags = Array.isArray(card.tags) ? card.tags.join(';') : (card.tags ?? '');
      const row = [
        escapeCSV(card.id),
        escapeCSV(card.kind),
        escapeCSV(card.front),
        escapeCSV(card.back),
        escapeCSV(card.gender),
        escapeCSV(card.plural),
        escapeCSV(card.word_type),
        escapeCSV(tags),
        escapeCSV(card.reps),
        escapeCSV(card.lapses),
        escapeCSV(card.due_at),
        escapeCSV(card.created_at),
      ];
      rows.push(row.join(','));
    }

    const csvText = rows.join('\r\n');

    return new Response(csvText, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="deutsch-trainer-cards.csv"',
      },
    });
  } catch (e) {
    console.error('[export/csv]', e);
    return new Response(
      JSON.stringify({ error: { code: 'internal', message: 'Internal server error' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
