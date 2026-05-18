# 07 — Безопасность

## Модель угроз

Приложение — для одного пользователя, развёрнуто публично в интернете. Угрозы:

1. **Случайный посетитель** натыкается на URL и видит данные пользователя.
2. **Бот сканирует** URLs и пытается дёрнуть `/api/extract`, чтобы сжечь квоту Gemini.
3. **Утечка ключей** через клиентский bundle — кто-то находит `GEMINI_API_KEY` или `SUPABASE_SERVICE_ROLE_KEY` в JS.
4. **CSRF** — атака с другого сайта на залогиненную сессию.
5. **XSS** — вредоносный текст в `back` или `examples` (теоретически из ответа Gemini).

## Меры защиты

### Password gate через Proxy

Single user, простой пароль в env-переменной. Без полноценного auth-сервера, без email/OAuth.

> **Важно про Next.js 16:** начиная с Next.js 16 файл `middleware.ts` переименован в `proxy.ts`, а функция называется `proxy`. Функциональность та же — выполняется перед обработкой запроса. Импорты и API (`NextRequest`, `NextResponse`) не изменились.

**`proxy.ts`** (в корне проекта):

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/_next',
  '/icons',
  '/manifest.json',
  '/sw.js',
  '/favicon.ico'
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get('auth')?.value;
  const expected = process.env.AUTH_COOKIE_SECRET;

  if (!token || token !== expected) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED' } },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)'
};
```

### `POST /api/auth/login`

```ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { timingSafeEqual } from 'crypto';

export async function POST(req: Request) {
  const { password } = await req.json();
  const expected = process.env.APP_PASSWORD!;

  const a = Buffer.from(password ?? '');
  const b = Buffer.from(expected);
  const ok = a.length === b.length && timingSafeEqual(a, b);

  if (!ok) {
    return NextResponse.json(
      { error: { code: 'INVALID_PASSWORD' } },
      { status: 401 }
    );
  }

  const store = await cookies();
  store.set('auth', process.env.AUTH_COOKIE_SECRET!, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30  // 30 дней
  });

  return NextResponse.json({ ok: true });
}
```

**Важные детали:**
- `timingSafeEqual` защищает от timing attacks.
- `httpOnly` — cookie недоступен из JS (защита от XSS-кражи).
- `secure` — только HTTPS.
- `sameSite=lax` — защита от базовых CSRF.
- `AUTH_COOKIE_SECRET` — длинная случайная строка (генерим через `openssl rand -base64 32`).

### Хранение секретов

| Переменная | Где хранится | Доступ |
|---|---|---|
| `APP_PASSWORD` | Vercel env | server only |
| `AUTH_COOKIE_SECRET` | Vercel env | server only |
| `GEMINI_API_KEY` | Vercel env | server only |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env | server only |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel env | можно client (но не используем напрямую) |

**Правила:**
- Никаких ключей в коде или в commit.
- `.env.local` в `.gitignore`.
- `.env.local.example` — шаблон с placeholder-значениями (commit можно).
- В клиентском коде нельзя `process.env.GEMINI_API_KEY` — Next.js этого не позволит без префикса `NEXT_PUBLIC_`, но не используй такой префикс для секретов!

### Защита Supabase

- **RLS включён без политик** на всех таблицах (defense in depth). Service role ключ обходит RLS и работает как обычно; anon-ключ — deny by default. Без RLS любой, кто узнает публичный URL проекта (а его легко получить), смог бы дёргать наши таблицы через PostgREST с anon-ключом.
- **Service role key — только на сервере** (в API routes). Клиент никогда не получает прямой доступ к БД.
- Supabase Storage bucket `sources` — приватный, доступ только через signed URLs от сервера (TTL 1 час).

### Защита от ботов и злоупотреблений

**Rate limits in-memory** (для одного Vercel инстанса — достаточно для одного пользователя):

```ts
const rateLimits = new Map<string, number[]>();  // key → timestamps

function checkRate(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const ts = (rateLimits.get(key) ?? []).filter(t => now - t < windowMs);
  if (ts.length >= max) return false;
  ts.push(now);
  rateLimits.set(key, ts);
  return true;
}

// В /api/extract:
if (!checkRate('extract', 5, 60_000)) {
  return NextResponse.json({ error: { code: 'RATE_LIMIT' } }, { status: 429 });
}
```

Поскольку пользователь один — ключом может быть просто endpoint name, без IP.

### Защита от XSS

Источник риска — текст, который Gemini вернул и который рендерится в UI.

- React по умолчанию **экранирует** все строки в JSX — это работает из коробки.
- Markdown render для grammar.explanation: используем `react-markdown` с **отключёнными** raw HTML и dangerouslySetInnerHTML:
  ```tsx
  <ReactMarkdown
    components={{ /* кастомные рендеры */ }}
    skipHtml={true}
  >{markdown}</ReactMarkdown>
  ```
- Никакого `dangerouslySetInnerHTML` в проекте вообще.

### Защита от CSRF

- `sameSite=lax` на auth cookie — браузер не пошлёт его с cross-origin POST.
- Все мутирующие endpoints (`POST/PATCH/DELETE`) проходят через middleware → требуют cookie.
- Дополнительный CSRF token не нужен для single-user приложения (нет других пользователей, чьи сессии можно угнать).

### Валидация входных данных

Все API routes валидируют request body через **zod**:

```ts
const bulkCreateSchema = z.object({
  source: z.object({
    image_path: z.string(),
    image_hash: z.string(),
    raw_extract: z.unknown(),
    title: z.string().max(200).optional()
  }),
  cards: z.array(z.object({
    kind: z.enum(['vocab','phrase','grammar_rule','sentence']),
    front: z.string().min(1).max(500),
    back: z.string().min(1).max(2000),
    // ...
  })).max(200),
  grammar_notes: z.array(z.object({ /* ... */ })).max(50)
});

const parsed = bulkCreateSchema.safeParse(await req.json());
if (!parsed.success) {
  return NextResponse.json(
    { error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } },
    { status: 400 }
  );
}
```

### Загрузка изображений

- Максимум **4 MB** на файл (проверка на сервере).
- MIME whitelist: `image/jpeg`, `image/png`, `image/webp`.
- Через `sharp` — переконвертация в WebP, max 1600px по большой стороне, quality 85.
- Это защищает от:
  - ZIP-bombs (sharp откажется парсить невалидный image).
  - Загрузки исполняемых файлов под видом изображения.

```ts
const buffer = Buffer.from(await file.arrayBuffer());
const processed = await sharp(buffer)
  .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
  .webp({ quality: 85 })
  .toBuffer();
```

### Логи и аудит

- Все вызовы Gemini логируются (consoleлогов достаточно — видны в Vercel dashboard).
- Все failed login attempts логируются с timestamp.
- Подозрительные паттерны (>5 failed login за минуту) — пока не реагируем, в v1 не критично.

---

## Чего НЕ делаем (осознанно)

- **2FA** — single user, локальный пароль достаточен.
- **Email verification** — нет email-системы.
- **CSP заголовки** — пока не критично, можно добавить во v2.
- **WAF / Cloudflare** — Vercel сам предоставляет базовую защиту.
- **HTTPS-only redirect** — Vercel делает это автоматически.
- **Регулярная ротация ключей** — на personal проекте избыточно.

---

## Чек-лист перед деплоем

- [ ] `APP_PASSWORD` — длинный (минимум 16 символов), уникальный.
- [ ] `AUTH_COOKIE_SECRET` — сгенерирован через `openssl rand -base64 32`.
- [ ] `.env.local` в `.gitignore`.
- [ ] `git log -p` — нет утёкших ключей в истории.
- [ ] Все API routes покрыты middleware (нет случайно публичного endpoint).
- [ ] Все Supabase запросы идут через сервер.
- [ ] zod валидация на всех мутирующих endpoints.
- [ ] Rate limit на `/api/extract` работает.

---

## Дальше

- [08 — Деплой](08-deployment.md): как развернуть всё это.
