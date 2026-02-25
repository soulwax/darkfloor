// File: apps/web/public/sw.js

const CACHE_VERSION = "v2";
const CACHE_NAME = `starchildmusic-${CACHE_VERSION}`;
const STATIC_CACHE_NAME = `starchildmusic-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `starchildmusic-dynamic-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/_next/static/css/app/layout.css",
];

const MAX_DYNAMIC_CACHE_SIZE = 50;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(
              (name) =>
                name !== STATIC_CACHE_NAME && name !== DYNAMIC_CACHE_NAME,
            )
            .map((name) => caches.delete(name)),
        );
      })
      .then(() => self.clients.claim()),
  );
});

const limitCacheSize = (cacheName, size) => {
  caches.open(cacheName).then((cache) => {
    cache.keys().then((keys) => {
      if (keys.length > size) {
        cache.delete(keys[0]).then(() => limitCacheSize(cacheName, size));
      }
    });
  });
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ error: "Offline" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      fetch(request)
        .then((fetchResponse) => {
          if (fetchResponse && fetchResponse.status === 200) {
            const responseClone = fetchResponse.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return fetchResponse;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((response) => {
      return (
        response ||
        fetch(request)
          .then((fetchResponse) => {
            if (!fetchResponse || fetchResponse.status !== 200) {
              return fetchResponse;
            }

            return caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
              cache.put(request, fetchResponse.clone());
              limitCacheSize(DYNAMIC_CACHE_NAME, MAX_DYNAMIC_CACHE_SIZE);
              return fetchResponse;
            });
          })
          .catch(() => {
            if (request.headers.get("accept").includes("text/html")) {
              return caches.match("/");
            }
          })
      );
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "KEEP_ALIVE") {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ status: "alive" });
    }
  }

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
