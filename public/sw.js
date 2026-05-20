const CACHE = 'dt-v2';
const PRECACHE = ['/', '/review', '/cards', '/upload'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Пропускаем всё кроме http/https (chrome-extension://, etc.)
  if (!url.protocol.startsWith('http')) return;

  // API — network-first, без кеша
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  // Остальное — stale-while-revalidate
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request);
      const fetchPromise = fetch(e.request).then((res) => {
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      }).catch(() => cached);
      return cached ?? fetchPromise;
    })
  );
});

// ── Push notifications ────────────────────────────────────────────────────────

self.addEventListener('push', (e) => {
  const data = e.data?.json?.() ?? {};
  e.waitUntil(
    self.registration.showNotification(data.title ?? 'Deutsch Trainer', {
      body: data.body ?? 'Время повторить карточки!',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'review-reminder',
      data: { url: data.url ?? '/review' },
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url ?? '/review';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
