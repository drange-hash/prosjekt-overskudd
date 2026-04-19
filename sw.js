const CACHE = 'overskudd-v2';

const APP_SHELL = [
  '/prosjekt-overskudd/',
  '/prosjekt-overskudd/index.html',
  '/prosjekt-overskudd/manifest.json',
  '/prosjekt-overskudd/icon.svg',
];

// Install: cache app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: fjern gamle cacher
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Apps Script — alltid nettverk (kan ikke caches pga CORS/opaque)
  if (url.hostname === 'script.google.com') return;

  // Google Fonts — stale-while-revalidate
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          const networkFetch = fetch(e.request).then(response => {
            cache.put(e.request, response.clone());
            return response;
          });
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // HTML / navigasjon — network-first så nye versjoner vises umiddelbart,
  // fall tilbake til cache hvis offline
  const erHTML = e.request.mode === 'navigate' ||
                 (e.request.destination === 'document') ||
                 url.pathname.endsWith('/') ||
                 url.pathname.endsWith('.html');

  if (erHTML) {
    e.respondWith(
      fetch(e.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Alt annet (ikon, manifest) — cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response.ok) {
          caches.open(CACHE).then(cache => cache.put(e.request, response.clone()));
        }
        return response;
      });
    })
  );
});
