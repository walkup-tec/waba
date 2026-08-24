/** Regras do motor de envio API Alternativa (números da fazenda). */

/** Sem mínimo operacional de ativados — campanha exige ≥1 instância selecionada. */
export const ALTERNATIVA_MIN_ACTIVATED_FOR_SEND = 1;
/** Compra/picker de números (loja): mínimo comercial por pedido. */
export const ALTERNATIVA_MIN_PURCHASED_FOR_PICKER = 4;
export const ALTERNATIVA_MIN_PURCHASE_QUANTITY = 4;
/** Mínimo de números conectados para ativar campanha (era 4; agora 1). */
export const DISPAROS_CAMPAIGN_MIN_CONNECTED_INSTANCES = 1;
export const ALTERNATIVA_MAX_SENDS_PER_DAY_PER_NUMBER = 100;

/** Dentro do expediente: 60 min enviando / 14 min pausa (mesmo padrão do aquecedor). */
export const ALTERNATIVA_BURST_ON_MINUTES = 60;
export const ALTERNATIVA_BURST_OFF_MINUTES = 14;
/** Cada pausa do ciclo sorteia duração entre −30% e +30% do valor definido. */
export const ALTERNATIVA_BURST_OFF_VARIATION_RATIO = 0.3;

const DEFAULT_WORKING_DAY_KEYS = ["seg", "ter", "qua", "qui", "sex"];

const WEEKDAY_KEY_TO_JS: Record<string, number> = {
  dom: 0,
  seg: 1,
  ter: 2,
  qua: 3,
  qui: 4,
  sex: 5,
  sab: 6,
};

export type AlternativaThrottleInput = {
  startHour: number;
  endHour: number;
};

export type AlternativaThrottle = {
  delayMinSeconds: number;
  delayMaxSeconds: number;
  maxPerHourPerInstance: number;
  maxPerDayPerInstance: number;
};

export type AlternativaDurationEstimate = {
  plannedSendCount: number;
  activatedInstanceCount: number;
  sendsPerDay: number;
  workingDaysNeeded: number;
  calendarDaysEstimate: number;
  hoursPerWindow: number;
  /** @deprecated use capacityLabel */
  summaryLabel: string;
  capacityLabel: string;
  estimatedCompletionBr: string;
};

export function getAlternativaBurstOffBoundsMinutes(): { min: number; max: number } {
  const base = ALTERNATIVA_BURST_OFF_MINUTES;
  const ratio = ALTERNATIVA_BURST_OFF_VARIATION_RATIO;
  return {
    min: base * (1 - ratio),
    max: base * (1 + ratio),
  };
}

function rollAlternativaBurstOffDurationMs(): number {
  const { min, max } = getAlternativaBurstOffBoundsMinutes();
  const minMs = min * 60_000;
  const maxMs = max * 60_000;
  return minMs + Math.random() * (maxMs - minMs);
}

type AlternativaBurstPhaseState = {
  phase: "on" | "off";
  phaseStartedAtMs: number;
  offDurationMs: number;
};

let alternativaBurstPhaseState: AlternativaBurstPhaseState | null = null;

function initAlternativaBurstPhaseState(now: Date, nowMs: number): AlternativaBurstPhaseState {
  const minutesOfDay =
    now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 + now.getMilliseconds() / 60_000;
  const nominalCycle = ALTERNATIVA_BURST_ON_MINUTES + ALTERNATIVA_BURST_OFF_MINUTES;
  const pos = nominalCycle > 0 ? minutesOfDay % nominalCycle : 0;
  const offDurationMs = rollAlternativaBurstOffDurationMs();
  if (pos < ALTERNATIVA_BURST_ON_MINUTES) {
    return {
      phase: "on",
      phaseStartedAtMs: nowMs - pos * 60_000,
      offDurationMs,
    };
  }
  const offElapsedMin = pos - ALTERNATIVA_BURST_ON_MINUTES;
  return {
    phase: "off",
    phaseStartedAtMs: nowMs - offElapsedMin * 60_000,
    offDurationMs,
  };
}

export function getAlternativaDispatchRulesMeta() {
  const offBounds = getAlternativaBurstOffBoundsMinutes();
  return {
    minActivatedForSend: ALTERNATIVA_MIN_ACTIVATED_FOR_SEND,
    minPurchasedForPicker: ALTERNATIVA_MIN_PURCHASED_FOR_PICKER,
    minPurchaseQuantity: ALTERNATIVA_MIN_PURCHASE_QUANTITY,
    minConnectedForCampaign: DISPAROS_CAMPAIGN_MIN_CONNECTED_INSTANCES,
    maxSendsPerDayPerNumber: ALTERNATIVA_MAX_SENDS_PER_DAY_PER_NUMBER,
    burstOnMinutes: ALTERNATIVA_BURST_ON_MINUTES,
    burstOffMinutes: ALTERNATIVA_BURST_OFF_MINUTES,
    burstOffVariationRatio: ALTERNATIVA_BURST_OFF_VARIATION_RATIO,
    burstOffMinMinutes: offBounds.min,
    burstOffMaxMinutes: offBounds.max,
  };
}

/** Janela liga/pausa humanizada (minutos do dia em SP), independente do expediente.
 * A pausa de cada ciclo é sorteada uma vez em ±30% de ALTERNATIVA_BURST_OFF_MINUTES
 * e permanece estável até o ciclo acabar (não re-sorteia a cada tick).
 */
export function isAlternativaBurstWindowOpen(now: Date): boolean {
  const onMs = ALTERNATIVA_BURST_ON_MINUTES * 60_000;
  if (onMs <= 0) return true;
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return true;

  if (!alternativaBurstPhaseState) {
    alternativaBurstPhaseState = initAlternativaBurstPhaseState(now, nowMs);
  }

  let state = alternativaBurstPhaseState;
  let guard = 0;
  while (guard++ < 10_000) {
    if (state.phase === "on") {
      if (nowMs - state.phaseStartedAtMs < onMs) {
        alternativaBurstPhaseState = state;
        return true;
      }
      state = {
        phase: "off",
        phaseStartedAtMs: state.phaseStartedAtMs + onMs,
        offDurationMs: rollAlternativaBurstOffDurationMs(),
      };
      continue;
    }
    if (nowMs - state.phaseStartedAtMs < state.offDurationMs) {
      alternativaBurstPhaseState = state;
      return false;
    }
    state = {
      phase: "on",
      phaseStartedAtMs: state.phaseStartedAtMs + state.offDurationMs,
      offDurationMs: state.offDurationMs,
    };
  }
  alternativaBurstPhaseState = state;
  return state.phase === "on";
}

/** Delay de “digitando…” proporcional ao tamanho da mensagem (1,8s–8s + jitter). */
export function computeAlternativaTypingDelayMs(messageText: string): number {
  const len = String(messageText || "").length;
  const base = Math.min(8000, Math.max(1800, Math.round(len * 45 + 800)));
  const jitter = Math.floor(Math.random() * 900);
  return base + jitter;
}

/** Calcula delay e limites para respeitar o teto diário por número na janela de expediente.
 * Intervalo entre envios = metade do pacing “cheio” (ex.: 8–22h e 100/dia → ~240–264s).
 */
export function computeAlternativaThrottle(input: AlternativaThrottleInput): AlternativaThrottle {
  const startHour = Math.max(0, Math.min(23, Math.floor(Number(input.startHour) || 8)));
  const endHour = Math.max(startHour + 1, Math.min(24, Math.floor(Number(input.endHour) || 22)));
  const hoursPerWindow = endHour - startHour;
  const maxPerDay = ALTERNATIVA_MAX_SENDS_PER_DAY_PER_NUMBER;
  const maxPerHour = Math.max(1, Math.ceil(maxPerDay / hoursPerWindow));
  const fullAvgIntervalSec = Math.max(60, Math.floor((hoursPerWindow * 3600) / maxPerDay));
  const avgIntervalSec = Math.max(30, Math.floor(fullAvgIntervalSec / 2));
  const jitter = Math.max(6, Math.floor(24 / 2));
  const delayMin = Math.max(10, avgIntervalSec - jitter);
  const delayMax = Math.min(3600, avgIntervalSec + jitter);
  return {
    delayMinSeconds: delayMin,
    delayMaxSeconds: Math.max(delayMin, delayMax),
    maxPerHourPerInstance: maxPerHour,
    maxPerDayPerInstance: maxPerDay,
  };
}

function formatQty(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

function formatCompletionBr(date: Date): string {
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeWorkingDayJsSet(keys?: string[]): Set<number> {
  const src = Array.isArray(keys) && keys.length ? keys : DEFAULT_WORKING_DAY_KEYS;
  const allowed = new Set<number>();
  src.forEach((key) => {
    const day = WEEKDAY_KEY_TO_JS[String(key || "").trim().toLowerCase()];
    if (Number.isFinite(day)) allowed.add(day);
  });
  if (!allowed.size) {
    DEFAULT_WORKING_DAY_KEYS.forEach((key) => {
      const day = WEEKDAY_KEY_TO_JS[key];
      if (Number.isFinite(day)) allowed.add(day);
    });
  }
  return allowed;
}

function cloneAtHour(base: Date, hour: number): Date {
  const d = new Date(base);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function isWorkingDay(date: Date, allowed: Set<number>): boolean {
  return allowed.has(date.getDay());
}

/** Distribui envios ao longo das janelas de expediente (throughput real, não só dias inteiros). */
export function estimateAlternativaCampaignCompletionAt(params: {
  plannedSendCount: number;
  activatedInstanceCount: number;
  startHour?: number;
  endHour?: number;
  workingDayKeys?: string[];
  now?: Date;
}): Date | null {
  const plannedSendCount = Math.max(0, Math.floor(Number(params.plannedSendCount) || 0));
  const activatedInstanceCount = Math.max(0, Math.floor(Number(params.activatedInstanceCount) || 0));
  if (!plannedSendCount || !activatedInstanceCount) return null;

  const startHour = Math.max(0, Math.min(23, Math.floor(Number(params.startHour) || 8)));
  const endHour = Math.max(startHour + 1, Math.min(24, Math.floor(Number(params.endHour) || 22)));
  const hoursPerWindow = endHour - startHour;
  const sendsPerDay = activatedInstanceCount * ALTERNATIVA_MAX_SENDS_PER_DAY_PER_NUMBER;
  const sendsPerHour = sendsPerDay / hoursPerWindow;
  if (!Number.isFinite(sendsPerHour) || sendsPerHour <= 0) return null;

  const allowed = normalizeWorkingDayJsSet(params.workingDayKeys);
  const now = params.now instanceof Date ? new Date(params.now) : new Date();
  let remainingHours = plannedSendCount / sendsPerHour;
  let cursor = new Date(now);
  let guard = 0;

  while (remainingHours > 0.001 && guard < 500) {
    guard += 1;
    if (!isWorkingDay(cursor, allowed)) {
      cursor.setDate(cursor.getDate() + 1);
      cursor = cloneAtHour(cursor, startHour);
      continue;
    }

    const windowStart = cloneAtHour(cursor, startHour);
    const windowEnd = cloneAtHour(cursor, endHour);
    if (cursor < windowStart) {
      cursor = windowStart;
    }
    if (cursor >= windowEnd) {
      cursor.setDate(cursor.getDate() + 1);
      cursor = cloneAtHour(cursor, startHour);
      continue;
    }

    const availableHours = (windowEnd.getTime() - cursor.getTime()) / 3600000;
    if (remainingHours <= availableHours) {
      return new Date(cursor.getTime() + remainingHours * 3600000);
    }

    remainingHours -= availableHours;
    cursor.setDate(cursor.getDate() + 1);
    cursor = cloneAtHour(cursor, startHour);
  }

  return cursor;
}

export function buildAlternativaCapacityLabel(
  sendsPerDay: number,
  activatedInstanceCount: number
): string {
  return `Sua capacidade de envio hoje é de ${formatQty(sendsPerDay)} envios/dia, considerando ${activatedInstanceCount} número(s).`;
}

export function estimateAlternativaCampaignDuration(params: {
  plannedSendCount: number;
  activatedInstanceCount: number;
  workingDaysPerWeek?: number;
  startHour?: number;
  endHour?: number;
  workingDayKeys?: string[];
  now?: Date;
}): AlternativaDurationEstimate {
  const plannedSendCount = Math.max(0, Math.floor(Number(params.plannedSendCount) || 0));
  const activatedInstanceCount = Math.max(0, Math.floor(Number(params.activatedInstanceCount) || 0));
  const workingDaysPerWeek = Math.max(1, Math.min(7, Math.floor(Number(params.workingDaysPerWeek) || 5)));
  const startHour = Math.max(0, Math.min(23, Math.floor(Number(params.startHour) || 8)));
  const endHour = Math.max(startHour + 1, Math.min(24, Math.floor(Number(params.endHour) || 22)));
  const hoursPerWindow = endHour - startHour;

  if (!plannedSendCount) {
    return {
      plannedSendCount,
      activatedInstanceCount,
      sendsPerDay: 0,
      workingDaysNeeded: 0,
      calendarDaysEstimate: 0,
      hoursPerWindow,
      summaryLabel: "Informe a quantidade de envios para ver a projeção.",
      capacityLabel: "Informe a quantidade de envios para ver a projeção.",
      estimatedCompletionBr: "",
    };
  }

  if (!activatedInstanceCount) {
    const missing = "Selecione ao menos 1 número para calcular a projeção.";
    return {
      plannedSendCount,
      activatedInstanceCount,
      sendsPerDay: 0,
      workingDaysNeeded: 0,
      calendarDaysEstimate: 0,
      hoursPerWindow,
      summaryLabel: missing,
      capacityLabel: missing,
      estimatedCompletionBr: "",
    };
  }

  const sendsPerDay = activatedInstanceCount * ALTERNATIVA_MAX_SENDS_PER_DAY_PER_NUMBER;
  const workingDaysNeeded = Math.max(1, Math.ceil(plannedSendCount / sendsPerDay));
  const calendarDaysEstimate = Math.max(
    workingDaysNeeded,
    Math.ceil((workingDaysNeeded / workingDaysPerWeek) * 7)
  );
  const capacityLabel = buildAlternativaCapacityLabel(sendsPerDay, activatedInstanceCount);
  const completionAt = estimateAlternativaCampaignCompletionAt({
    plannedSendCount,
    activatedInstanceCount,
    startHour,
    endHour,
    workingDayKeys: params.workingDayKeys,
    now: params.now,
  });
  const estimatedCompletionBr = completionAt ? formatCompletionBr(completionAt) : "";

  return {
    plannedSendCount,
    activatedInstanceCount,
    sendsPerDay,
    workingDaysNeeded,
    calendarDaysEstimate,
    hoursPerWindow,
    summaryLabel: capacityLabel,
    capacityLabel,
    estimatedCompletionBr,
  };
}

export function assertAlternativaMinActivated(_activatedCount: number): void {
  // Restrição de mínimo de números ativados removida.
  // Campanhas exigem apenas ≥1 instância selecionada (validado no create/start).
}
