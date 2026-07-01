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
  "registerInboundUserConfirmed",
  "registerInboundConfirmInFlight",
  "setRegisterInboundPhase",
  "resolveRegisterInboundPhase",
  "scrollRegisterInboundActivePhase",
  'data-phase="instructions"',
  '#register-inbound-progress[data-phase="prompt"] .reg-inbound-waiting',
  'data-phase="verify-receive"',
  "confirmar-envio",
];

const missing = required.filter((token) => !html.includes(token));
if (missing.length) {
  console.error("Faltando no index.html:", missing.join(", "));
  process.exit(1);
}

const forbidden = ["syncRegisterValidationPaneLayout", "scrollRegisterWizardToProgress"];
const stillPresent = forbidden.filter((token) => html.includes(token));
if (stillPresent.length) {
  console.error("Símbolos obsoletos ainda presentes:", stillPresent.join(", "));
  process.exit(2);
}

console.log("OK — modal validação CONFIRMAR: fases progressivas presentes.");
