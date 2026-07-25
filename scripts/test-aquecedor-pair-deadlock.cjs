#!/usr/bin/env node
/**
 * Regressão: deadlock |saldo|=1 com lastDirection já curativo.
 * Espelha getPairDirectionAllowed (pós-fix 2026-07-25).
 */
function getPairDirectionAllowed(pair, origem, destino) {
  const from = String(origem || "").trim();
  const to = String(destino || "").trim();
  const direction =
    from.localeCompare(pair.a) === 0 && to.localeCompare(pair.b) === 0 ? "a_to_b" : "b_to_a";
  const nextBalance = direction === "a_to_b" ? pair.balance + 1 : pair.balance - 1;
  const wouldReduce =
    Math.abs(pair.balance) >= 1 && Math.abs(nextBalance) < Math.abs(pair.balance);
  if (pair.lastDirection === direction && pair.totalMessages > 0 && !wouldReduce) {
    return { ok: false, reason: "mesmo sentido consecutivo sem resposta" };
  }
  if (Math.abs(nextBalance) > 2) {
    return { ok: false, reason: "|saldo| excederia 2" };
  }
  if (Math.abs(pair.balance) >= 1 && Math.abs(nextBalance) >= Math.abs(pair.balance)) {
    return { ok: false, reason: "direção não reduz o desequilíbrio" };
  }
  return { ok: true };
}

function legacyBlocked(pair, origem, destino) {
  const from = String(origem || "").trim();
  const to = String(destino || "").trim();
  const direction =
    from.localeCompare(pair.a) === 0 && to.localeCompare(pair.b) === 0 ? "a_to_b" : "b_to_a";
  if (pair.lastDirection === direction && pair.totalMessages > 0) {
    return { ok: false };
  }
  const nextBalance = direction === "a_to_b" ? pair.balance + 1 : pair.balance - 1;
  if (Math.abs(nextBalance) > 2) return { ok: false };
  if (Math.abs(pair.balance) >= 1 && Math.abs(nextBalance) >= Math.abs(pair.balance)) {
    return { ok: false };
  }
  return { ok: true };
}

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else {
    console.log("OK:", msg);
  }
}

// Deadlock clássico: balance +1, lastDirection já é b_to_a (curativo)
const stuck = {
  a: "soma",
  b: "walkup",
  balance: 1,
  lastDirection: "b_to_a",
  totalMessages: 5,
};
assert(legacyBlocked(stuck, "walkup", "soma").ok === false, "legado: curativo repetido BLOQUEAVA");
assert(legacyBlocked(stuck, "soma", "walkup").ok === false, "legado: agravar também bloqueava → deadlock");
assert(getPairDirectionAllowed(stuck, "walkup", "soma").ok === true, "fix: curativo repetido LIBERA (reduz saldo)");
assert(getPairDirectionAllowed(stuck, "soma", "walkup").ok === false, "fix: agravar continua bloqueado");

// Anti ping-pong normal: balance 0, last a_to_b → só b_to_a
const normal = {
  a: "soma",
  b: "walkup",
  balance: 0,
  lastDirection: "a_to_b",
  totalMessages: 2,
};
assert(getPairDirectionAllowed(normal, "soma", "walkup").ok === false, "balance 0: não repetir a_to_b");
assert(getPairDirectionAllowed(normal, "walkup", "soma").ok === true, "balance 0: permitir b_to_a");

if (failed) {
  console.error(`\n${failed} falha(s)`);
  process.exit(1);
}
console.log("\nTodos os testes de deadlock de par passaram.");
