import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Срезает ведущий немецкий артикль для отображения существительного.
 * Сохраняет регистр и остальную часть слова. "die Kalorie" → "Kalorie".
 */
export function stripArticle(s: string): string {
  return s.replace(/^\s*(der|die|das|ein|eine)\s+/i, '').trim();
}

/**
 * Приводит род к каноничному артиклю der/die/das (ИИ иногда отдаёт
 * neuter/female/m и т.п.). Неизвестное/пустое → null.
 */
export function normalizeGender(g: string | null | undefined): string | null {
  const s = (g ?? '').toLowerCase().trim();
  if (!s) return null;
  if (s === 'der' || s === 'die' || s === 'das') return s;
  if (['m', 'mask', 'maskulin', 'masculine', 'male', 'maskulinum'].includes(s)) return 'der';
  if (['f', 'fem', 'feminin', 'feminine', 'female', 'femininum'].includes(s)) return 'die';
  if (['n', 'neut', 'neutrum', 'neutral', 'neuter'].includes(s)) return 'das';
  if (s === 'der/die' || s === 'die/der') return 'der/die';
  return null;
}

/**
 * Каноничная часть речи. ИИ/импорт дают verb/Verb, adjective/adj/Adjektiv,
 * Substantiv, Konjunktion и т.п. Приводим к единому набору. Неизвестное → null.
 */
export function normalizeWordType(w: string | null | undefined): string | null {
  const s = (w ?? '').toLowerCase().trim();
  if (!s) return null;
  if (['noun', 'nomen', 'substantiv', 'n.'].includes(s)) return 'noun';
  if (['verb', 'v.', 'verbum'].includes(s)) return 'verb';
  if (['adjective', 'adj', 'adj.', 'adjektiv'].includes(s)) return 'adjective';
  if (['adverb', 'adv', 'adv.', 'adverbium'].includes(s)) return 'adverb';
  if (['preposition', 'prep', 'prep.', 'präposition', 'praeposition'].includes(s)) return 'preposition';
  if (['conjunction', 'conj', 'conj.', 'konjunktion'].includes(s)) return 'conjunction';
  if (['pronoun', 'pron', 'pron.', 'pronomen'].includes(s)) return 'pronoun';
  if (['numeral', 'num', 'num.', 'numerale', 'zahlwort'].includes(s)) return 'numeral';
  if (['interjection', 'interj', 'interjektion'].includes(s)) return 'interjection';
  if (s.includes('phrase') || s.includes('redewendung') || s.includes('kollokation')) return 'phrase';
  if (s === 'other' || s === 'sonstiges') return 'other';
  return null;
}

/**
 * Нормализует теги: обрезка/схлопывание пробелов, нижний регистр
 * (кроме кодов уровня A1/A2/B1/B2/C1/C2 — они заглавные), удаление дублей.
 */
export function normalizeTags(tags: (string | null | undefined)[] | null | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of tags ?? []) {
    const s = String(raw ?? '').trim().replace(/\s+/g, ' ');
    if (!s) continue;
    const n = /^[abc][12]$/i.test(s) ? s.toUpperCase() : s.toLowerCase();
    if (!seen.has(n)) { seen.add(n); out.push(n); }
  }
  return out;
}
