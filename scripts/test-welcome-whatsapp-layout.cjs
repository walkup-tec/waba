#!/usr/bin/env node
/**
 * Garante que o texto de boas-vindas não use traço U+2501 (corta no iOS)
 * e que o envio desligue o preview OG.
 *
 * Uso: node scripts/test-welcome-whatsapp-layout.cjs
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const welcomeSrc = fs.readFileSync(path.join(ROOT, "src/mail/waba-welcome-whatsapp.service.ts"), "utf8");
const deliverySrc = fs.readFileSync(
  path.join(ROOT, "src/mail/waba-evolution-whatsapp-delivery.service.ts"),
  "utf8",
);
const evoSrc = fs.readFileSync(path.join(ROOT, "src/monitoring/evo-text-alert.client.ts"), "utf8");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exitCode = 1;
}

function ok(msg) {
  console.log("OK:", msg);
}

if (welcomeSrc.includes("━")) fail("template ainda contém U+2501");
else ok("template sem U+2501");

if (!welcomeSrc.includes('WELCOME_TEXT_SEPARATOR = "--------------------"')) {
  fail("separador ASCII ausente");
} else ok("separador ASCII");

if (!welcomeSrc.includes("linkPreview: false")) fail("linkPreview não está false nas boas-vindas");
else ok("linkPreview: false");

if (!welcomeSrc.includes("sendWelcomeCover: true")) fail("sendWelcomeCover não está true");
else ok("sendWelcomeCover: true");

if (!deliverySrc.includes("sendWelcomeCoverBestEffort")) fail("capa JPEG não é enviada após ACK");
else ok("capa após ACK");

if (!evoSrc.includes("body.linkPreview = input.linkPreview")) fail("sendText não propaga linkPreview");
else ok("sendText propaga linkPreview");

if (!evoSrc.includes("sendMedia/{instance}")) fail("sendEvoImageAlert sem sendMedia");
else ok("sendMedia de capa");

const distWelcome = path.join(ROOT, "dist/mail/waba-welcome-whatsapp.service.js");
if (fs.existsSync(distWelcome)) {
  const {
    buildSubscriberWelcomeWhatsAppText,
  } = require(distWelcome);
  const text = buildSubscriberWelcomeWhatsAppText({
    email: "carloscesarbispo40@gmail.com",
    password: "",
    whatsapp: "18998000762",
    loginUrl: "https://waba.draxsistemas.com.br",
    communityLink: "https://chat.whatsapp.com/EoP6r6BIZt83GenpCgvUJ7",
  });
  if (text.includes("━")) fail("texto gerado ainda contém U+2501");
  else ok("texto gerado sem U+2501");
  if (!text.includes("--------------------")) fail("texto gerado sem separador ASCII");
  else ok("texto gerado com separador ASCII");
  if (!text.includes("https://waba.draxsistemas.com.br")) fail("texto sem URL do sistema");
  else ok("texto contém URL do sistema");
  const sepLine = text.split("\n").find((line) => line.startsWith("----"));
  if (!sepLine || [...sepLine].length > 24) fail("separador ASCII ausente ou longo demais");
  else ok(`separador ${[...sepLine].length} chars`);
} else {
  console.log("SKIP: dist ainda não compilado — rode npm run build e repita");
}

if (process.exitCode) {
  console.error("\nlayout boas-vindas: FALHOU");
  process.exit(1);
}
console.log("\nlayout boas-vindas: OK");
