# 06 — Frontend, UI/UX и PWA

## Структура проекта (frontend часть)

```
deutsch-trainer/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx              ← Sidebar + Header + ThemeProvider
│   │   ├── page.tsx                ← Dashboard
│   │   ├── upload/page.tsx
│   │   ├── review/page.tsx
│   │   ├── cards/page.tsx
│   │   ├── cards/[id]/page.tsx
│   │   ├── grammar/page.tsx
│   │   ├── decks/page.tsx
│   │   ├── stats/page.tsx
│   │   └── settings/page.tsx
│   ├── layout.tsx                  ← Root: html, fonts, базовая meta
│   ├── globals.css
│   └── api/                        ← см. 04-api.md
├── components/
│   ├── ui/                         ← shadcn компоненты (Button, Card, Dialog, Sheet, ...)
│   ├── upload-zone.tsx
│   ├── extract-preview.tsx
│   ├── card-front.tsx
│   ├── card-back.tsx
│   ├── review-deck.tsx
│   ├── rating-buttons.tsx
│   ├── tts-button.tsx
│   ├── heatmap.tsx
│   ├── grammar-card.tsx
│   ├── sidebar.tsx
│   ├── bottom-nav.tsx              ← мобильная нижняя навигация
│   └── theme-provider.tsx
├── lib/
│   ├── api-client.ts               ← обёртки над fetch для каждого endpoint
│   ├── hooks/
│   │   ├── use-cards.ts
│   │   ├── use-review.ts
│   │   └── use-tts.ts
│   └── utils.ts
└── public/
    ├── manifest.json
    ├── sw.js
    └── icons/
```

## Тема и стили

### Цвета (Tailwind config)

Dark mode по умолчанию через `class="dark"` на `<html>`. shadcn-defaults с небольшой кастомизацией:

```ts
// tailwind.config.ts
export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'hsl(240 10% 4%)',      // почти чёрный с холодным оттенком
        foreground: 'hsl(0 0% 98%)',
        card: 'hsl(240 10% 8%)',
        primary: 'hsl(221 83% 53%)',         // синий (для CTA)
        accent: 'hsl(160 84% 39%)',          // изумрудный (правильный ответ)
        destructive: 'hsl(0 84% 60%)',       // красный (Again)
        muted: 'hsl(240 4% 16%)',
        border: 'hsl(240 6% 20%)',
      }
    }
  }
}
```

### Шрифты

- **Body:** Inter (Latin + Cyrillic), через `next/font`.
- **Serif (для front карт):** Lora — академический, читаемый для длительного смотрения.
- **Mono (для технических полей):** JetBrains Mono.

```ts
import { Inter, Lora, JetBrains_Mono } from 'next/font/google';
```

---

## Страницы

### `/login`

Минимальный экран, центрированная карточка:
- Поле password (type=password).
- Кнопка "Войти".
- При ошибке — toast.
- После успеха — redirect на `/`.

### `/` (Dashboard)

Главная страница после входа.

**Структура:**
```
┌─────────────────────────────────────────┐
│  Header (sidebar toggle, theme switch)  │
├─────────────────────────────────────────┤
│                                          │
│   ┌──────────────────────────────────┐  │
│   │  18 карт ждут повторения         │  │
│   │  [ Начать тренировку ]           │  │  ← большая CTA
│   └──────────────────────────────────┘  │
│                                          │
│   ┌──────────┐ ┌──────────┐ ┌────────┐  │
│   │ Streak   │ │ Всего    │ │ Удерж. │  │
│   │ 🔥 5     │ │ 234 карт │ │ 87%    │  │
│   └──────────┘ └──────────┘ └────────┘  │
│                                          │
│   Активность за год                      │
│   [Heatmap календарь 53×7]              │
│                                          │
│   Быстрые действия:                      │
│   [Загрузить скрин] [Все карты]         │
│   [Грамматика]                          │
│                                          │
└─────────────────────────────────────────┘
```

### `/upload`

Загрузка скрина и предпросмотр извлечения.

**Состояния:**

1. **Empty** — drag-and-drop зона:
   - "Перетащи скрин страницы учебника"
   - Поддержка: drag & drop, click → file picker, **Ctrl+V** для вставки из буфера.

2. **Uploading + Extracting** — индикатор:
   - Превью загруженного изображения.
   - Spinner "Gemini обрабатывает..." (1-3 сек).

3. **Preview** — компонент `<ExtractPreview>`:
   - Summary сверху.
   - Табы: Слова (12) / Фразы (3) / Грамматика (2) / Предложения (5).
   - Для каждого элемента — чекбокс (по умолчанию все выбраны).
   - Снизу: "Сохранить 17 элементов".

4. **Saved** — toast "Добавлено в коллекцию", redirect на `/cards?source_id=...`.

### `/review`

Полноэкранный режим тренировки (минимум отвлекающих элементов).

**Шапка:**
- Прогресс-бар (5/18).
- Крестик "Закрыть" → modal "Прервать? Прогресс сохранён."

**Центр (front state):**
- Большое немецкое слово (Lora, ~48pt) с указанием рода (der/die/das цветом: der=синий, die=розовый, das=зелёный).
- Под словом — тип (noun/verb) маленьким шрифтом.
- Кнопка "Показать ответ" (или space/tap).

**Центр (back state):**
- Front сверху (меньшего размера).
- Перевод (большой).
- Примеры (если есть) — список.
- Кнопка-динамик для TTS (или auto-play).
- Мнемоника (если есть) — в светлом блоке.

**Низ — 4 кнопки rating:**
```
[ Снова ]  [ Сложно ]  [ Хорошо ]  [ Легко ]
   <1m        10m         3d           8d
```
Цвета: rose / amber / blue / emerald.

**Клавиатурные сокращения:**
- `Space` → flip
- `1` / `2` / `3` / `4` → rating
- `Esc` → close
- `S` → озвучить ещё раз

**Конец сессии:**
- "Сессия завершена! Повторено 18 карт. Streak: 6 дней."
- Кнопки: "Заново" / "На главную".

### `/cards`

Таблица всех карт с фильтрами.

**Левая панель — фильтры:**
- Источник (sources dropdown).
- Теги (multi-select).
- Тип (vocab/phrase/grammar_rule/sentence).
- Только due (toggle).
- Поиск по тексту.

**Таблица:**
- Колонки: Front | Back | Тип | Теги | Due | Reps.
- Сортировка по любой колонке.
- Bulk select для массового действия (добавить тег, удалить).

**Пагинация:** 20 карт на страницу.

### `/cards/[id]`

Подробный редактор карты.

- Все поля редактируемы inline.
- Превью source-скрина (signed URL).
- Кнопка "Сгенерировать примеры" (вызывает `/api/cards/:id/enrich`).
- Кнопка "Удалить" с подтверждением.
- История повторений (последние 10 review_logs).

### `/grammar`

Список grammar_notes, сгруппированный по тегам.

- Accordion: каждая заметка раскрывается.
- Markdown render (`react-markdown` + `remark-gfm`).
- Поиск по title и содержимому.

### `/decks`

Источники как карточки с превью.

- Сетка карточек: изображение + title + количество карт.
- Click → фильтр на `/cards?source_id=...`.
- Долгое нажатие / меню → удалить.

### `/stats`

Полная статистика.

- Heatmap 365 дней.
- График retention по времени (Recharts).
- Топ-10 самых сложных карт (по lapses).
- Топ-10 свежедобавленных.
- Распределение по уровням A1/A2/B1.

### `/settings`

- Daily goal (slider 5–100).
- FSRS параметры (request_retention, дефолт 0.9).
- TTS voice picker (список доступных голосов из `speechSynthesis.getVoices()`).
- TTS rate slider (0.5–1.5).
- Тема: dark/light/system.
- Кнопка "Скачать .apkg" → `/api/export/anki`.
- Кнопка "Выйти".

---

## Layout

### Desktop

```
┌──────┬─────────────────────────┐
│ Side │   Content                │
│ bar  │                          │
│      │                          │
│ Home │                          │
│ Rev. │                          │
│ Up.  │                          │
│ Card │                          │
│ Gram │                          │
│ Stat │                          │
│ Set  │                          │
└──────┴─────────────────────────┘
```

Sidebar: 240px, collapsible до 64px (только иконки).

### Mobile

```
┌─────────────────────────┐
│  Header (logo, theme)   │
├─────────────────────────┤
│                          │
│   Content (full width)   │
│                          │
│                          │
├─────────────────────────┤
│ 🏠   🎓   ➕   🗂   ⋯  │
│Home Rev. Add Cards More │
└─────────────────────────┘
```

Bottom nav: 64px, 5 пунктов. "More" открывает drawer с остальными.

---

## TTS (Web Speech API)

```ts
function useTTS() {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    const update = () => {
      const voices = speechSynthesis.getVoices();
      const de = voices.find(v => v.lang === 'de-DE');
      setVoice(de ?? null);
    };
    update();
    speechSynthesis.onvoiceschanged = update;
  }, []);

  const speak = (text: string, rate = 1.0) => {
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'de-DE';
    utt.rate = rate;
    if (voice) utt.voice = voice;
    speechSynthesis.cancel();
    speechSynthesis.speak(utt);
  };

  return { speak, voice };
}
```

**Качество голосов:**
- На macOS/iOS: Anna (de-DE) — отличное качество.
- На Windows: Hedda, Stefan — хорошее.
- На Android Chrome: Google Deutsch — отличное.
- В desktop Chrome (Linux): иногда нет встроенных голосов — резерв: Google Translate TTS через прокси (fallback).

---

## Оптимистичные обновления

Для review/answer:
```ts
const onAnswer = async (rating) => {
  // 1. Сразу убираем карту из очереди (UI отклик мгновенный)
  setQueue(q => q.slice(1));

  try {
    await fetch('/api/review/answer', { ... });
  } catch (e) {
    // Откат + toast
    setQueue(q => [card, ...q]);
    toast.error('Не удалось сохранить ответ');
  }
};
```

---

## Skeleton и loaders

- shadcn `<Skeleton>` для всех загрузок.
- Spinner только для долгих операций (extract).
- Сетка карт показывает 8 skeleton при первой загрузке.

---

## Тосты (sonner)

- success: зелёный, 3 сек.
- error: красный, 5 сек.
- info: нейтральный, 3 сек.

Позиция: top-right на desktop, bottom-center на mobile.

---

## PWA

### `public/manifest.json`

```json
{
  "name": "Deutsch Trainer",
  "short_name": "Deutsch",
  "description": "Личное приложение для изучения немецкого",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0a0a0c",
  "theme_color": "#0a0a0c",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "share_target": {
    "action": "/upload",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "files": [{ "name": "image", "accept": ["image/*"] }]
    }
  },
  "shortcuts": [
    {
      "name": "Тренировка",
      "url": "/review",
      "icons": [{ "src": "/icons/review.png", "sizes": "96x96" }]
    },
    {
      "name": "Загрузить скрин",
      "url": "/upload"
    }
  ]
}
```

**`share_target`** — пользователь может из галереи телефона нажать "Поделиться" → выбрать Deutsch Trainer → скрин сразу загружается в `/upload`.

### Service worker (Serwist)

```ts
// serwist.config.ts (примерно)
import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    ...defaultCache,
    {
      matcher: /\.(?:webp|png|jpg)$/,
      handler: "CacheFirst",
      options: { cacheName: "images", expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 } }
    }
  ]
});
```

### Установка на телефон

- iOS Safari: "Поделиться" → "На экран Домой".
- Android Chrome: подсказка "Установить" автоматически, или меню → "Установить приложение".
- Desktop Chrome: иконка установки в адресной строке.

---

## Дальше

- [07 — Безопасность](07-security.md): password gate, ключи.
