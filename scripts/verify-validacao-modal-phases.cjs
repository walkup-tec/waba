#!/usr/bin/env node
/**
 * Verifica símbolos do fluxo progressivo do modal de validação CONFIRMAR.
 */
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "index.html");
const html = fs.readFileSync(htmlPath, "utf8");

const required = [
  "registerInboundUiPhase",
  "setRegisterInboundPhase",
  "resolveRegisterInboundPhase",
  "scrollRegisterInboundActivePhase",
  'data-phase="instructions"',
  'data-phase="verify-receive"',
  "enterRegisterInboundVerifyReceive",
  "DEPLOY-2026-07-02-validacao-confirmar-backend-only",
  "detecta a mensagem automaticamente",
];

const missing = required.filter((token) => !html.includes(token));
if (missing.length) {
  console.error("Faltando no index.html:", missing.join(", "));
  process.exit(1);
}

const forbidden = [
  "syncRegisterValidationPaneLayout",
  "scrollRegisterWizardToProgress",
  "register-inbound-sent-yes-btn",
  "confirmar-envio",
  "scheduleRegisterInboundSentPrompt",
  "Você já enviou a mensagem CONFIRMAR",
];
const stillPresent = forbidden.filter((token) => html.includes(token));
if (stillPresent.length) {
  console.error("Símbolos obsoletos ainda presentes:", stillPresent.join(", "));
  process.exit(2);
}

console.log("OK — modal validação CONFIRMAR: detecção automática no backend.");
