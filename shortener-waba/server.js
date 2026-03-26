import express from "express";
import Database from "better-sqlite3";
import crypto from "crypto";
import fs from "fs";

const app = express();
const PORT = Number.parseInt(String(process.env.PORT || "3000"), 10) || 3000;
const BASE_SHORT_DOMAIN = (
  process.env.BASE_SHORT_DOMAIN || "https://wabaurl.waba.info"
).replace(/\/+$/, "");
const SHORTENER_API_KEY = String(process.env.SHORTENER_API_KEY || "");
const DB_PATH = process.env.DB_PATH || "/data/shortener.db";

// Atrás do proxy do EasyPanel / Traefik
app.set("trust proxy", 1);

app.use((_req, res, next) => {
  res.setHeader("X-Waba-Shortener", "1");
  next();
});

/** Liveness: responde antes de abrir SQLite (probes costumam usar GET ou HEAD). */
function livenessPayload() {
  return {
    ok: true,
    service: "waba-shortener",
    port: PORT,
    time: new Date().toISOString(),
  };
}

function registerLivenessRoutes() {
  const paths = ["/", "/health", "/healthz", "/ping"];
  for (const p of paths) {
    app.get(p, (_req, res) => {
      res.status(200).json(livenessPayload());
    });
    app.head(p, (_req, res) => {
      res.status(200).end();
    });
  }
  // Alguns load balancers pedem só texto
  app.get("/live.txt", (_req, res) => {
    res.type("text/plain").status(200).send("ok");
  });
}

registerLivenessRoutes();

if (!SHORTENER_API_KEY) {
  console.error("SHORTENER_API_KEY ausente. Defina no EasyPanel (Ambiente).");
  process.exit(1);
}

const dbDir = DB_PATH.includes("/")
  ? DB_PATH.substring(0, DB_PATH.lastIndexOf("/"))
  : ".";
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.exec(`
CREATE TABLE IF NOT EXISTS short_links (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  long_url TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_short_links_tenant ON short_links(tenant_id);
`);

app.use(express.json({ limit: "1mb" }));

/** Readiness: DB acessível */
app.get("/ready", (_req, res) => {
  try {
    db.prepare("SELECT 1 AS n").get();
    res.status(200).json({ ok: true, ready: true });
  } catch {
    res.status(503).json({ ok: false, ready: false });
  }
});
app.head("/ready", (_req, res) => {
  try {
    db.prepare("SELECT 1 AS n").get();
    res.status(200).end();
  } catch {
    res.status(503).end();
  }
});

function auth(req, res, next) {
  const token = String(req.headers["x-api-key"] || "");
  if (!token || token !== SHORTENER_API_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

function normalizeSlug(input) {
  const raw = String(input || "")
    .trim()
    .toLowerCase();
  if (!raw) return "";
  return raw.replace(/[^a-z0-9-_]/g, "").slice(0, 40);
}

function randomSlug(size = 7) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < size; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

app.get("/status", (_req, res) => {
  res.json({ ok: true, db: DB_PATH });
});

app.post("/api/shortlinks", auth, (req, res) => {
  const tenantId = String(req.body?.tenantId || "").trim() || "default";
  const longUrl = String(req.body?.longUrl || "").trim();
  let slug = normalizeSlug(req.body?.slug);

  if (!/^https?:\/\//i.test(longUrl)) {
    return res.status(400).json({ error: "longUrl inválida" });
  }

  if (!slug) slug = randomSlug(7);

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  try {
    const stmt = db.prepare(
      "INSERT INTO short_links (id, slug, long_url, tenant_id, created_at) VALUES (?, ?, ?, ?, ?)",
    );
    stmt.run(id, slug, longUrl, tenantId, now);

    return res.status(201).json({
      id,
      slug,
      shortUrl: `${BASE_SHORT_DOMAIN}/s/${slug}`,
      longUrl,
      tenantId,
      createdAt: now,
    });
  } catch (e) {
    if (
      String(e.message || "")
        .toLowerCase()
        .includes("unique")
    ) {
      return res.status(409).json({ error: "slug já existe" });
    }
    return res.status(500).json({ error: "erro interno ao criar shortlink" });
  }
});

app.get("/s/:slug", (req, res) => {
  const slug = normalizeSlug(req.params.slug);
  if (!slug) return res.status(404).send("Not Found");

  const row = db
    .prepare("SELECT long_url FROM short_links WHERE slug = ?")
    .get(slug);

  if (!row?.long_url) return res.status(404).send("Not Found");

  return res.redirect(302, row.long_url);
});

// Evita mensagem genérica "Cannot GET ..." — prova que é este serviço
app.use((_req, res) => {
  res.status(404).json({
    error: "not_found",
    service: "waba-shortener",
    hint: "Use GET /health ou / para health check",
  });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `[waba-shortener] listening 0.0.0.0:${PORT} pid=${process.pid} db=${DB_PATH}`,
  );
});

server.on("error", (err) => {
  console.error("Falha ao escutar porta do shortener:", {
    code: err?.code,
    message: err?.message,
    port: PORT,
    pid: process.pid,
  });
  process.exit(1);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM recebido, encerrando...");
  server.close(() => process.exit(0));
});
