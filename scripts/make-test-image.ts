/**
 * Генерирует тестовое изображение "страница учебника" для smoke-тестов.
 * Запуск: npx tsx scripts/make-test-image.ts
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="1500" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white"/>
  <style>
    .h1 { font: bold 38px Arial, sans-serif; }
    .h2 { font: bold 26px Arial, sans-serif; }
    .body { font: 22px Arial, sans-serif; }
    .small { font: 18px Arial, sans-serif; fill: #555; }
  </style>

  <text x="60" y="80" class="h1">Lektion 5: Wohnen und leben</text>

  <text x="60" y="160" class="h2">Wortschatz</text>
  <text x="60" y="200" class="body">die Wohnung, -en — квартира</text>
  <text x="60" y="240" class="body">das Haus, Häuser — дом</text>
  <text x="60" y="280" class="body">der Mietvertrag, -träge — договор аренды</text>
  <text x="60" y="320" class="body">die Nachbarin, -nen — соседка</text>
  <text x="60" y="360" class="body">mieten — снимать (квартиру)</text>
  <text x="60" y="400" class="body">umziehen, zog um, ist umgezogen — переезжать</text>
  <text x="60" y="440" class="body">gemütlich — уютный</text>

  <text x="60" y="540" class="h2">Grammatik: Lokalpräpositionen mit Dativ</text>
  <text x="60" y="580" class="body">Vorpositionen in, an, auf, unter, hinter, neben, zwischen,</text>
  <text x="60" y="610" class="body">vor, über требуют Dativ при ответе на вопрос "wo?".</text>
  <text x="60" y="660" class="body">in + dem = im,  an + dem = am</text>

  <text x="60" y="760" class="h2">Beispiele</text>
  <text x="60" y="800" class="body">Ich wohne in einer kleinen Wohnung im Zentrum.</text>
  <text x="60" y="840" class="body">Das Buch liegt auf dem Tisch.</text>
  <text x="60" y="880" class="body">Meine Nachbarin ist sehr nett.</text>
  <text x="60" y="920" class="body">Letztes Jahr sind wir nach Berlin umgezogen.</text>

  <text x="60" y="1020" class="h2">Redewendungen</text>
  <text x="60" y="1060" class="body">sich wohlfühlen — чувствовать себя комфортно</text>
  <text x="60" y="1100" class="body">zu Hause sein — быть дома</text>
  <text x="60" y="1140" class="body">auf jeden Fall — в любом случае</text>

  <text x="60" y="1450" class="small">Aus dem Lehrbuch Deutsch A2-B1, Kapitel 5</text>
</svg>`;

async function main() {
  const out = await sharp(Buffer.from(svg)).png({ quality: 90 }).toBuffer();
  const path = join(process.cwd(), 'scripts', 'test-image.png');
  writeFileSync(path, out);
  console.log(`✅ Создано тестовое изображение: ${path} (${out.length} байт)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
