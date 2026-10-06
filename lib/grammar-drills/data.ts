/**
 * Daten für den Grammatik-Trainer (statisch, keine DB, kein Gemini).
 * Zwei Aufgabentypen:
 *  - build:  Satz aus Wörtern zusammensetzen (Wortstellung, Zeiten, Passiv …)
 *  - choice: Lücke ___ mit dem richtigen Wort füllen (Konjunktionen)
 * Kommas werden beim Vergleich ignoriert; `alts` enthält gleichwertige Varianten
 * (z.B. Satzanfang mit Zeitangabe oder Nebensatz zuerst).
 */

export type DrillTopic =
  | 'tenses'
  | 'passive'
  | 'conj'
  | 'wordorder'
  | 'modal'
  | 'konj2'
  | 'relative'
  | 'infzu';

export const DRILL_TOPICS: DrillTopic[] = ['tenses', 'passive', 'conj', 'wordorder', 'modal', 'konj2', 'relative', 'infzu'];

export type DrillItem = {
  id: string;
  topic: DrillTopic;
  kind: 'build' | 'choice';
  /** russische Aufgabe / Bedeutung */
  ru: string;
  /** build: fertiger Satz ohne Schlusszeichen; choice: Satz mit ___ */
  de: string;
  /** nur choice */
  answer?: string;
  options?: string[];
  /** gleichwertige Lösungen (build: ganze Sätze, choice: einzelne Wörter) */
  alts: string[];
  /** Begründung (nach der Prüfung gezeigt) */
  reason: string;
};

type Raw = Omit<DrillItem, 'id'>;

const B = (topic: DrillTopic, ru: string, de: string, reason: string, alts: string[] = []): Raw =>
  ({ topic, kind: 'build', ru, de, reason, alts });

const C = (ru: string, de: string, answer: string, options: string[], reason: string, alts: string[] = []): Raw =>
  ({ topic: 'conj', kind: 'choice', ru, de, answer, options, reason, alts });

// ── Zeiten ────────────────────────────────────────────────────────────────────
const TENSES: Raw[] = [
  B('tenses', 'Я купил хлеб.', 'Ich habe Brot gekauft', 'Perfekt: haben + Partizip II (Partizip — в конце)'),
  B('tenses', 'Мы вчера поехали в Берлин.', 'Wir sind gestern nach Berlin gefahren', 'Perfekt: глагол движения → sein + Partizip II', ['Gestern sind wir nach Berlin gefahren']),
  B('tenses', 'Он рано встал.', 'Er ist früh aufgestanden', 'Perfekt: aufstehen (смена состояния) → sein'),
  B('tenses', 'Она уже прочитала книгу.', 'Sie hat das Buch schon gelesen', 'Perfekt: haben + Partizip II', ['Sie hat schon das Buch gelesen']),
  B('tenses', 'Ты уже поел?', 'Hast du schon gegessen', 'Perfekt в вопросе: haben на первом месте, Partizip II в конце'),
  B('tenses', 'Я забыл ключ.', 'Ich habe den Schlüssel vergessen', 'Perfekt: haben + Partizip II (vergessen — без ge-, приставка ver-)'),
  B('tenses', 'Они приехали поздно.', 'Sie sind spät angekommen', 'Perfekt: ankommen → sein + angekommen'),
  B('tenses', 'Мы вчера смотрели фильм.', 'Wir haben gestern einen Film gesehen', 'Perfekt: haben + Partizip II', ['Gestern haben wir einen Film gesehen', 'Wir haben einen Film gestern gesehen']),
  B('tenses', 'Что ты делал вчера?', 'Was hast du gestern gemacht', 'Perfekt в вопросе с W-словом: Was + hast + du … + Partizip II', ['Was hast du gemacht gestern']),
  B('tenses', 'Я не спал всю ночь.', 'Ich habe die ganze Nacht nicht geschlafen', 'Perfekt: nicht перед Partizip II'),
  B('tenses', 'Он стал врачом.', 'Er ist Arzt geworden', 'Perfekt: werden → sein + geworden'),
  B('tenses', 'Она осталась дома.', 'Sie ist zu Hause geblieben', 'Perfekt: bleiben → sein'),
  B('tenses', 'Ты уже позвонил маме?', 'Hast du Mama schon angerufen', 'Perfekt: anrufen — отделяемая приставка, Partizip II = angerufen', ['Hast du schon Mama angerufen']),
  B('tenses', 'Мы только что приехали.', 'Wir sind gerade angekommen', 'Perfekt: ankommen → sein'),
  B('tenses', 'Вчера я был в кино.', 'Gestern war ich im Kino', 'Präteritum от sein (war) — в речи используется вместо Perfekt', ['Ich war gestern im Kino']),
  B('tenses', 'У меня было мало времени.', 'Ich hatte wenig Zeit', 'Präteritum от haben (hatte) — вместо Perfekt'),
  B('tenses', 'Она пошла домой.', 'Sie ging nach Hause', 'Präteritum: gehen → ging (сильный глагол)'),
  B('tenses', 'Мы жили в Мюнхене.', 'Wir wohnten in München', 'Präteritum слабого глагола: Stamm + -te + -n (wir wohnten)'),
  B('tenses', 'Раньше я часто играл в футбол.', 'Früher spielte ich oft Fußball', 'Präteritum: spielen → spielte (-te)', ['Ich spielte früher oft Fußball']),
  B('tenses', 'Он не мог прийти.', 'Er konnte nicht kommen', 'Präteritum модального глагола: können → konnte'),
  B('tenses', 'Мы хотели остаться дома.', 'Wir wollten zu Hause bleiben', 'Präteritum модального глагола: wollen → wollten'),
  B('tenses', 'Я должен был работать.', 'Ich musste arbeiten', 'Präteritum модального глагола: müssen → musste (без умлаута)'),
  B('tenses', 'Завтра я позвоню тебе.', 'Morgen werde ich dich anrufen', 'Futur I: werden (2-е место) + Infinitiv (в конце)', ['Ich werde dich morgen anrufen']),
  B('tenses', 'Он будет работать в Гамбурге.', 'Er wird in Hamburg arbeiten', 'Futur I: wird + Infinitiv в конце'),
  B('tenses', 'Мы будем ужинать в восемь.', 'Wir werden um acht zu Abend essen', 'Futur I: werden + Infinitiv (zu Abend essen — в конце)'),
  B('tenses', 'Тебе понравится.', 'Es wird dir gefallen', 'Futur I: wird + gefallen; gefallen требует Dativ (dir)'),
  B('tenses', 'Когда я пришёл, фильм уже начался.', 'Als ich kam, hatte der Film schon begonnen', 'Plusquamperfekt: hatte + Partizip II — действие, предшествующее другому прошлому', ['Der Film hatte schon begonnen, als ich kam']),
  B('tenses', 'Я уже ушёл, когда она позвонила.', 'Ich war schon gegangen, als sie anrief', 'Plusquamperfekt: gehen → war + gegangen; в Nebensatz — Präteritum (anrief)', ['Als sie anrief, war ich schon gegangen']),
  B('tenses', 'После того как он поел, он пошёл спать.', 'Nachdem er gegessen hatte, ging er schlafen', 'nachdem + Plusquamperfekt (hatte в конце), в главном — Präteritum', ['Er ging schlafen, nachdem er gegessen hatte']),
];

// ── Passiv ────────────────────────────────────────────────────────────────────
const PASSIVE: Raw[] = [
  B('passive', 'Хлеб покупается каждый день.', 'Das Brot wird jeden Tag gekauft', 'Vorgangspassiv Präsens: werden + Partizip II', ['Jeden Tag wird das Brot gekauft']),
  B('passive', 'Дом строят.', 'Das Haus wird gebaut', 'Passiv Präsens: wird + gebaut'),
  B('passive', 'Здесь говорят по-немецки.', 'Hier wird Deutsch gesprochen', 'Passiv Präsens: wird + gesprochen', ['Deutsch wird hier gesprochen']),
  B('passive', 'Письмо пишется.', 'Der Brief wird geschrieben', 'Passiv Präsens: wird + geschrieben'),
  B('passive', 'Двери открываются в восемь.', 'Die Türen werden um acht Uhr geöffnet', 'Passiv Präsens, Plural: werden + geöffnet', ['Um acht Uhr werden die Türen geöffnet']),
  B('passive', 'Ребёнка забирают из детсада.', 'Das Kind wird aus dem Kindergarten abgeholt', 'Passiv Präsens: abholen → abgeholt'),
  B('passive', 'Меня спросили.', 'Ich wurde gefragt', 'Passiv Präteritum: wurde + Partizip II'),
  B('passive', 'Дом был построен в 1990 году.', 'Das Haus wurde 1990 gebaut', 'Passiv Präteritum: wurde + gebaut', ['1990 wurde das Haus gebaut']),
  B('passive', 'Письмо было отправлено вчера.', 'Der Brief wurde gestern geschickt', 'Passiv Präteritum: wurde + geschickt', ['Gestern wurde der Brief geschickt']),
  B('passive', 'Нас пригласили на вечеринку.', 'Wir wurden zur Party eingeladen', 'Passiv Präteritum, wir → wurden; einladen → eingeladen'),
  B('passive', 'Мост был разрушен войной.', 'Die Brücke wurde vom Krieg zerstört', 'Исполнитель/причина в Passiv: von + Dativ (vom = von dem)'),
  B('passive', 'Книгу написал известный автор.', 'Das Buch wurde von einem bekannten Autor geschrieben', 'von + Dativ — тот, кто действует (von einem Autor)'),
  B('passive', 'Пациента прооперировал врач.', 'Der Patient wurde vom Arzt operiert', 'von + Dativ: vom Arzt'),
  B('passive', 'Письмо было отправлено.', 'Der Brief ist geschickt worden', 'Perfekt Passiv: sein + Partizip II + worden (не geworden!)'),
  B('passive', 'Дом был построен.', 'Das Haus ist gebaut worden', 'Perfekt Passiv: ist + gebaut + worden'),
  B('passive', 'Меня не предупредили.', 'Ich bin nicht gewarnt worden', 'Perfekt Passiv: bin + gewarnt + worden'),
  B('passive', 'Это нужно сделать сегодня.', 'Das muss heute gemacht werden', 'Passiv с модальным глаголом: Modalverb + Partizip II + werden (в конце)', ['Heute muss das gemacht werden']),
  B('passive', 'Окно можно открыть.', 'Das Fenster kann geöffnet werden', 'Modalverb + Partizip II + werden'),
  B('passive', 'Эту проблему нужно решить.', 'Dieses Problem muss gelöst werden', 'Modalverb + Partizip II + werden'),
  B('passive', 'Документы должны быть подписаны.', 'Die Dokumente müssen unterschrieben werden', 'müssen + Partizip II + werden'),
  B('passive', 'Об этом нельзя забывать.', 'Das darf nicht vergessen werden', 'darf nicht + Partizip II + werden'),
  B('passive', 'Дом будет построен.', 'Das Haus wird gebaut werden', 'Futur Passiv: wird + Partizip II + werden'),
  B('passive', 'Магазин закрыт.', 'Das Geschäft ist geschlossen', 'Zustandspassiv: sein + Partizip II — результат, а не процесс'),
  B('passive', 'Дверь закрыта.', 'Die Tür ist geschlossen', 'Zustandspassiv: ist + geschlossen (состояние)'),
  B('passive', 'Стол накрыт.', 'Der Tisch ist gedeckt', 'Zustandspassiv: ist + gedeckt'),
  B('passive', 'Здесь танцуют.', 'Hier wird getanzt', 'Безличный Passiv: нет подлежащего, werden + Partizip II', []),
  B('passive', 'Вчера много смеялись.', 'Gestern wurde viel gelacht', 'Безличный Passiv Präteritum: wurde + gelacht', []),
  B('passive', 'Мне помогли.', 'Mir wurde geholfen', 'helfen + Dativ: Dativ остаётся в Passiv (mir), подлежащего нет'),
  B('passive', 'Нам показали город.', 'Uns wurde die Stadt gezeigt', 'Dativ-объект остаётся (uns), Akkusativ становится подлежащим (die Stadt)', ['Die Stadt wurde uns gezeigt']),
];

// ── Konjunktionen: Lückentext ────────────────────────────────────────────────
const CONJ: Raw[] = [
  // Nebensatz-Konjunktionen (Verb am Ende)
  C('Я остаюсь дома, потому что я болен.', 'Ich bleibe zu Hause, ___ ich krank bin.', 'weil', ['weil', 'denn', 'dass', 'obwohl'], 'weil — Nebensatz: спрягаемый глагол в конце (krank bin)'),
  C('Я остаюсь дома, ведь я болен.', 'Ich bleibe zu Hause, ___ ich bin krank.', 'denn', ['weil', 'denn', 'dass', 'obwohl'], 'denn — Hauptsatz-Konjunktion: порядок слов прямой (ich bin), на «нулевой позиции»'),
  C('Я знаю, что он сегодня придёт.', 'Ich weiß, ___ er heute kommt.', 'dass', ['dass', 'ob', 'weil', 'wenn'], 'dass — «что» после глаголов знания/речи; глагол в конце'),
  C('Я не знаю, придёт ли он сегодня.', 'Ich weiß nicht, ___ er heute kommt.', 'ob', ['ob', 'dass', 'wenn', 'als'], 'ob — «ли», косвенный вопрос да/нет'),
  C('Если пойдёт дождь, мы останемся дома.', '___ es regnet, bleiben wir zu Hause.', 'Wenn', ['Wenn', 'Als', 'Obwohl', 'Bevor'], 'wenn — «если» (условие) и «когда» при повторении'),
  C('Когда я был ребёнком, я жил в Вене.', '___ ich ein Kind war, wohnte ich in Wien.', 'Als', ['Als', 'Wenn', 'Während', 'Bevor'], 'als — «когда» для однократного события в прошлом'),
  C('Каждый раз, когда я прихожу домой, я готовлю.', '___ ich nach Hause komme, koche ich.', 'Wenn', ['Wenn', 'Als', 'Obwohl', 'Damit'], 'wenn — повторяющееся действие («всякий раз, когда»)'),
  C('Хотя он устал, он пошёл на работу.', '___ er müde war, ging er zur Arbeit.', 'Obwohl', ['Obwohl', 'Weil', 'Damit', 'Wenn'], 'obwohl — «хотя» (уступка)'),
  C('Я говорю медленно, чтобы ты меня понял.', 'Ich spreche langsam, ___ du mich verstehst.', 'damit', ['damit', 'dass', 'weil', 'obwohl'], 'damit — «чтобы», когда в обеих частях разные подлежащие (ich / du)'),
  C('Пока я ем, я слушаю музыку.', '___ ich esse, höre ich Musik.', 'Während', ['Während', 'Bevor', 'Nachdem', 'Bis'], 'während — «пока/в то время как» (одновременность)'),
  C('Прежде чем уйти, позвони мне.', '___ du gehst, ruf mich an.', 'Bevor', ['Bevor', 'Nachdem', 'Während', 'Bis'], 'bevor — «прежде чем» (до события)'),
  C('После того как он поел, он пошёл гулять.', '___ er gegessen hatte, ging er spazieren.', 'Nachdem', ['Nachdem', 'Bevor', 'Während', 'Obwohl'], 'nachdem — «после того как» (обычно с Plusquamperfekt в Nebensatz)'),
  C('Подожди здесь, пока я не вернусь.', 'Warte hier, ___ ich zurückkomme.', 'bis', ['bis', 'während', 'wenn', 'bevor'], 'bis — «пока не», до наступления момента'),
  C('Если вдруг у тебя будет время, можешь мне помочь?', '___ du Zeit hast, kannst du mir helfen?', 'Falls', ['Falls', 'Obwohl', 'Weil', 'Bevor'], 'falls — «в случае, если», «если вдруг»'),
  C('Я позвоню, как только приеду.', 'Ich rufe dich an, ___ ich angekommen bin.', 'sobald', ['sobald', 'damit', 'obwohl', 'ob'], 'sobald — «как только»'),
  C('Он говорит, что у него нет времени.', 'Er sagt, ___ er keine Zeit hat.', 'dass', ['dass', 'ob', 'weil', 'damit'], 'dass после глагола речи (sagen)'),
  C('Она счастлива, потому что сдала экзамен.', 'Sie ist glücklich, ___ sie die Prüfung bestanden hat.', 'weil', ['weil', 'denn', 'dass', 'obwohl'], 'weil + глагол в конце (bestanden hat)'),
  C('Я спрашиваю себя, придёт ли она.', 'Ich frage mich, ___ sie kommt.', 'ob', ['ob', 'dass', 'wenn', 'weil'], 'ob — косвенный вопрос «ли»'),
  C('С тех пор как я живу в Берлине, я хорошо говорю по-немецки.', '___ ich in Berlin wohne, spreche ich gut Deutsch.', 'Seitdem', ['Seitdem', 'Als', 'Bevor', 'Damit'], 'seitdem / seit — «с тех пор как»', ['Seit']),
  // Hauptsatz-Konjunktionen: und, oder, aber, denn, sondern
  C('Я хочу кофе, но у меня нет денег.', 'Ich möchte Kaffee, ___ ich habe kein Geld.', 'aber', ['und', 'aber', 'sondern', 'oder'], 'aber — «но», противопоставление без отрицания-исправления'),
  C('Он не устал, а голоден.', 'Er ist nicht müde, ___ hungrig.', 'sondern', ['aber', 'sondern', 'denn', 'und'], 'sondern — «а», после отрицания: исправление (не A, а B)'),
  C('Ты хочешь чай или кофе?', 'Willst du Tee ___ Kaffee?', 'oder', ['und', 'oder', 'aber', 'sondern'], 'oder — «или»'),
  C('Я не иду в кино, потому что я устал.', 'Ich gehe nicht ins Kino, ___ ich bin müde.', 'denn', ['denn', 'aber', 'sondern', 'oder'], 'denn — «ведь, потому что», порядок слов прямой'),
  C('Он работает не в Мюнхене, а в Берлине.', 'Er arbeitet nicht in München, ___ in Berlin.', 'sondern', ['sondern', 'aber', 'denn', 'oder'], 'sondern — после nicht: исправление'),
  C('Она играет на гитаре и поёт.', 'Sie spielt Gitarre ___ singt dazu.', 'und', ['und', 'oder', 'aber', 'denn'], 'und — «и», соединяет равноправные части'),
  // Konjunktionaladverbien (Inversion: Verb direkt nach dem Adverb)
  C('Идёт дождь. Поэтому мы остаёмся дома.', 'Es regnet. ___ bleiben wir zu Hause.', 'Deshalb', ['Deshalb', 'Trotzdem', 'Außerdem', 'Sonst'], 'deshalb — «поэтому»; занимает первое место → глагол сразу после (bleiben wir)', ['Deswegen', 'Darum', 'Also']),
  C('Идёт дождь. Тем не менее мы идём гулять.', 'Es regnet. ___ gehen wir spazieren.', 'Trotzdem', ['Deshalb', 'Trotzdem', 'Außerdem', 'Sonst'], 'trotzdem — «тем не менее»; инверсия: gehen wir'),
  C('Мне нужно учиться. Кроме того, мне надо ещё сходить в магазин.', 'Ich muss lernen. ___ muss ich noch einkaufen.', 'Außerdem', ['Deshalb', 'Trotzdem', 'Außerdem', 'Sonst'], 'außerdem — «кроме того»; инверсия: muss ich'),
  C('Поторопись, иначе опоздаешь.', 'Beeil dich, ___ kommst du zu spät.', 'sonst', ['sonst', 'deshalb', 'trotzdem', 'dann'], 'sonst — «иначе»; инверсия: kommst du'),
  C('Сначала я поем, потом пойду спать.', 'Zuerst esse ich, ___ gehe ich schlafen.', 'dann', ['dann', 'sonst', 'trotzdem', 'weil'], 'dann — «потом»; инверсия: gehe ich', ['danach']),
  // Zweiteilige Konjunktionen
  C('Он говорит не только по-немецки, но и по-английски.', 'Er spricht nicht nur Deutsch, sondern ___ Englisch.', 'auch', ['auch', 'noch', 'nur', 'aber'], 'nicht nur … sondern auch — «не только … но и»'),
  C('Я возьму либо чай, либо кофе.', 'Ich nehme entweder Tee ___ Kaffee.', 'oder', ['und', 'oder', 'noch', 'als'], 'entweder … oder — «либо … либо»'),
  C('Она не любит ни рыбу, ни мясо.', 'Sie mag weder Fisch ___ Fleisch.', 'noch', ['oder', 'und', 'noch', 'sondern'], 'weder … noch — «ни … ни»'),
  C('Он умеет и петь, и танцевать.', 'Er kann sowohl singen ___ auch tanzen.', 'als', ['als', 'und', 'oder', 'noch'], 'sowohl … als auch — «как … так и»', ['wie']),
  C('С одной стороны, квартира красивая, с другой — слишком дорогая.', 'Einerseits ist die Wohnung schön, ___ ist sie zu teuer.', 'andererseits', ['andererseits', 'deshalb', 'sondern', 'denn'], 'einerseits … andererseits — «с одной стороны … с другой»'),
  C('Квартира хоть и красивая, но слишком дорогая.', 'Die Wohnung ist zwar schön, ___ sie ist zu teuer.', 'aber', ['aber', 'sondern', 'denn', 'weil'], 'zwar … aber — «хоть и … но»'),
];

// ── Wortstellung mit Konjunktionen: Satzbau ──────────────────────────────────
const WORDORDER: Raw[] = [
  B('wordorder', 'Я остаюсь дома, потому что я болен.', 'Ich bleibe zu Hause, weil ich krank bin', 'weil → Nebensatz: глагол (bin) в конце'),
  B('wordorder', 'Я знаю, что он сегодня придёт.', 'Ich weiß, dass er heute kommt', 'dass → Nebensatz: глагол в конце'),
  B('wordorder', 'Хотя идёт дождь, мы идём гулять.', 'Obwohl es regnet, gehen wir spazieren', 'Nebensatz первым → в главном глагол сразу на первом месте (gehen wir)', ['Wir gehen spazieren, obwohl es regnet']),
  B('wordorder', 'Если у тебя есть время, позвони мне.', 'Wenn du Zeit hast, ruf mich an', 'Nebensatz с wenn: hast в конце; в главном — повелительное наклонение', ['Ruf mich an, wenn du Zeit hast']),
  B('wordorder', 'Когда я был ребёнком, я жил в Вене.', 'Als ich ein Kind war, wohnte ich in Wien', 'als + Nebensatz (war в конце), затем глагол главного предложения', ['Ich wohnte in Wien, als ich ein Kind war']),
  B('wordorder', 'Я не знаю, придёт ли она.', 'Ich weiß nicht, ob sie kommt', 'ob → Nebensatz: глагол в конце'),
  B('wordorder', 'Он говорит медленно, чтобы мы его понимали.', 'Er spricht langsam, damit wir ihn verstehen', 'damit → Nebensatz: глагол в конце'),
  B('wordorder', 'Идёт дождь, поэтому мы остаёмся дома.', 'Es regnet, deshalb bleiben wir zu Hause', 'deshalb — наречие, стоит на первом месте → сразу глагол (bleiben wir)', []),
  B('wordorder', 'Он болен, но всё равно работает.', 'Er ist krank, aber er arbeitet trotzdem', 'aber — на нулевой позиции, порядок слов прямой', []),
  B('wordorder', 'Я голоден, ведь я не завтракал.', 'Ich habe Hunger, denn ich habe nicht gefrühstückt', 'denn — на нулевой позиции, порядок прямой (Perfekt: Partizip в конце)'),
  B('wordorder', 'Он не спит, а читает.', 'Er schläft nicht, sondern liest', 'sondern — после отрицания, на нулевой позиции'),
  B('wordorder', 'После того как мы поели, мы пошли гулять.', 'Nachdem wir gegessen hatten, gingen wir spazieren', 'nachdem + Plusquamperfekt в конце; затем Präteritum главного', ['Wir gingen spazieren, nachdem wir gegessen hatten']),
  B('wordorder', 'Пока я готовлю, ты можешь накрыть на стол.', 'Während ich koche, kannst du den Tisch decken', 'während → Nebensatz (koche в конце); в главном глагол первым', ['Du kannst den Tisch decken, während ich koche']),
  B('wordorder', 'Я жду, пока он придёт.', 'Ich warte, bis er kommt', 'bis → Nebensatz: глагол в конце'),
  B('wordorder', 'Если светит солнце, мы едем на озеро.', 'Wenn die Sonne scheint, fahren wir an den See', 'wenn + Nebensatz → глагол главного сразу после запятой', ['Wir fahren an den See, wenn die Sonne scheint']),
  B('wordorder', 'Я думаю, что он прав.', 'Ich denke, dass er recht hat', 'dass → hat в конце'),
  B('wordorder', 'Он сказал, что у него нет времени.', 'Er sagte, dass er keine Zeit hat', 'dass → hat в конце'),
  B('wordorder', 'Она не только умна, но и красива.', 'Sie ist nicht nur klug, sondern auch schön', 'nicht nur … sondern auch'),
  B('wordorder', 'Либо ты идёшь со мной, либо остаёшься дома.', 'Entweder kommst du mit, oder du bleibst zu Hause', 'entweder … oder; если entweder стоит первым — инверсия (kommst du)', ['Entweder du kommst mit, oder du bleibst zu Hause']),
  B('wordorder', 'Так как я устал, я не иду с вами.', 'Weil ich müde bin, gehe ich nicht mit', 'weil-Satz первым → глагол главного сразу после запятой', ['Ich gehe nicht mit, weil ich müde bin']),
  B('wordorder', 'Сначала мы поедим, потом пойдём гулять.', 'Zuerst essen wir, dann gehen wir spazieren', 'zuerst / dann — наречия на первом месте → инверсия', []),
  B('wordorder', 'Он сказал, что не сможет прийти.', 'Er sagte, dass er nicht kommen kann', 'dass-Satz с модальным глаголом: Infinitiv + kann в самом конце'),
];

// ── Modalverben ───────────────────────────────────────────────────────────────
const MODAL: Raw[] = [
  B('modal', 'Я должен сегодня работать.', 'Ich muss heute arbeiten', 'Modalverb на 2-м месте, Infinitiv в конце', ['Heute muss ich arbeiten']),
  B('modal', 'Ты можешь мне помочь?', 'Kannst du mir helfen', 'Вопрос: Modalverb первым, Infinitiv в конце'),
  B('modal', 'Мы хотим поехать в Италию.', 'Wir wollen nach Italien fahren', 'wollen + Infinitiv (без zu)'),
  B('modal', 'Здесь нельзя курить.', 'Hier darf man nicht rauchen', 'nicht dürfen — «нельзя»; man — безличное «нельзя/можно»', ['Man darf hier nicht rauchen']),
  B('modal', 'Вчера я не мог спать.', 'Gestern konnte ich nicht schlafen', 'Präteritum: konnte; Infinitiv в конце', ['Ich konnte gestern nicht schlafen']),
  B('modal', 'Он хотел позвонить тебе.', 'Er wollte dich anrufen', 'Präteritum: wollte + Infinitiv'),
  B('modal', 'Я знаю, что он должен прийти.', 'Ich weiß, dass er kommen muss', 'Nebensatz: Infinitiv + Modalverb в самом конце'),
  B('modal', 'Мы сегодня можем остаться дома.', 'Wir können heute zu Hause bleiben', 'können + Infinitiv (bleiben) в конце', ['Heute können wir zu Hause bleiben']),
  B('modal', 'Я хотел бы заказать кофе.', 'Ich möchte einen Kaffee bestellen', 'möchte + Infinitiv'),
  B('modal', 'Вам нужно подождать.', 'Sie müssen warten', 'müssen + Infinitiv'),
  B('modal', 'Ты должен больше спать.', 'Du sollst mehr schlafen', 'sollen — «следует/надо» (совет, требование другого)'),
  B('modal', 'Ребёнок не хочет есть.', 'Das Kind will nicht essen', 'ich/er/sie/es: will (wollen — неправильные формы ед. ч.)'),
];

// ── Konjunktiv II ─────────────────────────────────────────────────────────────
const KONJ2: Raw[] = [
  B('konj2', 'Если бы у меня было время, я бы поехал в Италию.', 'Wenn ich Zeit hätte, würde ich nach Italien fahren', 'Konjunktiv II: hätte (haben) в wenn-части, würde + Infinitiv в главной', ['Ich würde nach Italien fahren, wenn ich Zeit hätte']),
  B('konj2', 'Я бы хотел чашку кофе.', 'Ich hätte gern eine Tasse Kaffee', 'Вежливая просьба: hätte gern'),
  B('konj2', 'Если бы я был богат, я бы купил дом.', 'Wenn ich reich wäre, würde ich ein Haus kaufen', 'wäre (sein) в wenn-части, würde + Infinitiv', ['Ich würde ein Haus kaufen, wenn ich reich wäre']),
  B('konj2', 'Ты не мог бы мне помочь?', 'Könntest du mir helfen', 'Вежливая просьба: Konjunktiv II модального глагола (könntest)'),
  B('konj2', 'Я бы с удовольствием узнал, где он.', 'Ich würde gern wissen, wo er ist', 'würde + gern + Infinitiv; wo-Satz — глагол в конце', []),
  B('konj2', 'Было бы хорошо, если бы ты пришёл.', 'Es wäre schön, wenn du kommen würdest', 'wäre + wenn-Satz с würde + Infinitiv (kommen würdest — в конце)', []),
  B('konj2', 'На твоём месте я бы остался.', 'An deiner Stelle würde ich bleiben', 'Совет: An deiner Stelle + würde + Infinitiv'),
  B('konj2', 'Вы не могли бы открыть окно?', 'Könnten Sie das Fenster öffnen', 'Вежливая просьба: könnten Sie + Infinitiv в конце'),
  B('konj2', 'Я бы с радостью пришёл.', 'Ich würde gern kommen', 'würde + gern + Infinitiv', []),
  B('konj2', 'Я бы поехал, если бы у меня была машина.', 'Ich würde fahren, wenn ich ein Auto hätte', 'würde + Infinitiv; hätte в Nebensatz в конце', ['Wenn ich ein Auto hätte, würde ich fahren']),
  B('konj2', 'Если бы я не был болен, я бы пришёл.', 'Wenn ich nicht krank gewesen wäre, wäre ich gekommen', 'Прошедшее нереальное: wäre/hätte + Partizip II в обеих частях', ['Ich wäre gekommen, wenn ich nicht krank gewesen wäre']),
  B('konj2', 'Если бы вчера была хорошая погода, мы бы пошли гулять.', 'Wenn das Wetter gestern gut gewesen wäre, wären wir spazieren gegangen', 'Plusquamperfekt Konjunktiv: wäre gewesen / wären gegangen', ['Wenn gestern das Wetter gut gewesen wäre, wären wir spazieren gegangen']),
  B('konj2', 'Я хотел бы тебе помочь.', 'Ich würde dir gern helfen', 'würde + gern + Infinitiv; helfen + Dativ (dir)', ['Ich würde gern dir helfen']),
];

// ── Relativsätze ──────────────────────────────────────────────────────────────
const RELATIVE: Raw[] = [
  B('relative', 'Мужчина, который живёт рядом, — врач.', 'Der Mann, der nebenan wohnt, ist Arzt', 'Relativpronomen: род — как у существительного (der), падеж — по роли в Relativsatz (Nominativ); глагол в конце'),
  B('relative', 'Книга, которую я читаю, интересная.', 'Das Buch, das ich lese, ist interessant', 'das — род Buch (среднего рода), Akkusativ — das'),
  B('relative', 'Женщина, которой я помог, благодарна.', 'Die Frau, der ich geholfen habe, ist dankbar', 'helfen + Dativ → Relativpronomen в Dativ: der (женский род)'),
  B('relative', 'Я знаю мужчину, которого ты видел.', 'Ich kenne den Mann, den du gesehen hast', 'Maskulin Akkusativ → den'),
  B('relative', 'Девочка, которая живёт здесь, моя соседка.', 'Das Mädchen, das hier wohnt, ist meine Nachbarin', 'Mädchen — среднего рода → das'),
  B('relative', 'Фильм, который мы вчера смотрели, был скучный.', 'Der Film, den wir gestern gesehen haben, war langweilig', 'Maskulin Akkusativ → den; haben в конце Relativsatz'),
  B('relative', 'Это друг, с которым я работаю.', 'Das ist der Freund, mit dem ich arbeite', 'mit + Dativ → mit dem (Maskulin)'),
  B('relative', 'Город, в котором я живу, маленький.', 'Die Stadt, in der ich wohne, ist klein', 'in + Dativ (wo?) → in der (женский род)'),
  B('relative', 'Дети, которым я помогаю, милые.', 'Die Kinder, denen ich helfe, sind nett', 'Dativ Plural → denen'),
  B('relative', 'Ключ, который я искал, лежит здесь.', 'Der Schlüssel, den ich gesucht habe, liegt hier', 'Akkusativ Maskulin → den'),
  B('relative', 'Дом, в котором мы живём, старый.', 'Das Haus, in dem wir wohnen, ist alt', 'in + Dativ, среднего рода → in dem'),
  B('relative', 'Люди, которых я знаю, живут в Берлине.', 'Die Leute, die ich kenne, wohnen in Berlin', 'Plural Akkusativ → die'),
  B('relative', 'Это женщина, чью сумку я нашёл.', 'Das ist die Frau, deren Tasche ich gefunden habe', 'Генитив: deren (владелец — женский род/мн. ч.)'),
];

// ── Infinitiv mit zu ──────────────────────────────────────────────────────────
const INFZU: Raw[] = [
  B('infzu', 'Я надеюсь скоро тебя увидеть.', 'Ich hoffe, dich bald zu sehen', 'hoffen + Infinitiv mit zu; zu прямо перед глаголом в конце'),
  B('infzu', 'Важно каждый день учиться.', 'Es ist wichtig, jeden Tag zu lernen', 'Es ist wichtig + Infinitiv mit zu'),
  B('infzu', 'Я иду в магазин, чтобы купить хлеб.', 'Ich gehe in den Laden, um Brot zu kaufen', 'um … zu + Infinitiv — «чтобы» (цель, то же подлежащее)', ['Um Brot zu kaufen, gehe ich in den Laden']),
  B('infzu', 'Он ушёл, не сказав ни слова.', 'Er ging, ohne ein Wort zu sagen', 'ohne … zu + Infinitiv — «без того чтобы»'),
  B('infzu', 'Вместо того чтобы спать, он играет.', 'Anstatt zu schlafen, spielt er', 'anstatt … zu + Infinitiv', ['Er spielt, anstatt zu schlafen']),
  B('infzu', 'У меня нет желания работать.', 'Ich habe keine Lust zu arbeiten', 'Lust haben + zu + Infinitiv'),
  B('infzu', 'Я забыл тебе позвонить.', 'Ich habe vergessen, dich anzurufen', 'У отделяемых приставок zu встаёт между приставкой и корнем: an-zu-rufen'),
  B('infzu', 'Начинается дождь.', 'Es fängt an zu regnen', 'anfangen + zu: приставка в конце (an), zu перед Infinitiv'),
  B('infzu', 'Я пытаюсь выучить слова.', 'Ich versuche, die Wörter zu lernen', 'versuchen + Infinitiv с zu', []),
  B('infzu', 'Он боится быть один.', 'Er hat Angst, allein zu sein', 'Angst haben + zu + Infinitiv (zu sein)'),
  B('infzu', 'Он помог мне переехать.', 'Er hat mir geholfen, umzuziehen', 'um-zu-ziehen → umzuziehen (zu внутри глагола)'),
  B('infzu', 'Она предложила пойти в кино.', 'Sie hat vorgeschlagen, ins Kino zu gehen', 'vorschlagen + Infinitiv с zu; zu перед gehen'),
];

const RAW: Raw[] = [...TENSES, ...PASSIVE, ...CONJ, ...WORDORDER, ...MODAL, ...KONJ2, ...RELATIVE, ...INFZU];

const counters: Record<string, number> = {};
export const DRILL_ITEMS: DrillItem[] = RAW.map((r) => {
  // choice-Aufgaben zählen separat, damit IDs stabil bleiben (Fehlerstatistik hängt an der ID)
  const key = `${r.topic}-${r.kind}`;
  counters[key] = (counters[key] ?? 0) + 1;
  return { ...r, id: `${r.topic}-${r.kind}-${counters[key]}` };
});

export function itemsFor(topic: DrillTopic | 'all'): DrillItem[] {
  return topic === 'all' ? DRILL_ITEMS : DRILL_ITEMS.filter((i) => i.topic === topic);
}
