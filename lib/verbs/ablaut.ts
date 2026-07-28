// Определение аблаут-паттерна (чередования гласной) немецкого глагола
// по трём основным формам: Infinitiv · Präteritum · Partizip II.

export type VerbFormsLite = {
  infinitiv?: string;
  praeteritum?: string;
  partizip_2?: string;
};

const VOWEL_RE = /(ie|ei|au|eu|äu|[aeiouäöü])/g;

/** Чистим форму до основы: первый значимый токен, без окончаний.
 *  ge- срезаем ТОЛЬКО у Partizip II (там это маркер причастия, а не корень:
 *  geben ≠ ge+ben, а gegeben = ge+geben). */
function stem(form: string, isPartizip = false): string {
  let s = (form ?? '').toLowerCase().trim();
  if (!s) return '';
  // Präteritum отделяемых: «kam vor» / рефлексивные «befand sich» — берём первое слово
  s = s.split(/\s+/).filter((w) => w !== 'sich')[0] ?? '';
  if (isPartizip && s.startsWith('ge') && s.length > 4) s = s.slice(2);
  s = s.replace(/(en|st|t|n|e)$/, '');
  return s;
}

/** Последняя гласная (корневая почти всегда в конце основы — после приставок) */
function lastVowel(form: string, isPartizip = false): string | null {
  const st = stem(form, isPartizip);
  const m = st.match(VOWEL_RE);
  return m ? m[m.length - 1] : null;
}

export type Ablaut = {
  key: string;               // 'e-a-o' | 'gemischt' | 'unklar'
  vowels: [string, string, string] | null;
};

/**
 * Возвращает паттерн. Смешанные (brachte/dachte/kannte — на -te) → 'gemischt'.
 * Если гласную выделить не удалось → 'unklar'.
 */
export function ablaut(forms: VerbFormsLite, front?: string): Ablaut {
  const inf = forms.infinitiv || front || '';
  const praet = forms.praeteritum || '';
  const part = forms.partizip_2 || '';

  // Смешанные / слабо-неправильные: Präteritum на -te (brachte, dachte, kannte, wusste, modalverben)
  const praetToken = praet.toLowerCase().trim().split(/\s+/)[0] ?? '';
  if (/te$/.test(praetToken)) return { key: 'gemischt', vowels: null };

  const v1 = lastVowel(inf);
  const v2 = lastVowel(praet);
  const v3 = lastVowel(part, true);
  if (!v1 || !v2 || !v3) return { key: 'unklar', vowels: null };

  return { key: `${v1}-${v2}-${v3}`, vowels: [v1, v2, v3] };
}

/** Человекочитаемый заголовок группы */
export function patternLabel(key: string): string {
  if (key === 'gemischt') return 'Смешанные (-te)';
  if (key === 'unklar') return 'Прочие';
  return key.split('-').join(' → ');
}
