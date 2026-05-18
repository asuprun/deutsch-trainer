# 04 — API

Все endpoints — это Next.js route handlers в `app/api/*/route.ts`. Все защищены password middleware, кроме `/api/auth/login`.

## Соглашения

- **Формат:** JSON (исключение — `/api/extract` принимает `multipart/form-data`).
- **Коды ошибок:**
  - `401` — не аутентифицирован (нет или невалидный cookie).
  - `400` — ошибка валидации (zod вернул ошибку).
  - `404` — ресурс не найден.
  - `422` — семантическая ошибка (например, Gemini вернул `error` в JSON).
  - `429` — превышен rate limit.
  - `500` — внутренняя ошибка сервера.
- **Тело ошибки:**
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "...", "details": {...} } }
  ```
- **Аутентификация:** cookie `auth=<token>`, HttpOnly, Secure, SameSite=Lax.

---

## Аутентификация

### `POST /api/auth/login`

Вход в приложение.

**Request:**
```json
{ "password": "..." }
```

**Response 200:**
```json
{ "ok": true }
```
Устанавливает cookie `auth=<token>` (HttpOnly, 30 дней TTL).

**Response 401:** `{ "error": { "code": "INVALID_PASSWORD" } }`

### `POST /api/auth/logout`

**Response 200:** очищает cookie `auth`.

---

## Извлечение из скрина

### `POST /api/extract`

Принимает изображение, отправляет в Gemini, возвращает структурированные данные. НЕ сохраняет в БД — только превью.

**Request:** `multipart/form-data`, поле `image: File` (jpg/png/webp, до 4MB).

**Response 200:**
```json
{
  "preview": {
    "summary": "Страница про Konjunktiv II",
    "words": [
      {
        "de": "die Möglichkeit",
        "ru": "возможность",
        "word_type": "noun",
        "gender": "die",
        "plural": "die Möglichkeiten",
        "level": "A2"
      },
      {
        "de": "gehen",
        "ru": "идти",
        "word_type": "verb",
        "forms": {
          "infinitiv": "gehen",
          "praeteritum": "ging",
          "partizip_2": "gegangen",
          "hilfsverb": "sein"
        },
        "level": "A1"
      }
    ],
    "phrases": [
      { "de": "auf jeden Fall", "ru": "в любом случае" }
    ],
    "grammar": [
      {
        "title": "Konjunktiv II — würde + Infinitiv",
        "explanation_md": "**Конъюнктив II** употребляется для...",
        "examples": [
          { "de": "Ich würde gerne kommen.", "ru": "Я бы с удовольствием пришёл." }
        ]
      }
    ],
    "sentences": [
      { "de": "...", "ru": "..." }
    ]
  },
  "image_path": "sources/2026-05-18/abc123.webp",
  "image_hash": "sha256:..."
}
```

**Response 422 (плохой скрин):**
```json
{ "error": { "code": "EXTRACT_FAILED", "message": "Gemini не смог распознать немецкий текст" } }
```

---

## Карты

### `POST /api/cards/bulk-create`

Сохраняет отобранные пользователем элементы в БД.

**Request:**
```json
{
  "source": {
    "image_path": "sources/...",
    "image_hash": "sha256:...",
    "raw_extract": { /* полный ответ Gemini */ },
    "title": "Kapitel 3, S. 47"
  },
  "cards": [
    {
      "kind": "vocab",
      "front": "die Möglichkeit",
      "back": "возможность",
      "word_type": "noun",
      "gender": "die",
      "plural": "die Möglichkeiten",
      "tags": ["A2", "abstrakt"]
    }
  ],
  "grammar_notes": [
    {
      "title": "Konjunktiv II",
      "explanation": "Markdown текст...",
      "examples": [{ "de": "...", "ru": "..." }],
      "tags": ["grammar", "konjunktiv"]
    }
  ]
}
```

**Response 201:**
```json
{
  "source_id": "uuid",
  "card_ids": ["uuid", "uuid"],
  "grammar_ids": ["uuid"]
}
```

### `GET /api/cards`

Список карт с фильтрами.

**Query params:**
- `source_id`: фильтр по источнику
- `tag`: фильтр по тегу
- `kind`: vocab | phrase | grammar_rule | sentence
- `q`: текстовый поиск (по front/back через pg_trgm)
- `due_only`: true → только с `due_at <= now()`
- `limit`: 1–100 (default 20)
- `offset`: для пагинации

**Response 200:**
```json
{
  "cards": [ { /* card */ } ],
  "total": 234,
  "has_more": true
}
```

### `GET /api/cards/:id`

**Response 200:** полная карта + source preview.

### `PATCH /api/cards/:id`

Редактирование карты.

**Request:**
```json
{
  "front": "...",
  "back": "...",
  "examples": [...],
  "tags": [...]
}
```

**Response 200:** обновлённая карта.

### `DELETE /api/cards/:id`

**Response 204.**

### `POST /api/cards/:id/enrich`

Генерация примеров, мнемоник, синонимов через Gemini.

**Response 200:**
```json
{
  "examples": [...],
  "mnemonic": "...",
  "synonyms": [...],
  "antonyms": [...]
}
```

Также сохраняет в БД.

---

## Тренировка

### `GET /api/review/queue`

Очередь карт для повторения.

**Query params:**
- `limit`: 1–100 (default 20)
- `tag`: опциональный фильтр

**Response 200:**
```json
{
  "queue": [ { /* card с полным fsrs_state */ } ],
  "due_count_total": 18
}
```

### `POST /api/review/answer`

Ответ пользователя на карту.

**Request:**
```json
{
  "card_id": "uuid",
  "rating": 3
}
```
`rating`: 1=Again, 2=Hard, 3=Good, 4=Easy.

**Response 200:**
```json
{
  "next_due": "2026-05-21T10:00:00Z",
  "scheduled_days": 3,
  "new_state": { /* fsrs_state */ }
}
```

### `GET /api/review/preview/:card_id`

Превью интервалов для каждого rating (показывается на кнопках).

**Response 200:**
```json
{
  "1": "<1m",
  "2": "10m",
  "3": "3d",
  "4": "8d"
}
```

---

## Грамматика

### `GET /api/grammar`

**Query params:** `tag`, `q`, `limit`, `offset`.

### `GET /api/grammar/:id`

### `PATCH /api/grammar/:id`

### `DELETE /api/grammar/:id`

---

## Источники

### `GET /api/sources`

Список загруженных скринов с количеством карт.

**Response 200:**
```json
{
  "sources": [
    {
      "id": "uuid",
      "title": "Kapitel 3",
      "image_url": "https://...signed-url",
      "card_count": 12,
      "grammar_count": 2,
      "created_at": "2026-05-18T..."
    }
  ]
}
```

### `DELETE /api/sources/:id`

Cascade удаление карт и grammar_notes.

---

## Статистика

### `GET /api/stats`

**Response 200:**
```json
{
  "total_cards": 234,
  "by_kind": { "vocab": 180, "phrase": 30, "grammar_rule": 12, "sentence": 12 },
  "due_today": 18,
  "reviewed_today": 12,
  "streak_days": 5,
  "heatmap": [
    { "date": "2026-05-17", "count": 24 },
    { "date": "2026-05-18", "count": 12 }
  ],
  "retention_30d": 0.87,
  "hardest_cards": [
    { "id": "uuid", "front": "...", "lapses": 5 }
  ]
}
```

---

## Настройки

### `GET /api/settings`

**Response 200:** строка `settings`.

### `PATCH /api/settings`

**Request:**
```json
{
  "daily_goal": 30,
  "tts_voice": "de-DE-Wavenet-A",
  "ui_theme": "dark"
}
```

---

## Экспорт

### `GET /api/export/anki`

Скачать все карты в формате `.apkg`.

**Response 200:** `application/octet-stream`, `Content-Disposition: attachment; filename=deutsch-trainer.apkg`.

Реализация: библиотека `anki-apkg-export` или `genanki-js`.

---

## Rate limits

Внутренние, in-memory:
- `/api/extract`: 5 req/мин на пользователя.
- `/api/cards/*/enrich`: 10 req/мин.
- Остальные: без явных лимитов (Vercel сам ограничит на уровне инфраструктуры).

При превышении — `429` + `Retry-After: 30`.

---

## Дальше

- [05 — Промты Gemini](05-prompts.md): что именно отправляется в `/api/extract` и `/api/cards/:id/enrich`.
