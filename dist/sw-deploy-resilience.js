/**
 * Service worker — mantém a shell do app disponível durante redeploy (502/503 do proxy).
 * Em navegação com falha de gateway, devolve a última index.html em cache.
 */
const CACHE_SHELL = "waba-deploy-shell-v1";

function isNavigationRequest(request) {
  if (request.mode === "navigate") return true;
  const accept = request.headers.get("accept") || "";
  return request.method === "GET" && accept.includes("text/html");
}

function isProbeRequest(request) {
  try {
    const pathname = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    return (
      pathname === "/health" ||
      pathname === "/ready" ||
      pathname.endsWith("/health") ||
      pathname.endsWith("/ready")
    );
  } catch {
    return false;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || isProbeRequest(request)) return;
  if (!isNavigationRequest(request)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_SHELL);
      try {
        const response = await fetch(request);
        if (response.ok) {
          cache.put(request, response.clone()).catch(() => {});
          if (request.url.endsWith("/") || request.url.includes("index.html")) {
            cache.put("/", response.clone()).catch(() => {});
          }
          return response;
        }
        if (response.status >= 502 && response.status <= 504) {
          const cached = (await cache.match(request)) || (await cache.match("/"));
          if (cached) return cached;
        }
        return response;
      } catch {
        const cached = (await cache.match(request)) || (await cache.match("/"));
        if (cached) return cached;
        throw new Error("offline");
      }
    })()
  );
});
