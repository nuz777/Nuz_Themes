const CACHE_NAME = 'nuz-theme-v1';
const MEDIA_CACHE_NAME = 'nuz-media-v1';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/boot-logo.webp',
  '/favicom.ico',
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== MEDIA_CACHE_NAME) {
            return caches.delete(key);
          }
          return undefined;
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle GET requests from the same origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // 1. Navigation requests: Network first, fallback to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  // 2. Audio files (/music/*): Cache First with Range support
  if (url.pathname.startsWith('/music/')) {
    event.respondWith(handleMediaRequest(request));
    return;
  }

  // 3. Static assets (JS chunks, CSS, caratulas, icons, fonts)
  if (
    url.pathname.startsWith('/caratulas/') ||
    url.pathname.startsWith('/lyrics/') ||
    url.pathname.match(/\.(js|css|webp|png|jpg|jpeg|svg|ico|woff2|woff|ttf)$/)
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          return cachedResponse || new Response('Offline', { status: 503 });
        }
      })
    );
    return;
  }
});

/**
 * Handles audio playback requests with full Byte-Range (HTTP 206) support from cache.
 */
async function handleMediaRequest(request) {
  const cache = await caches.open(MEDIA_CACHE_NAME);
  // Match ignoring search/range headers
  const cachedResponse = await cache.match(request.url);

  const rangeHeader = request.headers.get('range');

  if (cachedResponse) {
    if (!rangeHeader) {
      return cachedResponse;
    }

    // Handle range request from cached complete response
    const arrayBuffer = await cachedResponse.arrayBuffer();
    const totalBytes = arrayBuffer.byteLength;

    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10) || 0;
    const end = parts[1] ? parseInt(parts[1], 10) : totalBytes - 1;

    const chunk = arrayBuffer.slice(start, end + 1);

    return new Response(chunk, {
      status: 206,
      statusText: 'Partial Content',
      headers: {
        'Content-Type': cachedResponse.headers.get('Content-Type') || 'audio/mpeg',
        'Content-Range': `bytes ${start}-${end}/${totalBytes}`,
        'Content-Length': chunk.byteLength.toString(),
        'Accept-Ranges': 'bytes',
      },
    });
  }

  // If not cached, fetch from network
  try {
    const networkResponse = await fetch(request);

    // If it's a full 200 response, cache it in background
    if (networkResponse.status === 200) {
      cache.put(request.url, networkResponse.clone());
    }

    return networkResponse;
  } catch (err) {
    if (cachedResponse) return cachedResponse;
    throw err;
  }
}
