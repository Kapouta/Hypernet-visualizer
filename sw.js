const CACHE = "relais-hypernet-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./auth.js",
  "./config.js",
  "./callback.html",
  "./style.css",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});

// Allows the page to ask the service worker to show a notification,
// so it still works from the home-screen icon (standalone display).
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SHOW_NOTIFICATION") {
    const { title, body, tag } = e.data.payload;
    self.registration.showNotification(title, {
      body,
      tag,
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      vibrate: [100, 50, 100]
    });
  }
});
