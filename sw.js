// Keeps the app working with no signal.
// The page itself: get the newest copy from the site when there's signal (so an
// update shows up the first time you open the app), else use the saved copy.
// Icons and other files: use the saved copy, refresh it in the background.
const CACHE = 'tire-photos-v2';
const ASSETS = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
const PAGE_KEY = new URL('./', self.registration.scope).href;

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

function fresh(url) {
  return fetch(url, { cache: 'no-cache', credentials: 'same-origin' });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    const fromNet = fresh(req.url)
      .then(async (res) => {
        if (res && res.ok) { const c = await caches.open(CACHE); await c.put(PAGE_KEY, res.clone()); }
        return res;
      })
      .catch(() => null);
    e.waitUntil(fromNet.then(() => undefined));
    e.respondWith((async () => {
      const timeout = new Promise((r) => setTimeout(() => r(null), 4000));
      const res = await Promise.race([fromNet, timeout]);
      if (res && res.ok) return res.clone();
      const c = await caches.open(CACHE);
      return (await c.match(PAGE_KEY)) || (await c.match('index.html')) || res || Response.error();
    })());
    return;
  }

  const fromNet = fresh(req.url)
    .then(async (res) => {
      if (res && res.ok && res.type === 'basic') { const c = await caches.open(CACHE); await c.put(req, res.clone()); }
      return res;
    })
    .catch(() => null);
  e.waitUntil(fromNet.then(() => undefined));
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const res = await fromNet;
    return res || Response.error();
  })());
});
