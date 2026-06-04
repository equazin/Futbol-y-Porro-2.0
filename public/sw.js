const CACHE_NAME = 'picado-pwa-v2';
const ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/og-image.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Solo manejamos GET del mismo origen. Todo lo demás (POST/PATCH y, sobre
  // todo, las llamadas a Supabase u otras APIs externas) va directo a la red:
  // nunca se cachea, así no se sirven datos viejos.
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return; // deja pasar a la red por defecto
  }

  // Navegación / HTML: network-first. Así un deploy nuevo se ve enseguida;
  // si no hay red, cae al shell cacheado para que funcione offline.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => caches.match('/') || caches.match(request)),
    );
    return;
  }

  // Assets estáticos con hash (JS/CSS/imágenes): cache-first es seguro porque
  // el nombre cambia en cada build. Si no está, lo bajamos y lo guardamos.
  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, copy));
        }
        return res;
      });
    }),
  );
});
