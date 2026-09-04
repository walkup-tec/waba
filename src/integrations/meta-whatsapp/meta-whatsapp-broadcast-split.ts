/** Fracionamento do Disparo Cloud: no máx. 500 envios por número WhatsApp. */

export const META_BROADCAST_MAX_SENDS_PER_NUMBER = 500;

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
    throw new Error("Selecione ao menos um número Ativo e disponível do mesmo portfólio.");
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

export function assignBroadcastLeadsToPhones<T extends object>(
  leads: T[],
  phoneNumberIds: string[],
  maxPerNumber = META_BROADCAST_MAX_SENDS_PER_NUMBER,
): Array<T & { phoneNumberId: string }> {
  const quotas = distributeBroadcastLeadsAcrossPhones(phoneNumberIds, leads.length, maxPerNumber);
  const remaining = new Map(quotas.map((row) => [row.phoneNumberId, row.planned]));
  const order = quotas.map((row) => row.phoneNumberId);
  let cursor = 0;
  return leads.map((lead) => {
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
