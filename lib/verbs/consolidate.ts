import { normalizeWordType } from '@/lib/utils';

/**
 * Verben-mit-Präposition-Konsolidierung.
 *
 * Beim Extrahieren von Tabellen wie «warten auf», «sich freuen über» liefert
 * das Sprachmodell oft ZWEI Karten: das nackte Verb («warten») UND eine
 * Kombi-Karte («warten auf»). Für den Präpositions-Drill brauchen wir aber
 * EINE Verbkarte, deren feste Präposition in forms.praeposition/forms.kasus
 * steht. Diese Funktion faltet die Kombi-Karten deterministisch ins Basisverb
 * — unabhängig davon, ob das Modell die Anweisung im Prompt befolgt hat.
 */

// Kasus-Heuristik nach Präposition (Verbrektion).
// Reine Akk-/Dativ-Präpositionen sind eindeutig; Wechselpräpositionen nehmen
// bei Verbrektion überwiegend Akkusativ (denken an, warten auf, glauben an …).
// Ausnahmen (teilnehmen an + Dativ, warnen vor + Dativ) sind selten und lassen
// sich per Karteneditor / «Обогатить»-Knopf korrigieren.
const PREP_KASUS: Record<string, 'Akkusativ' | 'Dativ'> = {
  // reine Akkusativ-Präpositionen
  'für': 'Akkusativ', 'um': 'Akkusativ', 'gegen': 'Akkusativ', 'durch': 'Akkusativ', 'ohne': 'Akkusativ', 'bis': 'Akkusativ',
  // reine Dativ-Präpositionen
  'mit': 'Dativ', 'bei': 'Dativ', 'nach': 'Dativ', 'von': 'Dativ', 'zu': 'Dativ', 'aus': 'Dativ', 'seit': 'Dativ', 'gegenüber': 'Dativ',
  // Wechselpräpositionen -> Standard Akkusativ
  'auf': 'Akkusativ', 'an': 'Akkusativ', 'in': 'Akkusativ', 'über': 'Akkusativ', 'unter': 'Akkusativ', 'vor': 'Akkusativ', 'hinter': 'Akkusativ', 'neben': 'Akkusativ', 'zwischen': 'Akkusativ',
};
const PREPS = new Set(Object.keys(PREP_KASUS));

/** Minimales Kartenformat, das diese Funktion berührt. */
export interface Consolidatable {
  kind: string;
  front: string;
  back: string;
  word_type?: string | null;
  forms?: Record<string, unknown> | null;
  [k: string]: unknown;
}

/** Zerlegt «(sich) VERB PRÄP» in Verb + Präposition, sonst null. */
function splitCombo(front: string): { verb: string; prep: string; reflexive: boolean } | null {
  const tokens = front.trim().split(/\s+/);
  if (tokens.length < 2) return null;
  const prep = tokens[tokens.length - 1].toLowerCase();
  if (!PREPS.has(prep)) return null;
  const verbPart = tokens.slice(0, -1).join(' ');
  const reflexive = /^sich\s+/i.test(verbPart);
  const lemma = verbPart.replace(/^sich\s+/i, '');
  // muss wie ein Verb aussehen (-en / -ern / -eln / -n)
  if (!/(?:en|ern|eln|n)$/i.test(lemma)) return null;
  return { verb: verbPart, prep, reflexive };
}

function applyPrep<T extends Consolidatable>(card: T, prep: string, reflexive: boolean): void {
  if (reflexive && !/^sich\s+/i.test(card.front)) card.front = `sich ${card.front.trim()}`;
  const forms: Record<string, unknown> = { ...(card.forms ?? {}) };
  forms.praeposition = prep;
  forms.kasus = PREP_KASUS[prep] ?? 'Akkusativ';
  if (forms.infinitiv) forms.infinitiv = card.front;
  card.forms = forms;
  card.word_type = 'verb';
}

export function consolidateVerbPrepositions<T extends Consolidatable>(cards: T[]): T[] {
  // Basisverben nach Lemma (ohne "sich") indexieren
  const baseByLemma = new Map<string, T>();
  for (const c of cards) {
    if (normalizeWordType(c.word_type) === 'verb') {
      const lemma = c.front.trim().replace(/^sich\s+/i, '').toLowerCase();
      if (!baseByLemma.has(lemma)) baseByLemma.set(lemma, c);
    }
  }

  // Kombi-Karten je Lemma sammeln
  const combos = new Map<string, { prep: string; reflexive: boolean; card: T }[]>();
  const drop = new Set<T>();
  for (const c of cards) {
    if (c.kind !== 'vocab') continue;
    const parsed = splitCombo(c.front);
    if (!parsed) continue;
    const lemma = parsed.verb.replace(/^sich\s+/i, '').toLowerCase();
    if (!combos.has(lemma)) combos.set(lemma, []);
    combos.get(lemma)!.push({ prep: parsed.prep, reflexive: parsed.reflexive, card: c });
    drop.add(c);
  }

  const add: T[] = [];
  for (const [lemma, list] of combos) {
    // eindeutige Präpositionen (Reihenfolge erhalten)
    const seen = new Set<string>();
    const uniq = list.filter((x) => (seen.has(x.prep) ? false : (seen.add(x.prep), true)));

    let base = baseByLemma.get(lemma);
    if (!base) {
      // kein nacktes Basisverb -> erste Kombi-Karte dazu befördern
      base = uniq[0].card;
      drop.delete(base);
      // "PRÄP" aus dem front entfernen
      base.front = uniq[0].reflexive ? `sich ${lemma}` : lemma;
    }
    applyPrep(base, uniq[0].prep, uniq[0].reflexive);

    // weitere Präpositionen -> geklonte Verbkarten
    for (const co of uniq.slice(1)) {
      const clone = { ...base, forms: { ...(base.forms ?? {}) } } as T;
      applyPrep(clone, co.prep, co.reflexive);
      add.push(clone);
    }
  }

  return cards.filter((c) => !drop.has(c)).concat(add);
}
