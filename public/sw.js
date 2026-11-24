/*
 * Tawasol demo service worker — safe static caching for a GitHub Pages subpath.
 *
 * Navigation requests always go to the network first, so a new deployment is
 * never hidden behind an old HTML cache. Only built static assets (hashed by
 * Vite) and the app shell response are cached as they are requested, and old
 * caches are removed on activation. API requests are never intercepted.
 */
const CACHE_PREFIX = 'tawasol-static-'
const CACHE_NAME = `${CACHE_PREFIX}v3`
const SCOPE = self.registration.scope
const APP_SHELL = new URL('index.html', SCOPE).href
const STATIC_DESTINATIONS = ['style', 'script', 'image', 'font', 'manifest']

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  )
})

async function cacheStatic(request, response) {
  if (!response.ok || response.type !== 'basic') return
  const cache = await caches.open(CACHE_NAME)
  await cache.put(request, response.clone())
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (!url.href.startsWith(SCOPE)) return
  if (url.pathname.includes('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          void cacheStatic(request, response)
          return response
        })
        .catch(async () => (await caches.match(APP_SHELL)) || (await caches.match(request)) || Response.error()),
    )
    return
  }

  if (!STATIC_DESTINATIONS.includes(request.destination)) return

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          void cacheStatic(request, response)
          return response
        })
        .catch(() => cached || Response.error())

      return cached || network
    }),
  )
})
