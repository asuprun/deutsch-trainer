# Deutsch Trainer

Личное PWA для изучения немецкого языка. Загружаешь скрин страницы учебника — AI разбирает его на слова, грамматику и примеры, создаёт флешкарты с FSRS-повторением (как в Anki).

## Статус

В разработке. Технический дизайн утверждён.

## Документация

Документация разбита на 9 файлов в [`docs/`](docs/README.md):

| # | Документ | О чём |
|---|---|---|
| 01 | [Обзор](docs/01-overview.md) | Цели, не-цели, стек |
| 02 | [Архитектура](docs/02-architecture.md) | Схема и потоки |
| 03 | [База данных](docs/03-database.md) | SQL-схема |
| 04 | [API](docs/04-api.md) | Endpoints |
| 05 | [Промты Gemini](docs/05-prompts.md) | System prompts + schemas |
| 06 | [Frontend и PWA](docs/06-frontend.md) | UI/UX, тёмная тема |
| 07 | [Безопасность](docs/07-security.md) | Password gate, ключи |
| 08 | [Деплой](docs/08-deployment.md) | Vercel + Supabase + Gemini |
| 09 | [Roadmap](docs/09-roadmap.md) | Спринты, FSRS, риски |

## Стек

- Next.js 15 + TypeScript + Tailwind + shadcn/ui
- Supabase (Postgres + Storage)
- Google Gemini 2.0 Flash (vision + текст, бесплатно)
- ts-fsrs (интервальное повторение)
- Web Speech API (TTS на немецком)
- Vercel Hobby (хостинг, бесплатно)
- PWA с share_target

## Быстрый старт (когда код появится)

```powershell
cp .env.local.example .env.local
# заполнить APP_PASSWORD, GEMINI_API_KEY, Supabase ключи
npm install
npm run dev
```

См. [docs/08-deployment.md](docs/08-deployment.md) для полной инструкции.
