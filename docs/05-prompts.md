# 05 — Промты Gemini

Все промты к Gemini хранятся в `lib/gemini/prompts.ts`. Каждый промт состоит из:
1. **System instruction** — задаёт роль и правила.
2. **User content** — текст + изображение (если нужно).
3. **responseSchema** — JSON Schema для structured output.

Модель: `gemini-2.0-flash-exp`. Температура: 0.3 для извлечения (нужна точность), 0.7 для генерации примеров (нужно разнообразие).

---

## Промт 1 — Извлечение со скрина (`extract`)

Используется в `POST /api/extract`.

### System instruction

```
Ты — опытный преподаватель немецкого языка, который помогает русскоязычному студенту уровня A2-B1 учить язык по скриншотам страниц учебника.

ЗАДАЧА: распознай немецкий текст на изображении и извлеки из него учебный материал.

Из присланного скриншота извлеки:
1. ВСЕ полезные для запоминания немецкие слова с переводом на русский.
2. Устойчивые фразы и коллокации (например, "auf jeden Fall", "es geht um", "Recht haben").
3. Грамматические правила, если они есть на странице — с переводом объяснения на русский.
4. Примеры-предложения из текста (берись только те, что реально есть на скрине).

ПРАВИЛА ИЗВЛЕЧЕНИЯ:

Для существительных ОБЯЗАТЕЛЬНО указывай:
- род: der / die / das
- форму множественного числа (если её можно определить)
Пример: { "de": "die Möglichkeit", "ru": "возможность", "word_type": "noun", "gender": "die", "plural": "die Möglichkeiten" }

Для глаголов ОБЯЗАТЕЛЬНО указывай:
- инфинитив, претеритум, партицип II
- вспомогательный глагол (haben или sein) для образования перфекта
- является ли глагол отделяемым (trennbar)
- предложное управление, если оно типичное (warten auf + Akk, denken an + Akk)
Пример: { "de": "gehen", "ru": "идти", "word_type": "verb", "forms": { "infinitiv": "gehen", "praeteritum": "ging", "partizip_2": "gegangen", "hilfsverb": "sein", "trennbar": false } }

Для прилагательных указывай степени сравнения, если они нестандартные.

Уровень слова (level): оценивай по шкале A1/A2/B1/B2/C1. Если не уверен — оставь пустым.

ЧТО НЕ ВКЛЮЧАТЬ:
- Очевидные служебные слова (артикли der/die/das/ein/eine/kein сами по себе, союзы und/oder/aber, частицы), если они не несут учебной ценности в контексте.
- Имена собственные и географические названия (если они не часть лексической темы).
- Числительные 1-12 и базовые местоимения (ich, du, er, sie...).

ЧЕГО ИЗБЕГАТЬ:
- НЕ выдумывай слова, которых нет на скрине.
- НЕ переводи слово, если не уверен в значении в данном контексте.
- НЕ дублируй одинаковые слова — если одно и то же слово встречается несколько раз, добавляй один раз.

ЕСЛИ СКРИН НЕЧИТАЕМ:
- Если на изображении нет немецкого текста или он не распознаётся — верни пустые массивы и заполни поле `error` с объяснением на русском.

ФОРМАТ ОТВЕТА: строго JSON по предоставленной схеме. Никакого markdown, никаких пояснений вне JSON.
```

### responseSchema

```json
{
  "type": "object",
  "properties": {
    "summary": {
      "type": "string",
      "description": "Краткая (1-2 предложения) тема страницы на русском"
    },
    "words": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "de": { "type": "string" },
          "ru": { "type": "string" },
          "word_type": {
            "type": "string",
            "enum": ["noun", "verb", "adj", "adv", "prep", "conj", "pron", "num", "interj", "other"]
          },
          "gender": { "type": "string", "enum": ["der", "die", "das", ""] },
          "plural": { "type": "string" },
          "forms": { "type": "object" },
          "level": { "type": "string" }
        },
        "required": ["de", "ru", "word_type"]
      }
    },
    "phrases": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "de": { "type": "string" },
          "ru": { "type": "string" },
          "level": { "type": "string" }
        },
        "required": ["de", "ru"]
      }
    },
    "grammar": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "explanation_md": { "type": "string" },
          "examples": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "de": { "type": "string" },
                "ru": { "type": "string" }
              },
              "required": ["de", "ru"]
            }
          }
        },
        "required": ["title", "explanation_md"]
      }
    },
    "sentences": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "de": { "type": "string" },
          "ru": { "type": "string" }
        },
        "required": ["de", "ru"]
      }
    },
    "error": { "type": "string" }
  },
  "required": ["summary", "words", "phrases", "grammar", "sentences"]
}
```

### Параметры вызова

```ts
{
  model: "gemini-2.0-flash-exp",
  generationConfig: {
    temperature: 0.3,
    responseMimeType: "application/json",
    responseSchema: extractSchema,
    maxOutputTokens: 8192
  },
  contents: [
    {
      role: "user",
      parts: [
        { text: "Извлеки учебный материал со скрина." },
        { inlineData: { mimeType: "image/webp", data: base64Image } }
      ]
    }
  ]
}
```

---

## Промт 2 — Обогащение карты (`enrich`)

Используется в `POST /api/cards/:id/enrich`.

### System instruction

```
Ты — преподаватель немецкого. Для конкретного слова или фразы создай учебный материал для русскоязычного студента уровня A2-B1.

Задачи:
1. ПРИМЕРЫ: 3 предложения с этим словом — разных уровней (A2, B1, B2). Каждый пример переведи на русский естественным языком (не пословно).
2. КОЛЛОКАЦИИ: 2 устойчивых сочетания с этим словом (если они есть). Перевод на русский.
3. МНЕМОНИКА: 1 предложение на русском — образная ассоциация, помогающая запомнить слово. Используй созвучие, визуальные образы, личные истории.
4. СИНОНИМЫ: до 3 синонимов на немецком с пометкой стилистического оттенка (formal, umgangssprachlich, gehoben).
5. АНТОНИМЫ: до 3 антонимов.

Если для слова какая-то категория не применима (например, для предлогов нет коллокаций в обычном смысле) — оставляй массив пустым.

Формат ответа — строгий JSON по схеме.
```

### User content (пример)

```
Слово: "die Möglichkeit"
Тип: noun
Род: die
Базовый перевод: возможность
```

### responseSchema

```json
{
  "type": "object",
  "properties": {
    "examples": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "de": { "type": "string" },
          "ru": { "type": "string" },
          "level": { "type": "string", "enum": ["A1", "A2", "B1", "B2", "C1"] }
        },
        "required": ["de", "ru", "level"]
      }
    },
    "collocations": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "de": { "type": "string" },
          "ru": { "type": "string" }
        },
        "required": ["de", "ru"]
      }
    },
    "mnemonic": { "type": "string" },
    "synonyms": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "de": { "type": "string" },
          "register": { "type": "string", "enum": ["neutral", "formal", "umgangssprachlich", "gehoben"] }
        },
        "required": ["de"]
      }
    },
    "antonyms": {
      "type": "array",
      "items": { "type": "object", "properties": { "de": { "type": "string" } }, "required": ["de"] }
    }
  },
  "required": ["examples", "collocations", "mnemonic", "synonyms", "antonyms"]
}
```

### Параметры вызова

```ts
{
  model: "gemini-2.0-flash-exp",
  generationConfig: {
    temperature: 0.7,
    responseMimeType: "application/json",
    responseSchema: enrichSchema
  }
}
```

---

## Политика retry и обработки ошибок

```ts
async function callGemini(args) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await gemini.generateContent(args);
      const parsed = JSON.parse(result.response.text());
      const validated = schema.parse(parsed);  // zod
      return validated;
    } catch (e) {
      if (e instanceof zod.ZodError && attempt < 2) {
        continue;
      }
      if (e.status === 429) {
        await sleep(5000);
        continue;
      }
      if (attempt === 2) throw e;
    }
  }
}
```

- **JSON parse error** → 1 retry с явной подсказкой "верни ТОЛЬКО валидный JSON".
- **Rate limit 429** → wait 5 сек, max 2 retry.
- **Timeout >30 сек** → ошибка пользователю с предложением попробовать снова.
- **Validation error (zod)** → 1 retry. Если опять — фоллбек на упрощённую схему без `forms` и `grammar`.

---

## Кеширование

Перед каждым вызовом `extract`:
```sql
select raw_extract from sources where image_hash = $1;
```
Если есть — возвращаем кеш, экономим квоту Gemini.

Для `enrich` кеш не нужен — пользователь может явно перегенерировать.

---

## Метрики использования

В консоли логировать каждый вызов Gemini:
- model name
- token counts (input/output)
- latency
- success/error

Раз в день в Vercel logs видно сколько вызовов было — следить за приближением к лимиту 1500/день.

---

## Дальше

- [06 — Frontend](06-frontend.md): UI, страницы, PWA.
