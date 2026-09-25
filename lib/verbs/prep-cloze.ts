/**
 * Lückentext-Logik für den Präpositions-Drill — gemeinsam für Client (Drill)
 * und Server (API filtert Verben ohne brauchbaren Beispielsatz VOR dem Limit).
 */

export type Rektion = { prep: string; kasus: string };
export type ClozeExample = { de: string; ru: string };

// Sucht die Präposition als ganzes Wort im Satz und ersetzt sie durch ___
export function makeCloze(sentence: string, prep: string): { text: string; answer: string } | null {
  const esc = prep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^A-Za-zÄÖÜäöüß])(${esc})([^A-Za-zÄÖÜäöüß]|$)`, 'i');
  const m = sentence.match(re);
  if (!m) return null;
  const idx = (m.index ?? 0) + m[1].length;
  const answer = sentence.slice(idx, idx + m[2].length);
  return { text: sentence.slice(0, idx) + '___' + sentence.slice(idx + m[2].length), answer };
}

// Mehrfachwerte («für/gegen/um») in einzelne Präpositionen zerlegen
function splitPreps(prep: string): string[] {
  return prep.split(/[/,;]/).map((p) => p.trim()).filter(Boolean);
}

// Erstes (Beispiel × Präposition)-Paar, das einen Lückentext ergibt
export function firstCloze(
  examples: ClozeExample[] | null | undefined,
  rektionen: Rektion[],
): { text: string; answer: string; ru: string } | null {
  for (const e of examples ?? []) {
    if (!e?.de) continue;
    for (const r of rektionen) {
      for (const p of splitPreps(r.prep)) {
        const c = makeCloze(e.de, p);
        if (c) return { ...c, ru: e.ru };
      }
    }
  }
  return null;
}
