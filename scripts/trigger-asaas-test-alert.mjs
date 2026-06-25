import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });

const instance = String(process.env.WABA_ASAAS_MONITOR_ALERT_INSTANCE ?? "5197462102").trim();
const target = String(process.env.WABA_ASAAS_MONITOR_ALERT_WHATSAPP ?? "5551999666841").trim();
const text = "URGENTE: ASAAS\nÉ necessário dar atenção para a integração asaas.";
const base = String(process.env.EVO_API_URL ?? "").trim().replace(/\/$/, "");
const apiKey = String(process.env.EVO_API_KEY ?? "").trim();
const url = `${base}/message/sendText/${encodeURIComponent(instance)}`;

if (!base || !apiKey) {
  console.error("EVO_API_URL ou EVO_API_KEY ausente no .env");
  process.exit(1);
}

const body = {
  number: target.startsWith("55") ? target : `55${target.replace(/\D/g, "")}`,
  text,
  textMessage: { text },
};

const response = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: apiKey },
  body: JSON.stringify(body),
});

const raw = await response.text();
console.log(JSON.stringify({ channel: "whatsapp", httpStatus: response.status, body: raw.slice(0, 300) }, null, 2));
process.exit(response.ok ? 0 : 1);
