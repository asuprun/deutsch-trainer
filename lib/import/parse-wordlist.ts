/** Разбор списка слов: Anki-экспорт (tab/,/;) или список из чата Claude (`Deutsch | Russisch | Beispielsatz`, в т.ч. Markdown-таблица) */

export type ParsedRow = { front: string; back: string; example: string; tags: string[] };

/** Убираем HTML-теги, которые Anki может добавлять в поля */
function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

/** Определяем разделитель: таб → | → запятая → точка с запятой */
export function detectSep(firstLine: string): string {
  if (firstLine.includes('\t')) return '\t';
  if (firstLine.includes('|')) return '|';
  if (firstLine.includes(',')) return ',';
  return ';';
}

/** Разбираем одну строку CSV с учётом кавычек */
function parseLine(line: string, sep: string): string[] {
  if (sep === '|') return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
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

const splitTags = (s: string) => s.split('::').map((t) => t.trim()).filter(Boolean);

export function parseWordList(text: string): { sep: string; rows: ParsedRow[] } {
  // Пропускаем комментарии Anki (#separator:tab, #html:true и т.п.) и разделитель Markdown-таблицы (|---|---|)
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#') && !/^[\s|:-]+$/.test(l));
  if (lines.length === 0) return { sep: '\t', rows: [] };
  const sep = detectSep(lines[0]);
  const rows = lines
    .map((l) => parseLine(l, sep).map(stripHtml))
    // Заголовок таблицы из чата (Deutsch | Russisch | …) — только в первой строке
    .filter((r, i) => r.length >= 2 && r[0] && r[1] && !(i === 0 && r[0].toLowerCase() === 'deutsch'))
    .map((r) => {
      // 3-я колонка: предложение (есть пробел, нет ::) → пример, иначе теги как у Anki
      const c3 = r[2] ?? '';
      const isExample = c3.includes(' ') && !c3.includes('::');
      return {
        front: r[0],
        back: r[1],
        example: isExample ? c3 : '',
        tags: splitTags(isExample ? (r[3] ?? '') : c3),
      };
    });
  return { sep, rows };
}
