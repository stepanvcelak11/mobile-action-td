// Offline support + fast start.
// Heavy static files (three.js, icons, fonts) come straight from the cache; the game's own files are
// network-first with a 2.5 s timeout, so updates show up right away but a slow connection never blocks the start.
const CACHE = 'serpentline-v2';
const MODULES = ['src/achievements.js', 'src/army.js', 'src/audio.js', 'src/battlemarks.js', 'src/bunker.js', 'src/campaign.js', 'src/clip.js', 'src/config.js', 'src/daily.js', 'src/effects.js', 'src/entities.js', 'src/errors.js', 'src/icons.js', 'src/installhint.js', 'src/main.js', 'src/merge.js', 'src/meta.js', 'src/minimap.js', 'src/models.js', 'src/music.js', 'src/perf.js', 'src/perfreport.js', 'src/portraits.js', 'src/post.js', 'src/powers.js', 'src/progress.js', 'src/roguelite.js', 'src/showcase.js', 'src/skill.js', 'src/skinfx.js', 'src/trees.js', 'src/treeview.js', 'src/ui.js', 'src/viewport.js', 'src/voice.js', 'src/world.js'];
const CORE = ['./', 'index.html', 'style.css', 'menu.css', 'manifest.webmanifest', 'vendor/three.module.min.js', 'icons/icon-192.png', ...MODULES];
const STATIC = /\/vendor\/|\/icons\/|fonts\.(googleapis|gstatic)\.com/;

self.addEventListener('install', (e) => {
  // one by one: a single missing file must not leave the whole cache empty
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const put = (req, res) => { if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; };

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (STATIC.test(url.href)) {
    // cache first, refresh in the background
    e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => {
      const net = fetch(req).then((res) => put(req, res)).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  e.respondWith(new Promise((resolve) => {
    let done = false;
    const fallback = () => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'));
    const timer = setTimeout(() => { fallback().then((hit) => { if (hit && !done) { done = true; resolve(hit); } }); }, 2500);
    fetch(req).then((res) => { put(req, res); if (!done) { done = true; clearTimeout(timer); resolve(res); } })
      .catch(() => fallback().then((hit) => { if (!done) { done = true; clearTimeout(timer); resolve(hit); } }));
  }));
});
