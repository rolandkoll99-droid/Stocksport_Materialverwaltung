// Service Worker: macht die App offline nutzbar (z. B. in der Eishalle).
// Bei jeder neuen Version VERSION erhöhen, damit alle Geräte die Dateien neu laden.
const VERSION = 'stockmaterial-1.5.0';
const APP_FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(APP_FILES);
    // Excel-Bibliothek für den Offline-Betrieb vormerken; ohne Netz beim ersten Start später nachholen.
    // (cache.add lehnt die „opaque“ Antwort eines fremden Servers ab, daher fetch + put.)
    try { await cache.put(XLSX_URL, await fetch(XLSX_URL, { mode: 'no-cors' })); } catch (e) {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // App-Seite: zuerst Netz (Updates kommen sofort an), ohne Netz aus dem Speicher.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put('./index.html', res.clone());
        return res;
      } catch (e) {
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // Übrige Dateien (Symbole, Manifest, Excel-Bibliothek): zuerst Speicher, sonst Netz und merken.
  if (url.origin === location.origin || req.url === XLSX_URL) {
    event.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') (await caches.open(VERSION)).put(req, res.clone());
      return res;
    })());
  }
});
