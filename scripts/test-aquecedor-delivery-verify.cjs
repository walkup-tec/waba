/**
 * Testes da confirmação de entrega do aquecedor (anti falso sucesso).
 * Uso: node scripts/test-aquecedor-delivery-verify.cjs
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const helpers = require(path.join(root, "dist/aquecedor/delivery-verify.helpers.js"));
const distIndex = fs.readFileSync(path.join(root, "dist/index.js"), "utf8");
const srcIndex = fs.readFileSync(path.join(root, "src/index.ts"), "utf8");

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else {
    console.log("OK:", msg);
  }
}

const phrase =
  "Bom dia! Tudo bem por aí? Espero que esteja tendo um ótimo dia.";
const tag = "a7k2m9";
const sent = `${phrase} ${tag}`;
const historicSamePhrase = [`${phrase} oldtag1`, `${phrase} xyz789`];

// 1) Needles: só a tag, nunca o prefixo
const needles = helpers.buildAquecedorDeliveryNeedles(sent);
assert(needles.length === 1 && needles[0] === tag, `needles=[${needles.join(",")}] deve ser só a tag`);
assert(!needles.some((n) => n.includes("bom dia")), "needle não pode ser prefixo da frase");

// 2) Bug legado: prefixo daria falso positivo no histórico
assert(
  helpers.legacyWouldFalsePositive({ sentText: sent, historicTexts: historicSamePhrase }) === true,
  "legado (prefixo) geraria falso positivo — cenário do bug",
);

// 3) Nova lógica: histórico com mesma frase NÃO casa a tag nova
const historicPayload = {
  messages: historicSamePhrase.map((text, i) => ({
    key: { fromMe: false, messageTimestamp: 1_700_000_000 + i },
    message: { conversation: text },
  })),
};
assert(
  helpers.evoPayloadIncludesNeedle(historicPayload, needles, {
    requireTokenBoundary: true,
    fromMe: false,
  }) === false,
  "histórico com mesma frase NÃO deve confirmar tag nova",
);

// 4) Payload real com a tag confirma
const realPayload = {
  messages: [
    {
      key: { fromMe: false, messageTimestamp: Math.floor(Date.now() / 1000) },
      message: { conversation: sent },
    },
  ],
};
assert(
  helpers.evoPayloadIncludesNeedle(realPayload, needles, {
    requireTokenBoundary: true,
    fromMe: false,
  }) === true,
  "mensagem real com tag deve confirmar no destino",
);

const origemPayload = {
  messages: [
    {
      key: { fromMe: true, messageTimestamp: Math.floor(Date.now() / 1000) },
      message: { conversation: sent },
    },
  ],
};
assert(
  helpers.evoPayloadIncludesNeedle(origemPayload, needles, {
    requireTokenBoundary: true,
    fromMe: true,
  }) === true,
  "mensagem real com tag deve confirmar na origem (fromMe)",
);

// 5) Decisão: exige os dois lados
assert(
  helpers.decideAquecedorDeliveryConfirmation({
    sawOrigem: false,
    sawDestino: true,
    origem: "1261",
    destino: "Final-2477",
  }).ok === false,
  "só destino → NÃO sucesso (anti histórico EVO)",
);
assert(
  helpers.decideAquecedorDeliveryConfirmation({
    sawOrigem: true,
    sawDestino: false,
    origem: "1261",
    destino: "Final-2477",
  }).ok === false,
  "só origem → NÃO sucesso",
);
assert(
  helpers.decideAquecedorDeliveryConfirmation({
    sawOrigem: false,
    sawDestino: false,
  }).ok === false,
  "nenhum lado → NÃO sucesso",
);
assert(
  helpers.decideAquecedorDeliveryConfirmation({
    sawOrigem: true,
    sawDestino: true,
  }).ok === true,
  "origem + destino → sucesso",
);

// 6) Bodies findMessages nunca vazios / sem remoteJid
const bodies = helpers.buildAquecedorFindMessagesBodies("555181082477@s.whatsapp.net", false);
assert(bodies.length >= 3, "deve haver bodies com remoteJid");
assert(
  bodies.every((b) => {
    const key = b?.where?.key;
    return key && (key.remoteJid || (typeof key === "object" && Object.keys(key).length));
  }),
  "todo body deve ter where.key com remoteJid",
);
assert(
  !bodies.some((b) => Object.keys(b).length === 0 || (b.limit && !b.where)),
  "proibido body global {} ou {limit} sem where",
);

// 7) Guardrails no código empacotado
assert(
  !distIndex.includes("fullText.slice(0, 48)"),
  "dist/index.js não deve usar prefixo slice(0,48)",
);
assert(
  !/findMessages pendente/.test(distIndex),
  "dist não deve marcar sucesso de teste com findMessages pendente",
);
assert(
  /NÃO confirmado no WhatsApp/.test(distIndex),
  "dist deve falhar ciclo teste sem confirmação",
);
assert(
  /delivery-verify\.helpers/.test(distIndex),
  "dist/index.js requer delivery-verify.helpers",
);
assert(
  /buildAquecedorDeliveryNeedles/.test(distIndex),
  "dist usa buildAquecedorDeliveryNeedles",
);
assert(
  /buildAquecedorFindMessagesBodies/.test(srcIndex),
  "src usa buildAquecedorFindMessagesBodies",
);
assert(
  /decideAquecedorDeliveryConfirmation/.test(srcIndex),
  "src usa decideAquecedorDeliveryConfirmation",
);

// 8) Simulação ponta a ponta do cenário do usuário
function simulateUserBugScenario() {
  const needlesNew = helpers.buildAquecedorDeliveryNeedles(sent);
  const onlyHistoricDest = helpers.evoPayloadIncludesNeedle(historicPayload, needlesNew, {
    requireTokenBoundary: true,
    fromMe: false,
  });
  const decision = helpers.decideAquecedorDeliveryConfirmation({
    sawOrigem: false,
    sawDestino: onlyHistoricDest,
    origem: "1261",
    destino: "Final-2477",
  });
  return decision;
}
const sim = simulateUserBugScenario();
assert(sim.ok === false, `cenário usuário (só histórico) → ok=false (got ok=${sim.ok})`);

if (failed) {
  console.error(`\n${failed} teste(s) falharam.`);
  process.exit(1);
}
console.log("\nTodos os testes passaram.");
process.exit(0);
