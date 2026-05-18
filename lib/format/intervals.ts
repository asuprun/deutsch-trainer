/**
 * Форматировать промежуток "от now до date" короткой строкой:
 * "<1м", "10м", "2ч", "3д", "1нед", "2мес", "1г".
 */
export function formatInterval(due: Date | string, from: Date = new Date()): string {
  const target = typeof due === 'string' ? new Date(due) : due;
  let ms = target.getTime() - from.getTime();
  if (ms < 0) ms = 0;

  const minutes = ms / 60000;
  if (minutes < 1) return '<1м';
  if (minutes < 60) return `${Math.round(minutes)}м`;

  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}ч`;

  const days = hours / 24;
  if (days < 7) return `${Math.round(days)}д`;
  if (days < 30) return `${Math.round(days / 7)}нед`;

  const months = days / 30;
  if (months < 12) return `${Math.round(months)}мес`;

  return `${Math.round(days / 365)}г`;
}
