/** Fracionamento do Disparo Cloud: no máx. 1000 envios por número WhatsApp. */

export const META_BROADCAST_MAX_SENDS_PER_NUMBER = 1000;

export type MetaBroadcastPhoneQuota = {
  phoneNumberId: string;
  planned: number;
};

export function normalizeBroadcastPhoneNumberIds(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[\s,;]+/)
      : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const id = String(item || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function campaignPhoneNumberIds(row: {
  phoneNumberId?: string | null;
  phoneNumberIds?: string[] | null;
}): string[] {
  const fromArray = normalizeBroadcastPhoneNumberIds(row.phoneNumberIds);
  if (fromArray.length) return fromArray;
  const single = String(row.phoneNumberId || "").trim();
  return single ? [single] : [];
}

export function campaignUsesPhoneNumber(
  row: { phoneNumberId?: string | null; phoneNumberIds?: string[] | null },
  phoneNumberId: string | null | undefined,
): boolean {
  const needle = String(phoneNumberId || "").trim();
  if (!needle) return true;
  return campaignPhoneNumberIds(row).includes(needle);
}

export function minPhonesRequiredForBroadcast(
  totalLeads: number,
  maxPerNumber = META_BROADCAST_MAX_SENDS_PER_NUMBER,
): number {
  const total = Math.max(0, Math.floor(Number(totalLeads) || 0));
  const cap = Math.max(1, Math.floor(Number(maxPerNumber) || META_BROADCAST_MAX_SENDS_PER_NUMBER));
  if (!total) return 0;
  return Math.ceil(total / cap);
}

/**
 * Distribui `totalLeads` de forma equilibrada entre os números, sem ultrapassar o teto.
 * O restante da divisão vai para os primeiros números.
 */
export function distributeBroadcastLeadsAcrossPhones(
  phoneNumberIds: string[],
  totalLeads: number,
  maxPerNumber = META_BROADCAST_MAX_SENDS_PER_NUMBER,
): MetaBroadcastPhoneQuota[] {
  const phones = normalizeBroadcastPhoneNumberIds(phoneNumberIds);
  const total = Math.max(0, Math.floor(Number(totalLeads) || 0));
  const cap = Math.max(1, Math.floor(Number(maxPerNumber) || META_BROADCAST_MAX_SENDS_PER_NUMBER));
  if (!phones.length) {
    throw new Error("Selecione ao menos um número Ativo e disponível.");
  }
  if (!total) {
    return phones.map((phoneNumberId) => ({ phoneNumberId, planned: 0 }));
  }
  const capacity = phones.length * cap;
  if (total > capacity) {
    throw new Error(
      `São necessários pelo menos ${minPhonesRequiredForBroadcast(total, cap)} números Ativos (máx. ${cap} envios por número). Selecionados: ${phones.length}; envios: ${total}.`,
    );
  }
  const base = Math.floor(total / phones.length);
  let remainder = total % phones.length;
  const quotas: MetaBroadcastPhoneQuota[] = [];
  for (const phoneNumberId of phones) {
    let planned = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    if (planned > cap) {
      throw new Error(`A distribuição ultrapassaria ${cap} envios em um número.`);
    }
    quotas.push({ phoneNumberId, planned });
  }
  const sum = quotas.reduce((acc, row) => acc + row.planned, 0);
  if (sum !== total) {
    throw new Error("A distribuição dos envios entre os números não fechou o total.");
  }
  return quotas;
}

export function parseBroadcastPhoneQuotasInput(raw: unknown): MetaBroadcastPhoneQuota[] {
  let list: unknown = raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      list = JSON.parse(raw);
    } catch {
      throw new Error("Não foi possível ler as quantidades de envio por número.");
    }
  }
  if (!Array.isArray(list)) return [];
  const out: MetaBroadcastPhoneQuota[] = [];
  for (const item of list) {
    const row = item && typeof item === "object" ? (item as { phoneNumberId?: unknown; planned?: unknown }) : {};
    const phoneNumberId = String(row.phoneNumberId || "").trim();
    const planned = Math.floor(Number(row.planned));
    if (!phoneNumberId || !Number.isFinite(planned)) continue;
    out.push({ phoneNumberId, planned });
  }
  return out;
}

/**
 * Cotas manuais: cada número 0–teto, soma ≥ 1 e não maior que o total da planilha/campanha.
 * Números com 0 saem do disparo.
 */
export function resolveBroadcastLeadQuotas(
  phoneNumberIds: string[],
  totalLeads: number,
  customQuotas?: Array<{ phoneNumberId?: string; planned?: unknown }> | null,
  maxPerNumber = META_BROADCAST_MAX_SENDS_PER_NUMBER,
): MetaBroadcastPhoneQuota[] {
  const phones = normalizeBroadcastPhoneNumberIds(phoneNumberIds);
  const total = Math.max(0, Math.floor(Number(totalLeads) || 0));
  const cap = Math.max(1, Math.floor(Number(maxPerNumber) || META_BROADCAST_MAX_SENDS_PER_NUMBER));
  if (customQuotas == null) {
    return distributeBroadcastLeadsAcrossPhones(phones, total, cap);
  }
  if (!phones.length) {
    throw new Error("Selecione ao menos um número Ativo e disponível.");
  }
  const allowed = new Set(phones);
  const byPhone = new Map<string, number>();
  for (const id of phones) byPhone.set(id, 0);
  for (const row of customQuotas) {
    const id = String(row.phoneNumberId || "").trim();
    if (!id || !allowed.has(id)) continue;
    const planned = Math.floor(Number(row.planned));
    if (!Number.isFinite(planned) || planned < 0) {
      throw new Error("Informe a quantidade de envios de cada número com um número inteiro.");
    }
    if (planned > cap) {
      throw new Error(`Cada número envia no máximo ${cap} mensagens.`);
    }
    byPhone.set(id, planned);
  }
  const quotas = phones
    .map((phoneNumberId) => ({ phoneNumberId, planned: byPhone.get(phoneNumberId) || 0 }))
    .filter((row) => row.planned > 0);
  if (!quotas.length) {
    throw new Error("Informe ao menos 1 envio em algum número.");
  }
  const sum = quotas.reduce((acc, row) => acc + row.planned, 0);
  if (sum > total) {
    throw new Error(
      `A soma dos envios (${sum}) não pode passar o total da campanha (${total}).`,
    );
  }
  return quotas;
}

export function assignBroadcastLeadsToPhones<T extends object>(
  leads: T[],
  phoneNumberIds: string[],
  maxPerNumber = META_BROADCAST_MAX_SENDS_PER_NUMBER,
  customQuotas?: Array<{ phoneNumberId?: string; planned?: unknown }> | null,
): Array<T & { phoneNumberId: string }> {
  const quotas = resolveBroadcastLeadQuotas(
    phoneNumberIds,
    leads.length,
    customQuotas,
    maxPerNumber,
  );
  const sendCount = quotas.reduce((acc, row) => acc + row.planned, 0);
  const batch = leads.slice(0, sendCount);
  const remaining = new Map(quotas.map((row) => [row.phoneNumberId, row.planned]));
  const order = quotas.map((row) => row.phoneNumberId);
  let cursor = 0;
  return batch.map((lead) => {
    let assigned = "";
    for (let step = 0; step < order.length; step += 1) {
      const idx = (cursor + step) % order.length;
      const phoneNumberId = order[idx];
      const left = remaining.get(phoneNumberId) || 0;
      if (left <= 0) continue;
      remaining.set(phoneNumberId, left - 1);
      cursor = (idx + 1) % order.length;
      assigned = phoneNumberId;
      break;
    }
    if (!assigned) {
      throw new Error("Não foi possível atribuir todos os envios aos números selecionados.");
    }
    return { ...lead, phoneNumberId: assigned };
  });
}
