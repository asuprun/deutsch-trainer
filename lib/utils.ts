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
