/* Service Worker — fallback offline para public-pages (bets/vendas estáticos).
 * NÃO substitui Cloudflare Always Online. Só ajuda quem JÁ visitou com SW registrado.
 * Versão: waba-public-sw-2026-07-10-v1
 */
const CACHE = "waba-public-offline-v1";
const PRECACHE = ["./", "./bets.html", "./vendas.html", "./cadastro.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => undefined)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        if (res.ok && (req.mode === "navigate" || req.destination === "document" || req.url.includes(".html"))) {
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") {
          return (
            (await caches.match("./bets.html")) ||
            (await caches.match("./vendas.html")) ||
            (await caches.match("./")) ||
            new Response("<h1>Offline</h1><p>Site temporariamente indisponível. Tente novamente em instantes.</p>", {
              headers: { "Content-Type": "text/html; charset=utf-8" },
            })
          );
        }
        return new Response("", { status: 503, statusText: "Offline" });
      }),
  );
});
