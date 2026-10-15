// Самопроверка парсера: npm run script -- lib/import/parse-wordlist.check.ts
import assert from 'node:assert';
import { parseWordList } from './parse-wordlist';

const md = `| Deutsch | Russisch | Beispielsatz |
|---|---|---|
| der Drucker, - | принтер | Der Drucker druckt nicht. |
| sich kümmern um + Akk | заботиться о | Ich kümmere mich um den Server. |`;
const a = parseWordList(md);
assert.equal(a.sep, '|'); assert.equal(a.rows.length, 2);
assert.deepEqual(a.rows[0], { front: 'der Drucker, -', back: 'принтер', example: 'Der Drucker druckt nicht.', tags: [] });

const plain = parseWordList('Hund | собака\ngehen | идти | Ich gehe nach Hause.');
assert.equal(plain.rows.length, 2); assert.equal(plain.rows[1].example, 'Ich gehe nach Hause.');

const anki = parseWordList('#separator:tab\nHund\tсобака\tnoun::A1\ngehen\tидти');
assert.equal(anki.sep, '\t'); assert.deepEqual(anki.rows[0].tags, ['noun', 'A1']); assert.equal(anki.rows[0].example, '');

assert.equal(parseWordList('Deutsch | немецкий язык\nDeutsch | немецкий').rows.length, 1);
console.log('parse-wordlist ok');
