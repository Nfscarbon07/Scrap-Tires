// Keeps the app working with no signal. Files load from the phone first,
// then quietly update in the background when there's a connection.
const CACHE = 'tire-photos-v1';
const ASSETS = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const fromNet = fetch(req)
    .then(async (res) => {
      if (res && res.ok && res.type === 'basic') {
        const c = await caches.open(CACHE);
        await c.put(req, res.clone());
      }
      return res;
    })
    .catch(() => null);
  e.waitUntil(fromNet.then(() => undefined));

  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    let hit = await c.match(req, { ignoreSearch: true });
    if (!hit && req.mode === 'navigate') hit = (await c.match('./')) || (await c.match('index.html'));
    if (hit) return hit;
    const res = await fromNet;
    return res || Response.error();
  })());
});
