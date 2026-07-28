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
