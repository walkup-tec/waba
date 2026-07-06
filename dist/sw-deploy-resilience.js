/**
 * Service worker — mantém a shell do app disponível durante redeploy (502/503 do proxy).
 * Cache isolado por rota (produção ≠ /version-01). Nunca alias /version-01 → /.
 */
const CACHE_SHELL = "waba-deploy-shell-v3";

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

function expectedShellCacheKey(url) {
  try {
    const pathname = new URL(url).pathname.replace(/\/+$/, "") || "/";
    if (pathname === "/") return "waba-shell-production-root";
    if (pathname === "/version-01" || pathname.startsWith("/version-01/")) {
      return "waba-shell-baseline-version-01";
    }
    if (pathname === "/version-02" || pathname.startsWith("/version-02/")) {
      return "waba-shell-production-version-02";
    }
    return "";
  } catch {
    return "";
  }
}

async function readCachedShell(cache, request) {
  const expected = expectedShellCacheKey(request.url);
  if (!expected) return null;

  const cached = await cache.match(request);
  if (!cached) return null;

  const key = cached.headers.get("X-Waba-Shell-Cache-Key") || "";
  if (key !== expected) {
    await cache.delete(request).catch(() => {});
    return null;
  }
  return cached;
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_SHELL).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || isProbeRequest(request)) return;
  if (!isNavigationRequest(request)) return;

  const expectedKey = expectedShellCacheKey(request.url);
  if (!expectedKey) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_SHELL);
      try {
        const response = await fetch(request);
        if (response.ok) {
          const key = response.headers.get("X-Waba-Shell-Cache-Key") || "";
          if (key === expectedKey) {
            cache.put(request, response.clone()).catch(() => {});
          }
          return response;
        }
        if (response.status >= 502 && response.status <= 504) {
          const cached = await readCachedShell(cache, request);
          if (cached) return cached;
        }
        return response;
      } catch {
        const cached = await readCachedShell(cache, request);
        if (cached) return cached;
        throw new Error("offline");
      }
    })(),
  );
});
