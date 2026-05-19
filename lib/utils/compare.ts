/** Расстояние Левенштейна */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Нормализация: нижний регистр, убираем артикли, пунктуацию, лишние пробелы */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/^(der|die|das|ein|eine)\s+/i, '')
    .replace(/[.,;!?()[\]{}'"-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export type CompareResult = 'exact' | 'close' | 'almost' | 'wrong';

/**
 * Сравнивает ответ пользователя с правильным.
 * Правильный ответ может содержать варианты через «,» или «/».
 */
export function compareAnswer(input: string, correct: string): CompareResult {
  const a = normalize(input);
  if (!a) return 'wrong';

  // Разбиваем правильный ответ на варианты
  const variants = correct
    .split(/[,/]/)
    .map((v) => normalize(v))
    .filter(Boolean);

  // Точное совпадение хотя бы с одним вариантом
  if (variants.some((v) => v === a)) return 'exact';

  // Берём минимальное расстояние по всем вариантам
  const minDist = Math.min(...variants.map((v) => levenshtein(a, v)));
  const refLen = Math.max(...variants.map((v) => v.length));
  const ratio = minDist / Math.max(refLen, a.length);

  if (ratio <= 0.2) return 'close';   // ≤20% ошибок → почти точно
  if (ratio <= 0.45) return 'almost'; // ≤45% → примерно
  return 'wrong';
}

/** Автоматическая оценка FSRS по результату сравнения */
export function resultToGrade(r: CompareResult): 1 | 2 | 3 | 4 {
  switch (r) {
    case 'exact':  return 4; // Легко
    case 'close':  return 3; // Хорошо
    case 'almost': return 2; // Сложно
    case 'wrong':  return 1; // Снова
  }
}
