const CACHE_PREFIX = 'jlpt-n3-';
const CACHE = 'jlpt-n3-v46-reading';
const RELEASE = '45';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './icon.svg', './apple-touch-icon.png',
  './grammar.html', './grammar.js', `./grammar.js?v=${RELEASE}`, './grammar.css', './grammar.json',
  './settings.html', './profile.html', './settings.css', './settings.js',
  './study.html', `./study.css?v=${RELEASE}`, `./study.js?v=${RELEASE}`,
  `./study-storage.js?v=${RELEASE}`, `./study-session.js?v=${RELEASE}`,
  `./study-render.js?v=${RELEASE}`, `./study-flash.js?v=${RELEASE}`,
  './release.js', './register-sw.js',
  `./study-data/topics.json?v=${RELEASE}`,
  `./study-data/collections.json?v=${RELEASE}`, `./study-data/grammar.json?v=${RELEASE}`, `./study-data/kanji.json?v=${RELEASE}`,
  `./study-data/verbs.json?v=${RELEASE}`, `./study-data/kanji-quiz.json?v=${RELEASE}`, `./study-data/synonyms.json?v=${RELEASE}`,
  `./study-data/usage-quiz.json?v=${RELEASE}`, `./study-data/hard-quiz.json?v=${RELEASE}`, `./study-data/near-synonyms.json?v=${RELEASE}`,
  `./study-data/star-rearrange.json?v=${RELEASE}`,
  `./study-data/adverbs.json?v=${RELEASE}`, `./study-data/adverb-patterns.json?v=${RELEASE}`, `./study-data/bi-kip-answers.json?v=${RELEASE}`,
  `./study-data/bi-kip.json?v=${RELEASE}`, `./study-data/connectors.json?v=${RELEASE}`, `./study-data/exam-tips.json?v=${RELEASE}`,
  `./study-data/grammar-set.json?v=${RELEASE}`, `./study-data/jido-tado.json?v=${RELEASE}`, `./study-data/ebook-grammar.json?v=${RELEASE}`,
  `./study-data/so-tay-idioms.json?v=${RELEASE}`,
];

const isNavRequest = request =>
  request.mode === 'navigate' ||
  (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));

const isScriptOrData = url =>
  /\.(?:js|mjs|css|json|webmanifest)(?:$|\?)/i.test(url.pathname + url.search) ||
  url.pathname.includes('/study-data/');

const htmlFallback = url => {
  const path = url.pathname.replace(/\/$/, '/') || '/';
  if (path.endsWith('/study.html') || path.endsWith('/study')) return './study.html';
  if (path.endsWith('/settings.html')) return './settings.html';
  if (path.endsWith('/grammar.html')) return './grammar.html';
  if (path.endsWith('/profile.html')) return './profile.html';
  return './index.html';
};

self.addEventListener('install', event => {
  // Precache the new release but stay in waiting until the client asks to activate.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
        .map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      // Never treat error/HTML error pages as successful module/data responses.
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
      }
      return response;
    } catch {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      // HTML fallback only for navigations — never for JS/JSON/CSS.
      if (isNavRequest(event.request) && !isScriptOrData(url)) {
        const fallback = await caches.match(htmlFallback(url));
        if (fallback) return fallback;
      }
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});
