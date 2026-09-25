import 'server-only';
import { SchemaType, type ResponseSchema } from '@google/generative-ai';
import { z } from 'zod';

export const EXTRACT_SYSTEM_PROMPT = `
Ты — опытный преподаватель немецкого языка, который помогает русскоязычному студенту уровня A2-B1 учить язык по скриншотам страниц учебника.

ЗАДАЧА: распознай немецкий текст на изображении и извлеки из него учебный материал.

Из присланного скриншота извлеки:
1. ВСЕ полезные для запоминания немецкие слова с переводом на русский.
2. Устойчивые фразы и коллокации (например, "auf jeden Fall", "es geht um").
3. Грамматические правила, если они есть на странице, с переводом объяснения на русский.
4. Примеры-предложения из текста (только те, что реально есть на скрине).

ПРАВИЛА:

Для существительных ОБЯЗАТЕЛЬНО указывай:
- gender: "der" / "die" / "das"
- plural: форма множественного числа, если её можно определить

Для глаголов в forms укажи:
- infinitiv, praesens (3-е лицо), praeteritum, partizip_2
- hilfsverb ("haben" или "sein")
- trennbar (true/false) — отделяемый ли
- если у глагола есть фиксированный предлог (warten auf, denken an) — praeposition ("auf") и kasus ("Akkusativ"/"Dativ"/"Genitiv"); иначе оставь пустыми

Для прилагательных в forms укажи komparativ и superlativ, если они нестандартные.

Уровень слова (level): оценивай по шкале A1/A2/B1/B2/C1. Если не уверен — оставь пустым.

ТАБЛИЦЫ ГЛАГОЛЬНОГО УПРАВЛЕНИЯ (Verben mit Präposition, напр. «warten auf», «denken an»):
- Создавай ОДНУ карту-глагол (de = инфинитив без предлога, напр. «warten»), а предлог и падеж клади в forms.praeposition ("auf") и forms.kasus ("Akkusativ"/"Dativ"/"Genitiv").
- НЕ создавай отдельную карту для «глагол + предлог» («warten auf») и НЕ создавай отдельные слова для самих предлогов (auf, an, für…).
- Если у одного глагола несколько предлогов с разным значением (sich freuen auf/über) — отдельная карта-глагол на каждый предлог.

ЧТО НЕ ВКЛЮЧАТЬ:
- Очевидные служебные слова (der/die/das/ein/eine как артикли, союзы und/oder/aber, ich/du/er/sie).
- Отдельные предлоги (auf, an, in, für, um…) как самостоятельные слова.
- Имена людей (Paul, Susanne, Herr Kohl) и названия фирм/брендов (BMW, Siemens) — НИКОГДА, даже если они встречаются в примерах.
- Географические названия (Hamburg, Berlin) — только если сама тема страницы про страны/города.
- Слова, которые встречаются ТОЛЬКО в примерах-предложениях и не относятся к теме страницы (если тема — глаголы с предлогами, не выписывай Kaffee, Musik, Chef из примеров).

ЧЕГО ИЗБЕГАТЬ:
- Не выдумывай слова, которых нет на скрине.
- Не дублируй одинаковые слова (в т.ч. глагол отдельно и глагол+предлог).

ЕСЛИ СКРИН НЕЧИТАЕМ или не содержит немецкого: верни пустые массивы и заполни поле error с объяснением на русском.

Возвращай строго JSON по схеме.
`.trim();

/**
 * Schema для Gemini responseSchema. Использует enum SchemaType,
 * это специфичный для Google формат (НЕ полный JSON Schema).
 */
export const extractResponseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: { type: SchemaType.STRING, description: 'Краткая тема страницы на русском (1-2 предложения)' },
    words: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          de: { type: SchemaType.STRING },
          ru: { type: SchemaType.STRING },
          word_type: {
            type: SchemaType.STRING,
            description: 'noun | verb | adj | adv | prep | conj | pron | num | interj | other',
          },
          gender: { type: SchemaType.STRING, description: 'der | die | das | "" (для не-существительных)' },
          plural: { type: SchemaType.STRING },
          forms: {
            type: SchemaType.OBJECT,
            description: 'Свободная форма: для глаголов {infinitiv, praesens, praeteritum, partizip_2, hilfsverb, trennbar, praeposition, kasus}; для прилаг. {komparativ, superlativ}',
            properties: {
              infinitiv: { type: SchemaType.STRING },
              praesens: { type: SchemaType.STRING },
              praeteritum: { type: SchemaType.STRING },
              partizip_2: { type: SchemaType.STRING },
              hilfsverb: { type: SchemaType.STRING },
              trennbar: { type: SchemaType.BOOLEAN },
              praeposition: { type: SchemaType.STRING, description: 'Feste Präposition des Verbs (z.B. "auf" bei warten auf). Sonst leer.' },
              kasus: { type: SchemaType.STRING, description: 'Kasus der Präposition: Akkusativ | Dativ | Genitiv. Sonst leer.' },
              komparativ: { type: SchemaType.STRING },
              superlativ: { type: SchemaType.STRING },
            },
          },
          level: { type: SchemaType.STRING },
        },
        required: ['de', 'ru', 'word_type'],
      },
    },
    phrases: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          de: { type: SchemaType.STRING },
          ru: { type: SchemaType.STRING },
          level: { type: SchemaType.STRING },
        },
        required: ['de', 'ru'],
      },
    },
    grammar: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          explanation_md: { type: SchemaType.STRING, description: 'Объяснение на русском, markdown' },
          examples: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                de: { type: SchemaType.STRING },
                ru: { type: SchemaType.STRING },
              },
              required: ['de', 'ru'],
            },
          },
        },
        required: ['title', 'explanation_md'],
      },
    },
    sentences: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          de: { type: SchemaType.STRING },
          ru: { type: SchemaType.STRING },
        },
        required: ['de', 'ru'],
      },
    },
    error: { type: SchemaType.STRING },
  },
  required: ['summary', 'words', 'phrases', 'grammar', 'sentences'],
};

/**
 * Zod schema для валидации ответа Gemini после JSON.parse.
 * Чуть строже / более permissive чем Gemini schema.
 */
const wordSchema = z.object({
  de: z.string().min(1),
  ru: z.string().min(1),
  word_type: z.string().default('other'),
  gender: z.string().optional().default(''),
  plural: z.string().optional().default(''),
  forms: z
    .object({
      infinitiv: z.string().optional(),
      praesens: z.string().optional(),
      praeteritum: z.string().optional(),
      partizip_2: z.string().optional(),
      hilfsverb: z.string().optional(),
      trennbar: z.boolean().optional(),
      praeposition: z.string().optional(),
      kasus: z.string().optional(),
      komparativ: z.string().optional(),
      superlativ: z.string().optional(),
    })
    .partial()
    .optional(),
  level: z.string().optional().default(''),
});

const phraseSchema = z.object({
  de: z.string().min(1),
  ru: z.string().min(1),
  level: z.string().optional().default(''),
});

const exampleSchema = z.object({
  de: z.string().min(1),
  ru: z.string().min(1),
});

const grammarSchema = z.object({
  title: z.string().min(1),
  explanation_md: z.string().min(1),
  examples: z.array(exampleSchema).optional().default([]),
});

export const extractPayloadSchema = z.object({
  summary: z.string().default(''),
  words: z.array(wordSchema).default([]),
  phrases: z.array(phraseSchema).default([]),
  grammar: z.array(grammarSchema).default([]),
  sentences: z.array(exampleSchema).default([]),
  error: z.string().optional(),
});

export type ExtractPayload = z.infer<typeof extractPayloadSchema>;
export type ExtractedWord = z.infer<typeof wordSchema>;
export type ExtractedPhrase = z.infer<typeof phraseSchema>;
export type ExtractedGrammar = z.infer<typeof grammarSchema>;
export type ExtractedSentence = z.infer<typeof exampleSchema>;
