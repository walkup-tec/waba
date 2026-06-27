/** Regras do motor de envio API Alternativa (números da fazenda). */

export const ALTERNATIVA_MIN_ACTIVATED_FOR_SEND = 3;
export const ALTERNATIVA_MIN_PURCHASED_FOR_PICKER = 4;
export const ALTERNATIVA_MIN_PURCHASE_QUANTITY = 4;
export const DISPAROS_CAMPAIGN_MIN_CONNECTED_INSTANCES = 4;
export const ALTERNATIVA_MAX_SENDS_PER_DAY_PER_NUMBER = 300;

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

export function getAlternativaDispatchRulesMeta() {
  return {
    minActivatedForSend: ALTERNATIVA_MIN_ACTIVATED_FOR_SEND,
    minPurchasedForPicker: ALTERNATIVA_MIN_PURCHASED_FOR_PICKER,
    minPurchaseQuantity: ALTERNATIVA_MIN_PURCHASE_QUANTITY,
    minConnectedForCampaign: DISPAROS_CAMPAIGN_MIN_CONNECTED_INSTANCES,
    maxSendsPerDayPerNumber: ALTERNATIVA_MAX_SENDS_PER_DAY_PER_NUMBER,
  };
}

/** Calcula delay e limites para respeitar até 300 envios/dia por número na janela de expediente. */
export function computeAlternativaThrottle(input: AlternativaThrottleInput): AlternativaThrottle {
  const startHour = Math.max(0, Math.min(23, Math.floor(Number(input.startHour) || 8)));
  const endHour = Math.max(startHour + 1, Math.min(24, Math.floor(Number(input.endHour) || 22)));
  const hoursPerWindow = endHour - startHour;
  const maxPerDay = ALTERNATIVA_MAX_SENDS_PER_DAY_PER_NUMBER;
  const maxPerHour = Math.max(1, Math.ceil(maxPerDay / hoursPerWindow));
  const avgIntervalSec = Math.max(60, Math.floor((hoursPerWindow * 3600) / maxPerDay));
  const delayMin = Math.max(10, avgIntervalSec - 24);
  const delayMax = Math.min(3600, avgIntervalSec + 24);
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
    const missing = `Ative ao menos ${ALTERNATIVA_MIN_ACTIVATED_FOR_SEND} números para calcular a projeção.`;
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

export function assertAlternativaMinActivated(activatedCount: number): void {
  if (activatedCount < ALTERNATIVA_MIN_ACTIVATED_FOR_SEND) {
    throw new Error(
      `Para disparos pela API Alternativa são necessários ao menos ${ALTERNATIVA_MIN_ACTIVATED_FOR_SEND} números ativados. Você possui ${activatedCount}. Ative mais números em «Comprar números».`
    );
  }
}
