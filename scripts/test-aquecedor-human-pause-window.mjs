/**
 * Testes: pausa humana 3h só após 6h pós-Preparando.
 * Uso: node scripts/test-aquecedor-human-pause-window.mjs
 */
const HUMAN_PAUSE_MS = 3 * 60 * 60 * 1000;
const POST_PREPARING_SEND_WINDOW_MS = 6 * 60 * 60 * 1000;
const LABEL = "3 horas pausa humana";

function isWithinPostPreparingSendWindow(row, nowMs = Date.now()) {
  if (!row) return false;
  if (row.phase === "preparing") return true;
  const activatedMs = row.activatedAt ? new Date(row.activatedAt).getTime() : NaN;
  if (!Number.isFinite(activatedMs) || activatedMs <= 0) return false;
  return nowMs < activatedMs + POST_PREPARING_SEND_WINDOW_MS;
}

function canApplyAquecedorHumanPause(row, nowMs = Date.now()) {
  if (!row) return true;
  if (row.phase === "preparing") return false;
  return !isWithinPostPreparingSendWindow(row, nowMs);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const now = Date.now();

assert(canApplyAquecedorHumanPause(null, now) === true, "sem row pode pausar");
assert(
  canApplyAquecedorHumanPause({ phase: "preparing", activatedAt: null }, now) === false,
  "preparando não pausa",
);
assert(
  canApplyAquecedorHumanPause(
    { phase: "active", activatedAt: new Date(now - 60 * 60 * 1000).toISOString() },
    now,
  ) === false,
  "1h pós-preparando: ainda imune",
);
assert(
  canApplyAquecedorHumanPause(
    { phase: "active", activatedAt: new Date(now - 7 * 60 * 60 * 1000).toISOString() },
    now,
  ) === true,
  "7h pós-preparando: pode pausar",
);
assert(HUMAN_PAUSE_MS === 3 * 60 * 60 * 1000, "pausa = 3h");
assert(LABEL === "3 horas pausa humana", "rótulo UI");
assert(!LABEL.includes("espera"), "não usar 'espera' no rótulo");

console.log(JSON.stringify({ ok: true, humanPauseHours: 3, postPreparingHours: 6, label: LABEL }));
