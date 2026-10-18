// RACHEL K3 service worker.
//
// Scope: this file lives at the site root (/sw.js) so it controls the whole
// origin. It is intentionally conservative:
//   - Only same-origin GET requests are handled. Supabase (auth + database)
//     lives on another origin and is never cached.
//   - Navigations use network-first, falling back to the cached copy and then
//     to /offline so the installed app opens with something useful offline.
//   - Hashed build assets under /_next/static are cache-first.
//   - Everything else (RSC/data requests, POST server actions) goes straight
//     to the network.
//   - Web Push: `push` menampilkan notifikasi sistem (muncul walau aplikasi
//     ditutup) dan `notificationclick` memfokuskan/membuka aplikasi pada
//     halaman terkait. Pengirimannya dari server (lib/push.ts).
//
// Bump CACHE_VERSION whenever this file changes to evict old caches.

const CACHE_VERSION = "v2";
const CACHE_NAME = `rachel-k3-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";

const PRECACHE = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // addAll fails the whole install if any URL 404s, so add individually.
      await Promise.all(
        PRECACHE.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {})
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/assets/") ||
    /\.(?:css|js|mjs|png|jpg|jpeg|gif|svg|webp|avif|ico|woff|woff2|ttf|otf)$/.test(
      url.pathname
    )
  );
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === "basic") {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await cache.match(OFFLINE_URL);
    return offline || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok && response.type === "basic") {
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
});

// ---------------------------------------------------------------------------
// Web Push (notifikasi perangkat)
// ---------------------------------------------------------------------------
// Payload dikirim oleh lib/push.ts sebagai JSON: { title, body, url, tag }.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "RACHEL K3";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "rachel-k3",
    data: { url: data.url || "/" },
    vibrate: [80, 40, 80],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Tap notifikasi: fokus tab aplikasi yang sudah terbuka (lalu arahkan ke
// halaman terkait), atau buka jendela baru kalau belum ada.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = new URL(
    (event.notification.data && event.notification.data.url) || "/",
    self.location.origin
  ).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of windows) {
        if (client.url.startsWith(self.location.origin)) {
          await client.focus();
          if ("navigate" in client && client.url !== target) {
            try {
              await client.navigate(target);
            } catch {
              // navigate tidak selalu diizinkan; fokus saja sudah cukup.
            }
          }
          return;
        }
      }

      await self.clients.openWindow(target);
    })()
  );
});
