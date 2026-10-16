const CACHE_PREFIX = 'jlpt-n3-';
const CACHE = 'jlpt-n3-v40-reliability';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './icon.svg', './apple-touch-icon.png',
  './grammar.html', './grammar.js', './grammar.css', './grammar.json',
  './settings.html', './profile.html', './settings.css', './settings.js',
  './study.html', './study.css?v=39', './study.js?v=39',
  './register-sw.js',
  './study-data/topics.json?v=39', './study-data/grammar.json?v=39', './study-data/kanji.json?v=39',
  './study-data/verbs.json?v=39', './study-data/kanji-quiz.json?v=39', './study-data/synonyms.json?v=39',
  './study-data/usage-quiz.json?v=39', './study-data/hard-quiz.json?v=39', './study-data/near-synonyms.json?v=39',
  './study-data/adverbs.json?v=39', './study-data/adverb-patterns.json?v=39', './study-data/bi-kip-answers.json?v=39',
  './study-data/bi-kip.json?v=39', './study-data/connectors.json?v=39', './study-data/exam-tips.json?v=39',
  './study-data/grammar-set.json?v=39', './study-data/jido-tado.json?v=39', './study-data/ebook-grammar.json?v=39',
  './study-data/so-tay-idioms.json?v=39',
];

const isNavRequest = request =>
  request.mode === 'navigate' ||
  (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));

const htmlFallback = url => {
  const path = url.pathname.replace(/\/$/, '/') || '/';
  if (path.endsWith('/study.html') || path.endsWith('/study')) return './study.html';
  if (path.endsWith('/settings.html')) return './settings.html';
  if (path.endsWith('/grammar.html')) return './grammar.html';
  if (path.endsWith('/profile.html')) return './profile.html';
  return './index.html';
};

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
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
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
      }
      return response;
    } catch {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      if (isNavRequest(event.request)) {
        const fallback = await caches.match(htmlFallback(url));
        if (fallback) return fallback;
      }
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});
