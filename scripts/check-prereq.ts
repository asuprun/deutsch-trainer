/**
 * Проверка предусловий для Sprint 2:
 *  - Storage bucket 'sources' существует
 *  - Gemini API key работает, и модель отвечает с structured JSON output
 *
 * Запуск: npx tsx scripts/check-prereq.ts
 */
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function loadEnv() {
  const text = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

loadEnv();

async function checkBucket() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await sb.storage.listBuckets();
  if (error) {
    console.log(`❌ Storage list: ${error.message}`);
    return false;
  }
  const found = data.find((b) => b.name === 'sources');
  if (!found) {
    console.log(`❌ Bucket 'sources' не найден. Buckets: ${data.map((b) => b.name).join(', ') || '(empty)'}`);
    return false;
  }
  console.log(`✅ Bucket 'sources' существует (public=${found.public})`);
  return true;
}

const MODELS_TO_TRY = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-flash'];

async function checkGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('❌ GEMINI_API_KEY не задан');
    return null;
  }
  const genai = new GoogleGenerativeAI(apiKey);

  for (const modelName of MODELS_TO_TRY) {
    try {
      const model = genai.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              translation: { type: SchemaType.STRING },
            },
            required: ['translation'],
          },
          temperature: 0.1,
        },
      });
      const t0 = Date.now();
      const res = await model.generateContent(
        'Переведи на русский немецкое слово "Möglichkeit". Верни JSON.',
      );
      const text = res.response.text();
      const json = JSON.parse(text);
      const latency = Date.now() - t0;
      console.log(`✅ Gemini model="${modelName}" работает (${latency}ms), output: ${JSON.stringify(json)}`);
      return modelName;
    } catch (e: any) {
      console.log(`   ✗ ${modelName}: ${e?.message?.slice(0, 120) ?? e}`);
    }
  }
  console.log('❌ Ни одна модель Gemini не отвечает');
  return null;
}

async function main() {
  console.log('=== Sprint 2 prerequisites ===\n');
  const bucketOk = await checkBucket();
  const workingModel = await checkGemini();
  console.log('');
  if (bucketOk && workingModel) {
    console.log(`🎉 Всё готово. Используем модель: ${workingModel}`);
    process.exit(0);
  } else {
    if (!bucketOk) console.log('→ Создай Storage bucket "sources" в Supabase Dashboard.');
    if (!workingModel) console.log('→ Проверь GEMINI_API_KEY на aistudio.google.com.');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('❌ Непредвиденная ошибка:', e);
  process.exit(1);
});
