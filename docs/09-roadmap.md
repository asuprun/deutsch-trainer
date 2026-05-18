# 09 — Roadmap, риски, FSRS

## План по спринтам

Один спринт = 1-2 вечера работы (2-3 часа). Итого ~10-12 вечеров до полностью рабочего MVP.

### Sprint 1 — Foundation (1-2 вечера)

**Цель:** работающий каркас приложения, можно войти и увидеть пустой dashboard.

- [ ] `npx create-next-app@latest deutsch-trainer --typescript --tailwind --app --src-dir=false --import-alias="@/*"`
- [ ] `npx shadcn@latest init` — выбрать **Slate** базу, **dark mode**.
- [ ] Установить shadcn компоненты: `button card input label dialog sheet sonner skeleton tabs accordion progress dropdown-menu badge`.
- [ ] Установить пакеты: `@supabase/supabase-js`, `@google/generative-ai`, `ts-fsrs`, `zod`, `sharp`, `react-hook-form`, `lucide-react`.
- [ ] Создать Supabase проект, применить миграции из [03-database.md](03-database.md).
- [ ] Создать Storage bucket `sources`.
- [ ] Получить Gemini API key.
- [ ] `.env.local.example` + `.env.local`.
- [ ] `lib/supabase/server.ts` — клиент с service_role.
- [ ] `lib/gemini/client.ts` — клиент Gemini.
- [ ] `middleware.ts` — password gate.
- [ ] `/login` страница.
- [ ] `/api/auth/login` и `/api/auth/logout`.
- [ ] Базовый layout с sidebar + theme provider + dark тема.
- [ ] Пустая главная `/`.

**Готово, когда:** можно войти по паролю и увидеть пустую главную в dark теме.

### Sprint 2 — Upload & Extract (2 вечера)

**Цель:** загрузить скрин → увидеть распарсенные слова → сохранить отобранные в БД.

- [ ] `lib/image/compress.ts` — sharp-based сжатие в WebP.
- [ ] `lib/gemini/prompts.ts` — промт extract + responseSchema.
- [ ] `lib/gemini/extract.ts` — вызов с retry-логикой.
- [ ] `/api/extract` — приём файла, sharp, дедуп по hash, Gemini, response.
- [ ] `components/upload-zone.tsx` — drag-and-drop + Ctrl+V.
- [ ] `components/extract-preview.tsx` — табы со списками + чекбоксы.
- [ ] `/upload` страница.
- [ ] `/api/cards/bulk-create` — транзакционное сохранение.
- [ ] Toast после сохранения, редирект на `/cards`.

**Готово, когда:** скрин учебника → 30 секунд → 15 карт в БД.

### Sprint 3 — Review с FSRS (2 вечера)

**Цель:** полноценная тренировочная сессия.

- [ ] `lib/fsrs/scheduler.ts` — обёртка над ts-fsrs.
- [ ] `/api/review/queue` — выборка due карт.
- [ ] `/api/review/answer` — расчёт + UPDATE + INSERT log.
- [ ] `/api/review/preview/:id` — превью интервалов.
- [ ] `components/card-front.tsx` и `card-back.tsx`.
- [ ] `components/rating-buttons.tsx`.
- [ ] `components/tts-button.tsx` + `lib/hooks/use-tts.ts`.
- [ ] `/review` полноэкранная страница.
- [ ] Keyboard shortcuts (1/2/3/4/space/esc).
- [ ] Прогресс-бар, экран завершения сессии.
- [ ] Animation flip карты (CSS).

**Готово, когда:** проходишь сессию из 10 карт с нормальным интервалом и слышишь немецкий TTS.

### Sprint 4 — Cards & Grammar (1-2 вечера)

**Цель:** управление картами и грамматикой.

- [ ] `/api/cards` (GET со всеми фильтрами).
- [ ] `/api/cards/:id` (GET/PATCH/DELETE).
- [ ] `/api/cards/:id/enrich` — генерация примеров через Gemini.
- [ ] `/cards` — таблица с фильтрами и поиском.
- [ ] `/cards/[id]` — детальное редактирование.
- [ ] `/api/grammar` — все CRUD.
- [ ] `/grammar` — accordion + markdown.
- [ ] `/api/sources` — список источников с counts.
- [ ] `/decks` — сетка карточек источников.

**Готово, когда:** можно отредактировать карту, сгенерировать примеры, посмотреть грамматику.

### Sprint 5 — Stats & Settings (1 вечер)

**Цель:** видеть прогресс и настраивать приложение.

- [ ] `/api/stats` — все агрегации.
- [ ] `/api/settings` GET/PATCH.
- [ ] Dashboard с heatmap, streak, due_today.
- [ ] `/stats` — расширенная статистика, графики.
- [ ] `/settings` — все настройки.
- [ ] `/api/export/anki` — экспорт в .apkg.

**Готово, когда:** видишь heatmap своей активности, можешь поменять daily goal и TTS voice.

### Sprint 6 — PWA & Polish (1 вечер)

**Цель:** установка на телефон и финишная полировка.

- [ ] `public/manifest.json` с `share_target` и `shortcuts`.
- [ ] Иконки 192/512/maskable.
- [ ] Service worker (Serwist).
- [ ] Skeleton loaders на всех страницах.
- [ ] Error boundaries.
- [ ] 404 страница.
- [ ] `/upload` — поддержка POST от share_target.
- [ ] Smoke-тест на телефоне (iOS + Android).

**Готово, когда:** установил на телефон, поделился скрином из галереи — он попал на upload.

### Sprint 7 — Deploy (0.5 вечера)

- [ ] Push в GitHub.
- [ ] Подключить Vercel.
- [ ] Заполнить env vars.
- [ ] Финальный smoke-тест в проде.
- [ ] Установить PWA на телефон с прод-URL.

**Готово, когда:** приложение работает на `https://...vercel.app` и установлено как иконка на главном экране телефона.

---

## FSRS — детали интеграции

### Установка

```
npm install ts-fsrs
```

### Базовое использование

```ts
import { FSRS, generatorParameters, Rating, State, createEmptyCard } from 'ts-fsrs';

const params = generatorParameters({
  enable_fuzz: true,
  request_retention: 0.9,
  maximum_interval: 36500
});

const fsrs = new FSRS(params);

// Создание новой карты
const newCard = createEmptyCard();

// Ответ пользователя
const now = new Date();
const result = fsrs.next(currentState, now, Rating.Good);
// result.card — новое состояние
// result.log — запись для review_logs

// Превью всех вариантов (для кнопок)
const previews = fsrs.repeat(currentState, now);
// previews[Rating.Again].card.due
// previews[Rating.Hard].card.due
// previews[Rating.Good].card.due
// previews[Rating.Easy].card.due
```

### Маппинг

| UI кнопка | FSRS Rating | Числовой код |
|---|---|---|
| "Снова" | `Rating.Again` | 1 |
| "Сложно" | `Rating.Hard` | 2 |
| "Хорошо" | `Rating.Good` | 3 |
| "Легко" | `Rating.Easy` | 4 |

### Где живёт FSRS

- **Серверная сторона** — источник истины. Все расчёты в `/api/review/answer`.
- **Клиент** — только UI, не делает решений о следующем due.

### Сохранение в БД

`cards.fsrs_state` (jsonb) хранит структуру:
```json
{
  "due": "...",
  "stability": 4.93,
  "difficulty": 7.0,
  "elapsed_days": 0,
  "scheduled_days": 3,
  "reps": 5,
  "lapses": 1,
  "state": 2,
  "last_review": "..."
}
```

Дублирование `due` в колонку `due_at` для эффективного SQL-индекса.

### Настройка ретенции

Пользователь в `/settings` может менять `request_retention`:
- 0.85 — реже повторения, ниже точность вспоминания.
- 0.9 (по умолчанию) — сбалансированный.
- 0.95 — частые повторения, выше точность.

Значение сохраняется в `settings.fsrs_params`, читается в server на каждом запросе review.

---

## Риски и митигации

| Риск | Вероятность | Воздействие | Митигация |
|---|---|---|---|
| Gemini Free лимит 1500/день исчерпан | Низкая | Среднее | Кеш по `image_hash`, для enrich-вызовов можно вручную дёргать; в крайнем случае Groq как fallback |
| Плохое OCR рукописного текста | Средняя | Низкое | UI-подсказка: "Лучше работает с печатным текстом", опция загрузить заново |
| Supabase 500 MB переполнен | Низкая | Низкое | Сжатие в WebP 85%, периодическая чистка sources без карт |
| Gemini возвращает невалидный JSON | Низкая | Среднее | responseSchema + zod validation + 1 retry с явной подсказкой |
| TTS-голос плохой на десктопе Linux | Средняя | Низкое | Опция выбора голоса в settings, fallback на Google Translate TTS (limited) |
| Vercel cold start медленный для extract | Высокая | Низкое | Уже 1-3 сек на сам Gemini — cold start +0.5 сек незаметен |
| PWA на iOS Safari ведёт себя странно | Средняя | Среднее | Тестировать на реальном iPhone до деплоя, не полагаться на push-уведомления |
| Слова на странице с двойным переводом (de↔en учебник) | Средняя | Среднее | Промт явно говорит переводить на русский; для en-учебников добавить опцию в /upload |
| Пользователь забывает пароль | Низкая | Низкое | Пароль хранится у пользователя, можно сменить через Vercel env vars + redeploy |

---

## Дальнейшие итерации (v2+)

После того, как v1 MVP работает:

- **Чат-практика с Gemini:** "Поговори со мной по теме «в ресторане»" — диалоговый бот с коррекцией ошибок.
- **Клозер-тесты:** автогенерация предложений с пропусками.
- **Distractor-тренировка:** выбор правильного перевода из 4 вариантов.
- **Ввод с клавиатуры:** напечатать перевод, AI оценивает правильность.
- **Импорт из Anki / Quizlet.**
- **Шеринг колод** — публичный read-only URL (требует мультипользовательской логики).
- **Распознавание звука:** записал немецкое произношение, AI оценил.
- **Telegram-бот:** ежедневный пуш с одной карточкой через бот.

---

## Готов к старту

После того как ты прочтёшь все 9 документов и одобришь:
1. Запускаем Sprint 1 — каркас приложения.
2. Параллельно: ты создаёшь Supabase + Vercel + Gemini аккаунты.
3. Дальше — спринт за спринтом.

Если есть правки к документам — давай обратную связь, я дополню перед началом разработки.
