/**
 * Daten für den Pronomen-Trainer (statisch, keine DB).
 * Personalpronomen Nom/Akk/Dat + Reflexivpronomen Akk/Dat, dazu Sätze, in denen
 * Verb oder Präposition den Kasus bestimmt. Bewusst mit «Fallen», wo das Russische
 * einen anderen Kasus nimmt (anrufen + Akk = «позвонить мне», danken + Dat = «благодарить тебя»).
 */

export type PronKasus = 'Akkusativ' | 'Dativ';

type Person = { nom: string; label: string; ru: string; akk: string; dat: string; ruAkk: string; ruDat: string; reflAkk: string; reflDat: string };

// label = Anzeige inkl. Unterscheidung der beiden «sie»
export const PERSONS: Person[] = [
  { nom: 'ich', label: 'ich', ru: 'я', akk: 'mich', dat: 'mir', ruAkk: 'меня', ruDat: 'мне', reflAkk: 'mich', reflDat: 'mir' },
  { nom: 'du', label: 'du', ru: 'ты', akk: 'dich', dat: 'dir', ruAkk: 'тебя', ruDat: 'тебе', reflAkk: 'dich', reflDat: 'dir' },
  { nom: 'er', label: 'er', ru: 'он', akk: 'ihn', dat: 'ihm', ruAkk: 'его', ruDat: 'ему', reflAkk: 'sich', reflDat: 'sich' },
  { nom: 'sie', label: 'sie (она)', ru: 'она', akk: 'sie', dat: 'ihr', ruAkk: 'её', ruDat: 'ей', reflAkk: 'sich', reflDat: 'sich' },
  { nom: 'es', label: 'es', ru: 'оно', akk: 'es', dat: 'ihm', ruAkk: 'его', ruDat: 'ему', reflAkk: 'sich', reflDat: 'sich' },
  { nom: 'wir', label: 'wir', ru: 'мы', akk: 'uns', dat: 'uns', ruAkk: 'нас', ruDat: 'нам', reflAkk: 'uns', reflDat: 'uns' },
  { nom: 'ihr', label: 'ihr (вы)', ru: 'вы', akk: 'euch', dat: 'euch', ruAkk: 'вас', ruDat: 'вам', reflAkk: 'euch', reflDat: 'euch' },
  { nom: 'sie', label: 'sie (они)', ru: 'они', akk: 'sie', dat: 'ihnen', ruAkk: 'их', ruDat: 'им', reflAkk: 'sich', reflDat: 'sich' },
  { nom: 'Sie', label: 'Sie (Вы)', ru: 'Вы', akk: 'Sie', dat: 'Ihnen', ruAkk: 'Вас', ruDat: 'Вам', reflAkk: 'sich', reflDat: 'sich' },
];

export type PronItem = {
  id: string;
  /** Anzeige der Grundform, z.B. «du» oder «sie (она)» */
  base: string;
  kasus: PronKasus;
  reflexive: boolean;
  answer: string;
  /** Formen-Modus: russische Entsprechung (nach der Prüfung gezeigt) */
  ru?: string;
  /** Satz-Modus: Satz mit ___, Begründung des Kasus, Übersetzung */
  de?: string;
  reason?: string;
  ruSentence?: string;
  /** vollständige Zeile der Person zum Einprägen, z.B. «du · dich · dir» */
  row: string;
};

const rowOf = (p: Person) => `${p.label}: ${p.akk} · ${p.dat}`;
const byLabel = (label: string) => {
  const p = PERSONS.find((x) => x.label === label);
  if (!p) throw new Error(`Unbekannte Person: ${label}`);
  return p;
};

// ── Formen: jede Person × Akk/Dat, plus Reflexiv (3. Person = immer «sich», daher nur einmal)
export const FORM_ITEMS: PronItem[] = [
  ...PERSONS.flatMap((p): PronItem[] => [
    { id: `f-${p.label}-akk`, base: p.label, kasus: 'Akkusativ', reflexive: false, answer: p.akk, ru: p.ruAkk, row: rowOf(p) },
    { id: `f-${p.label}-dat`, base: p.label, kasus: 'Dativ', reflexive: false, answer: p.dat, ru: p.ruDat, row: rowOf(p) },
  ]),
  ...PERSONS.filter((p) => ['ich', 'du', 'wir', 'ihr (вы)', 'er'].includes(p.label)).flatMap((p): PronItem[] => [
    { id: `r-${p.label}-akk`, base: p.label, kasus: 'Akkusativ', reflexive: true, answer: p.reflAkk, row: `${p.label}: ${p.reflAkk} · ${p.reflDat} (reflexiv)` },
    { id: `r-${p.label}-dat`, base: p.label, kasus: 'Dativ', reflexive: true, answer: p.reflDat, row: `${p.label}: ${p.reflAkk} · ${p.reflDat} (reflexiv)` },
  ]),
];

// ── Sätze: [Person, Kasus, reflexiv, Satz, Begründung, Übersetzung]
const S: [string, PronKasus, boolean, string, string, string][] = [
  // Akkusativ — Verben
  ['du', 'Akkusativ', false, 'Ich sehe ___ jeden Tag im Bus.', 'sehen + Akkusativ', 'Я вижу тебя каждый день в автобусе.'],
  ['ich', 'Akkusativ', false, 'Kannst du ___ morgen anrufen?', 'anrufen + Akkusativ (по-русски «позвонить мне», но в немецком Akk!)', 'Можешь позвонить мне завтра?'],
  ['ihr (вы)', 'Akkusativ', false, 'Wir besuchen ___ am Wochenende.', 'besuchen + Akkusativ', 'Мы навестим вас на выходных.'],
  ['er', 'Akkusativ', false, 'Ich frage ___ nach dem Weg.', 'fragen + Akkusativ (по-русски «спросить у него»)', 'Я спрошу у него дорогу.'],
  ['sie (она)', 'Akkusativ', false, 'Hast du ___ gestern gesehen?', 'sehen + Akkusativ', 'Ты видел её вчера?'],
  ['wir', 'Akkusativ', false, 'Die Kinder lieben ___ sehr.', 'lieben + Akkusativ', 'Дети очень нас любят.'],
  ['Sie (Вы)', 'Akkusativ', false, 'Entschuldigung, ich verstehe ___ nicht.', 'verstehen + Akkusativ', 'Извините, я Вас не понимаю.'],
  ['sie (они)', 'Akkusativ', false, 'Wir laden ___ zur Party ein.', 'einladen + Akkusativ', 'Мы приглашаем их на вечеринку.'],
  ['ich', 'Akkusativ', false, 'Der Lehrer hat ___ gelobt.', 'loben + Akkusativ', 'Учитель меня похвалил.'],
  ['du', 'Akkusativ', false, 'Ich brauche ___ dringend.', 'brauchen + Akkusativ', 'Ты мне срочно нужен.'],
  // Akkusativ — Präpositionen
  ['du', 'Akkusativ', false, 'Das Geschenk ist für ___.', 'für + Akkusativ', 'Этот подарок для тебя.'],
  ['er', 'Akkusativ', false, 'Ohne ___ gehe ich nicht.', 'ohne + Akkusativ', 'Без него я не пойду.'],
  ['ihr (вы)', 'Akkusativ', false, 'Wir haben nichts gegen ___.', 'gegen + Akkusativ', 'Мы ничего не имеем против вас.'],
  ['sie (она)', 'Akkusativ', false, 'Ich mache mir Sorgen um ___.', 'sich Sorgen machen um + Akkusativ', 'Я беспокоюсь о ней.'],
  ['Sie (Вы)', 'Akkusativ', false, 'Dieser Brief ist für ___.', 'für + Akkusativ', 'Это письмо для Вас.'],
  ['ich', 'Akkusativ', false, 'Er denkt oft an ___.', 'denken an + Akkusativ', 'Он часто думает обо мне.'],
  // Dativ — Verben
  ['ich', 'Dativ', false, 'Kannst du ___ helfen?', 'helfen + Dativ', 'Можешь мне помочь?'],
  ['du', 'Dativ', false, 'Ich danke ___ für alles.', 'danken + Dativ (по-русски «благодарю тебя», но в немецком Dat!)', 'Благодарю тебя за всё.'],
  ['er', 'Dativ', false, 'Das Buch gehört ___.', 'gehören + Dativ', 'Эта книга принадлежит ему.'],
  ['ihr (вы)', 'Dativ', false, 'Wie gefällt ___ die Stadt?', 'gefallen + Dativ', 'Как вам нравится город?'],
  ['sie (она)', 'Dativ', false, 'Ich antworte ___ morgen.', 'antworten + Dativ', 'Я отвечу ей завтра.'],
  ['wir', 'Dativ', false, 'Das Essen schmeckt ___ gut.', 'schmecken + Dativ', 'Еда нам нравится (вкусная).'],
  ['Sie (Вы)', 'Dativ', false, 'Ich glaube ___ nicht.', 'jemandem glauben + Dativ', 'Я Вам не верю.'],
  ['du', 'Dativ', false, 'Wir gratulieren ___ zum Geburtstag!', 'gratulieren + Dativ (по-русски «поздравляем тебя»)', 'Поздравляем тебя с днём рождения!'],
  ['ich', 'Dativ', false, 'Die Schuhe passen ___ nicht.', 'passen + Dativ', 'Эти туфли мне не подходят.'],
  ['sie (они)', 'Dativ', false, 'Kannst du ___ das Foto zeigen?', 'jemandem (Dat) etwas (Akk) zeigen', 'Можешь показать им фото?'],
  ['er', 'Dativ', false, 'Ich gebe ___ das Geld morgen zurück.', 'jemandem (Dat) etwas zurückgeben', 'Я верну ему деньги завтра.'],
  ['sie (она)', 'Dativ', false, 'Er schenkt ___ Blumen.', 'jemandem (Dat) etwas schenken', 'Он дарит ей цветы.'],
  ['ich', 'Dativ', false, 'Es tut ___ leid.', 'leidtun + Dativ', 'Мне жаль.'],
  ['du', 'Dativ', false, 'Wie geht es ___?', 'es geht + Dativ', 'Как у тебя дела?'],
  ['ihr (вы)', 'Dativ', false, 'Ich vertraue ___.', 'vertrauen + Dativ', 'Я вам доверяю.'],
  ['er', 'Dativ', false, 'Das ist ___ egal.', 'egal sein + Dativ', 'Ему всё равно.'],
  // Dativ — Präpositionen
  ['wir', 'Dativ', false, 'Kommst du mit ___?', 'mit + Dativ', 'Пойдёшь с нами?'],
  ['sie (они)', 'Dativ', false, 'Ich wohne zurzeit bei ___.', 'bei + Dativ', 'Я сейчас живу у них.'],
  ['du', 'Dativ', false, 'Ich habe von ___ geträumt.', 'von + Dativ', 'Мне снился ты.'],
  ['er', 'Dativ', false, 'Gehst du heute zu ___?', 'zu + Dativ', 'Ты сегодня пойдёшь к нему?'],
  ['er', 'Dativ', false, 'Aus ___ wird ein guter Arzt.', 'aus + Dativ', 'Из него выйдет хороший врач.'],
  ['Sie (Вы)', 'Dativ', false, 'Bitte, nach ___!', 'nach + Dativ', 'Пожалуйста, после Вас!'],
  // Reflexiv — Akkusativ (kein weiteres Objekt)
  ['ich', 'Akkusativ', true, 'Ich freue ___ auf den Urlaub.', 'sich freuen — reflexiv, Akkusativ', 'Я радуюсь предстоящему отпуску.'],
  ['du', 'Akkusativ', true, 'Du musst ___ beeilen!', 'sich beeilen — reflexiv, Akkusativ', 'Тебе нужно поторопиться!'],
  ['wir', 'Akkusativ', true, 'Wir treffen ___ um acht.', 'sich treffen — reflexiv, Akkusativ', 'Мы встречаемся в восемь.'],
  ['er', 'Akkusativ', true, 'Er interessiert ___ für Musik.', 'sich interessieren — 3. Person immer «sich»', 'Он интересуется музыкой.'],
  ['ihr (вы)', 'Akkusativ', true, 'Habt ihr ___ gut erholt?', 'sich erholen — reflexiv, Akkusativ', 'Вы хорошо отдохнули?'],
  // Reflexiv — Dativ (es gibt schon ein Akkusativ-Objekt)
  ['ich', 'Dativ', true, 'Ich wasche ___ die Hände.', 'reflexiv im Dativ, weil «die Hände» schon Akkusativ ist', 'Я мою руки.'],
  ['du', 'Dativ', true, 'Kannst du ___ das vorstellen?', 'sich (Dat) etwas vorstellen', 'Можешь себе это представить?'],
  ['ich', 'Dativ', true, 'Ich kaufe ___ ein neues Handy.', 'sich (Dat) etwas kaufen', 'Я куплю себе новый телефон.'],
  ['du', 'Dativ', true, 'Putz ___ die Zähne!', 'reflexiv im Dativ, weil «die Zähne» schon Akkusativ ist', 'Почисти зубы!'],
];

export const SENTENCE_ITEMS: PronItem[] = S.map(([label, kasus, reflexive, de, reason, ruSentence], i) => {
  const p = byLabel(label);
  const answer = reflexive ? (kasus === 'Akkusativ' ? p.reflAkk : p.reflDat) : (kasus === 'Akkusativ' ? p.akk : p.dat);
  return { id: `s-${i}`, base: label, kasus, reflexive, answer, de, reason, ruSentence, row: rowOf(p) };
});
