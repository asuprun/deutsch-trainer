# 08 — Деплой

## Архитектура развёртывания

```
   ┌─────────────────────────┐
   │  GitHub repo (main)     │
   └────────────┬────────────┘
                │ git push
                ▼
   ┌─────────────────────────┐
   │  Vercel CI/CD            │
   │  - npm install           │
   │  - next build            │
   │  - edge deploy           │
   └────────────┬────────────┘
                │ HTTPS
                ▼
   ┌─────────────────────────┐
   │  Vercel Edge Network    │
   │  *.vercel.app           │
   └────────────┬────────────┘
                │
        ┌───────┴────────┐
        ▼                ▼
  ┌──────────┐    ┌──────────────┐
  │ Supabase │    │ Google       │
  │ (DB+Stor)│    │ Gemini API   │
  └──────────┘    └──────────────┘
```

Все три сервиса бесплатны на личном уровне использования.

---

## Шаг 1 — Подготовка аккаунтов

### GitHub

- Создать новый репозиторий `deutsch-trainer` (private).

### Supabase

1. Регистрация на [supabase.com](https://supabase.com).
2. Создать проект (выбрать ближайший регион — `Frankfurt` для Европы).
3. Дождаться provisioning (~2 мин).
4. Зайти в **Project Settings → API** → скопировать:
   - `URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### Google AI Studio (Gemini)

1. Открыть [aistudio.google.com](https://aistudio.google.com).
2. Войти под Google аккаунтом.
3. **Get API key** → создать новый ключ.
4. Скопировать → `GEMINI_API_KEY`.

### Vercel

1. Регистрация на [vercel.com](https://vercel.com) через GitHub.
2. Импортировать репозиторий `deutsch-trainer`.
3. Framework preset: **Next.js** (автоопределится).
4. Build command: `next build` (по умолчанию).
5. Дальше — заполним env vars.

---

## Шаг 2 — Настройка Supabase

### Применить миграции

В Supabase Dashboard → **SQL Editor** → **New query** → вставить содержимое `db/migrations/0001_initial.sql` (см. [03-database.md](03-database.md)) → **Run**.

Проверка: **Table Editor** должен показывать таблицы `sources`, `cards`, `grammar_notes`, `review_logs`, `settings`.

### Создать Storage bucket

1. **Storage → Create bucket**.
2. Name: `sources`.
3. **Private** (НЕ публичный).
4. File size limit: 5 MB.
5. Allowed MIME types: `image/webp`, `image/jpeg`, `image/png`.

### Включить расширение pg_trgm

В SQL Editor:
```sql
create extension if not exists pg_trgm;
```

---

## Шаг 3 — Локальная разработка

### Установка

```powershell
git clone https://github.com/<your-user>/deutsch-trainer.git
cd deutsch-trainer
npm install
```

### `.env.local`

Скопировать `.env.local.example` → `.env.local` и заполнить:

```
# === Auth ===
APP_PASSWORD=твой-длинный-пароль-минимум-16-символов
AUTH_COOKIE_SECRET=сгенерируй-через-openssl-rand-base64-32

# === Supabase ===
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJ...

# === Gemini ===
GEMINI_API_KEY=AIza...

# === Опционально (резервный AI) ===
ENABLE_GROQ_FALLBACK=false
GROQ_API_KEY=
```

Генерация `AUTH_COOKIE_SECRET`:
```powershell
# Windows PowerShell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

```bash
# или через WSL / Git Bash
openssl rand -base64 32
```

### Запуск

```powershell
npm run dev
```

Открыть [http://localhost:3000](http://localhost:3000) → ввести пароль → должен зайти.

---

## Шаг 4 — Деплой на Vercel

### Импорт репозитория

Vercel Dashboard → **Add New → Project** → выбрать `deutsch-trainer` из списка GitHub репозиториев.

### Заполнить Environment Variables

В разделе **Environment Variables** добавить все ключи из `.env.local`:

| Name | Value | Environments |
|---|---|---|
| `APP_PASSWORD` | твой пароль | Production, Preview, Development |
| `AUTH_COOKIE_SECRET` | сгенерированная строка | все |
| `NEXT_PUBLIC_SUPABASE_URL` | URL из Supabase | все |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | все |
| `GEMINI_API_KEY` | ключ Gemini | все |

**Важно:** галочка "Sensitive" для всех кроме `NEXT_PUBLIC_*`.

### Deploy

Нажать **Deploy**. Через ~2 минуты — рабочий URL `https://deutsch-trainer-<hash>.vercel.app`.

Проверить:
1. Открыть URL → редирект на `/login`.
2. Ввести пароль → попадает на dashboard.
3. Загрузить тестовый скрин на `/upload` → должны извлечься слова.

---

## Шаг 5 — Кастомный домен (опционально)

Если хочется красивый URL:

1. Купить домен (Namecheap, Cloudflare Registrar — ~$10/год).
2. В Vercel **Project Settings → Domains** → добавить.
3. Скопировать DNS-записи из Vercel в DNS-провайдер.
4. Дождаться propagation (5 мин – 1 час).

Или бесплатный вариант: использовать поддомен Vercel `<projectname>.vercel.app`.

---

## Шаг 6 — PWA на телефоне

После деплоя:

### iOS

1. Открыть URL в Safari.
2. Кнопка **Поделиться** → **На экран Домой**.
3. На главном экране появится иконка.
4. Приложение запускается в полноэкранном режиме.

### Android

1. Открыть URL в Chrome.
2. Chrome автоматически предложит **Установить приложение**.
3. Если не предложил: меню (⋮) → **Установить приложение**.
4. Иконка появляется в списке приложений.

### Поделиться скрином в приложение

После установки PWA:
1. Сделать скрин в любом приложении.
2. Поделиться → выбрать **Deutsch Trainer** (благодаря `share_target` в manifest).
3. Скрин сразу попадает на `/upload`.

---

## Лимиты бесплатных тиров

| Сервис | Лимит | Что значит на практике |
|---|---|---|
| Vercel Hobby | 100 GB трафика/мес | Хватит на тысячи сессий |
| Vercel Hobby | 100 GB-часов compute | Хватит даже при ежедневном использовании |
| Supabase Free | 500 MB БД | ~500K карт без проблем |
| Supabase Free | 1 GB Storage | ~2000 скринов WebP по 500KB |
| Supabase Free | 2 GB трафика | Хватит для личного использования |
| Gemini Free | 1500 RPD | 50 скринов в день — комфортно |
| Gemini Free | 15 RPM | Не упрёшься в обычном режиме |

---

## Мониторинг

### Vercel

- **Dashboard → Logs** — все API errors видны в real-time.
- **Dashboard → Analytics** — трафик, latency (доступно на Hobby).

### Supabase

- **Database → Usage** — размер БД, текущая нагрузка.
- **Storage → Usage** — занятое место.

### Gemini

- **AI Studio → API Keys** — счётчик запросов за день.

Полезно раз в неделю заглядывать — особенно на Gemini usage.

---

## Бэкапы

Supabase Free делает автоматические бэкапы за последние 7 дней (нельзя восстановить вручную, только в Pro). Для надёжности:

### Раз в месяц вручную:

```powershell
# Через Supabase CLI (опционально)
supabase db dump --file backup-2026-05-18.sql
```

Или через **SQL Editor → Export** — скачать CSV всех таблиц.

Хранить в OneDrive / Google Drive / на локальном диске.

---

## Откат

Если деплой сломал что-то:

1. Vercel **Deployments** → найти предыдущий рабочий → **... → Promote to Production**.
2. Через 30 секунд старая версия снова в проде.

GitHub:
```powershell
git revert <commit-hash>
git push
```

---

## Обновления

Регулярно (раз в 2-3 месяца):

```powershell
npm outdated
npm update
npm audit fix
```

Major-обновления (Next.js 15 → 16) — отдельной задачей, читать changelog.

---

## Дальше

- [09 — Roadmap](09-roadmap.md): план разработки по спринтам.
