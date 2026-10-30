/**
 * Hot Rides Divas — service worker (Module 2)
 * -------------------------------------------
 * Purpose: Offline shell for solo play. Network-first for index.html so updates
 *          arrive; cache-first for three.js / game assets. Never caches WebSocket
 *          upgrades or /live_config.
 * Connections: registered from index.html / shell-m2.js; precaches APP_SHELL.
 */
/* eslint-disable no-restricted-globals */
const CACHE = 'hrd-m2-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './en.json',
  './es.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL).catch(() => undefined)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isNeverCache(url) {
  const u = url.pathname + url.search;
  if (u.includes('live_config')) return true;
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return true;
  return false;
}

function isHtmlNav(request, url) {
  if (request.mode === 'navigate') return true;
  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/html')) return true;
  const path = url.pathname;
  return path.endsWith('/') || path.endsWith('.html') || path.endsWith('index.html');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try {
    url = new URL(req.url);
  } catch (_) {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (isNeverCache(url)) return;

  // Network-first for HTML so updates arrive; fall back to cache offline
  if (isHtmlNav(req, url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for shell assets / three.js / game files
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
        }
        return res;
      }).catch(() => caches.match(req));
    })
  );
});
