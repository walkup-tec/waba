/** Regras do motor de envio API Alternativa (números da fazenda). */

export const ALTERNATIVA_MIN_ACTIVATED_FOR_SEND = 3;
export const ALTERNATIVA_MIN_PURCHASED_FOR_PICKER = 4;
export const ALTERNATIVA_MIN_PURCHASE_QUANTITY = 4;
export const ALTERNATIVA_MAX_SENDS_PER_DAY_PER_NUMBER = 300;

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
  summaryLabel: string;
};

export function getAlternativaDispatchRulesMeta() {
  return {
    minActivatedForSend: ALTERNATIVA_MIN_ACTIVATED_FOR_SEND,
    minPurchasedForPicker: ALTERNATIVA_MIN_PURCHASED_FOR_PICKER,
    minPurchaseQuantity: ALTERNATIVA_MIN_PURCHASE_QUANTITY,
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

export function estimateAlternativaCampaignDuration(params: {
  plannedSendCount: number;
  activatedInstanceCount: number;
  workingDaysPerWeek?: number;
}): AlternativaDurationEstimate {
  const plannedSendCount = Math.max(0, Math.floor(Number(params.plannedSendCount) || 0));
  const activatedInstanceCount = Math.max(0, Math.floor(Number(params.activatedInstanceCount) || 0));
  const workingDaysPerWeek = Math.max(1, Math.min(7, Math.floor(Number(params.workingDaysPerWeek) || 5)));

  if (!plannedSendCount || !activatedInstanceCount) {
    return {
      plannedSendCount,
      activatedInstanceCount,
      sendsPerDay: 0,
      workingDaysNeeded: 0,
      calendarDaysEstimate: 0,
      hoursPerWindow: 0,
      summaryLabel: "Informe a quantidade de envios e ative ao menos 3 números para ver a projeção.",
    };
  }

  const sendsPerDay = activatedInstanceCount * ALTERNATIVA_MAX_SENDS_PER_DAY_PER_NUMBER;
  const workingDaysNeeded = Math.max(1, Math.ceil(plannedSendCount / sendsPerDay));
  const calendarDaysEstimate = Math.max(
    workingDaysNeeded,
    Math.ceil((workingDaysNeeded / workingDaysPerWeek) * 7)
  );

  let summaryLabel: string;
  if (workingDaysNeeded <= 1) {
    summaryLabel = `Projeção: conclusão em até 1 dia útil (${formatQty(sendsPerDay)} envios/dia com ${activatedInstanceCount} número(s)).`;
  } else {
    summaryLabel = `Projeção: cerca de ${workingDaysNeeded} dia(s) úteis (~${calendarDaysEstimate} dia(s) de calendário) para ${formatQty(plannedSendCount)} envios (${formatQty(sendsPerDay)}/dia).`;
  }

  return {
    plannedSendCount,
    activatedInstanceCount,
    sendsPerDay,
    workingDaysNeeded,
    calendarDaysEstimate,
    hoursPerWindow: 0,
    summaryLabel,
  };
}

function formatQty(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

export function assertAlternativaMinActivated(activatedCount: number): void {
  if (activatedCount < ALTERNATIVA_MIN_ACTIVATED_FOR_SEND) {
    throw new Error(
      `Para disparos pela API Alternativa são necessários ao menos ${ALTERNATIVA_MIN_ACTIVATED_FOR_SEND} números ativados. Você possui ${activatedCount}. Ative mais números em «Comprar números».`
    );
  }
}
