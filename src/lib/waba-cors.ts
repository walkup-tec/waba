import type { Express, Request, Response, NextFunction } from "express";

const resolveAllowedOrigins = (): string[] => {
  const defaults = [
    "http://localhost:3013",
    "http://127.0.0.1:3013",
    "https://wabadisparos.com.br",
    "https://www.wabadisparos.com.br",
    "https://bet.waba.info",
  ];
  const raw = String(process.env.WABA_CORS_ORIGINS ?? "").trim();
  const items = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return [...new Set([...defaults, ...items])];
};

export const registerWabaCors = (app: Express) => {
  const allowedOrigins = new Set(resolveAllowedOrigins());

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = String(req.headers.origin ?? "").trim();
    if (origin && allowedOrigins.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }
    return next();
  });
};
