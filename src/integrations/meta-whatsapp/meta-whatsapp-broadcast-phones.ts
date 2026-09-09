/** Números do Disparo Cloud podem vir de vários portfólios; o relatório permanece um só. */

export type MetaBroadcastPhoneCatalogItem = {
  phoneNumberId: string;
  connectionId: string;
  portfolioName: string | null;
  wabaId: string | null;
  uiStatus: string;
  dispatchStatus: string;
};

export type MetaBroadcastPhoneBinding = {
  phoneNumberId: string;
  connectionId: string;
  portfolioName?: string | null;
  wabaId?: string | null;
};

export class BroadcastPhoneSelectionError extends Error {
  readonly reason: "missing" | "unknown" | "inactive" | "busy";

  constructor(reason: BroadcastPhoneSelectionError["reason"], message: string) {
    super(message);
    this.reason = reason;
  }
}

export function indexBroadcastPortfolioPhones(
  portfolios: ReadonlyArray<{
    connectionId?: string | null;
    name?: string | null;
    wabaId?: string | null;
    numbers?: ReadonlyArray<{
      phoneNumberId?: string | null;
      uiStatus?: string | null;
      dispatchStatus?: string | null;
      wabaId?: string | null;
    }>;
  }>,
): Map<string, MetaBroadcastPhoneCatalogItem> {
  const catalog = new Map<string, MetaBroadcastPhoneCatalogItem>();
  for (const card of portfolios || []) {
    const connectionId = String(card.connectionId || "").trim();
    if (!connectionId) continue;
    const portfolioName = String(card.name || "").trim() || null;
    const wabaId = String(card.wabaId || "").trim() || null;
    for (const number of card.numbers || []) {
      const phoneNumberId = String(number.phoneNumberId || "").trim();
      if (!phoneNumberId || catalog.has(phoneNumberId)) continue;
      catalog.set(phoneNumberId, {
        phoneNumberId,
        connectionId,
        portfolioName,
        wabaId: String(number.wabaId || wabaId || "").trim() || null,
        uiStatus: String(number.uiStatus || "").trim(),
        dispatchStatus: String(number.dispatchStatus || "livre").trim(),
      });
    }
  }
  return catalog;
}

export function resolveBroadcastPhoneBindings(
  requestedIds: string[],
  catalog: ReadonlyMap<string, MetaBroadcastPhoneCatalogItem>,
): MetaBroadcastPhoneBinding[] {
  const requested = [...new Set(requestedIds.map((id) => String(id || "").trim()).filter(Boolean))];
  if (!requested.length) {
    throw new BroadcastPhoneSelectionError(
      "missing",
      "Selecione ao menos um número Ativo e disponível.",
    );
  }
  const bindings: MetaBroadcastPhoneBinding[] = [];
  for (const phoneNumberId of requested) {
    const match = catalog.get(phoneNumberId);
    if (!match) {
      throw new BroadcastPhoneSelectionError(
        "unknown",
        "Este número não está nos portfólios conectados.",
      );
    }
    if (match.uiStatus !== "ativo") {
      throw new BroadcastPhoneSelectionError(
        "inactive",
        "O disparo Cloud só sai de um número Ativo.",
      );
    }
    if (match.dispatchStatus === "em_disparo") {
      throw new BroadcastPhoneSelectionError(
        "busy",
        "Este número está ocupado em outro disparo. Ele volta a ficar disponível depois que a campanha for finalizada e o relatório for gerado.",
      );
    }
    bindings.push({
      phoneNumberId: match.phoneNumberId,
      connectionId: match.connectionId,
      portfolioName: match.portfolioName,
      wabaId: match.wabaId,
    });
  }
  return bindings;
}

export function connectionIdByPhoneNumber(
  bindings: ReadonlyArray<MetaBroadcastPhoneBinding>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of bindings) {
    const phone = String(row.phoneNumberId || "").trim();
    const connectionId = String(row.connectionId || "").trim();
    if (phone && connectionId) out[phone] = connectionId;
  }
  return out;
}

export function bindingsFromCampaignPhones(input: {
  phoneNumberIds: string[];
  fallbackConnectionId: string;
  stored?: ReadonlyArray<MetaBroadcastPhoneBinding> | null;
}): MetaBroadcastPhoneBinding[] {
  const stored = Array.isArray(input.stored) ? input.stored : [];
  const byPhone = connectionIdByPhoneNumber(stored);
  const fallback = String(input.fallbackConnectionId || "").trim();
  return input.phoneNumberIds
    .map((id) => String(id || "").trim())
    .filter(Boolean)
    .map((phoneNumberId) => {
      const previous = stored.find((row) => String(row.phoneNumberId || "").trim() === phoneNumberId);
      return {
        phoneNumberId,
        connectionId: byPhone[phoneNumberId] || fallback,
        portfolioName: previous?.portfolioName ?? null,
        wabaId: previous?.wabaId ?? null,
      };
    })
    .filter((row) => row.connectionId);
}

export function attachBroadcastLeadPhoneBindings<T extends { phoneNumberId?: string }>(
  leads: T[],
  bindings: ReadonlyArray<MetaBroadcastPhoneBinding>,
): Array<T & { connectionId: string }> {
  const byPhone = connectionIdByPhoneNumber(bindings);
  return leads.map((lead) => {
    const phone = String(lead.phoneNumberId || "").trim();
    const connectionId = byPhone[phone] || "";
    return { ...lead, connectionId };
  });
}

export function templateMissingOnPortfolioMessage(input: {
  templateName: string;
  portfolioName?: string | null;
}): string {
  const templateName = String(input.templateName || "selecionado").trim() || "selecionado";
  const portfolio = String(input.portfolioName || "").trim();
  const where = portfolio ? `no portfólio ${portfolio}` : "em um dos portfólios selecionados";
  return `O template ${templateName} não está aprovado ${where}. Números desse portfólio só entram neste disparo se o mesmo template (nome e idioma) já estiver aprovado lá.`;
}

export function templateWabaMismatchMessage(input: {
  templateName: string;
  templateWabaId?: string | null;
  phoneWabaId?: string | null;
  portfolioName?: string | null;
}): string {
  const templateName = String(input.templateName || "selecionado").trim() || "selecionado";
  const templateWaba = String(input.templateWabaId || "").trim();
  const phoneWaba = String(input.phoneWabaId || "").trim();
  const portfolio = String(input.portfolioName || "").trim();
  const where = portfolio ? ` (${portfolio})` : "";
  if (templateWaba && phoneWaba) {
    return `O template ${templateName} está na WABA ${templateWaba}. O número${where} está na WABA ${phoneWaba}. A Meta só envia o modelo na mesma conta WhatsApp. No Gerenciador, abra a WABA do template e marque só os números dela.`;
  }
  return templateMissingOnPortfolioMessage({ templateName, portfolioName: input.portfolioName });
}

/** Chip e template precisam ser da mesma WABA. Mesmo BM / mesmo portfólio não basta. */
export function bindingMatchesTemplateWaba(input: {
  connectionId: string;
  wabaId?: string | null;
  templateConnectionId: string;
  templateWabaId?: string | null;
}): boolean {
  const templateWaba = String(input.templateWabaId || "").trim();
  const phoneWaba = String(input.wabaId || "").trim();
  if (templateWaba && phoneWaba) return templateWaba === phoneWaba;
  const connectionId = String(input.connectionId || "").trim();
  const templateConnectionId = String(input.templateConnectionId || "").trim();
  return Boolean(connectionId && templateConnectionId && connectionId === templateConnectionId);
}

export function connectionNeedsLocalTemplate(input: {
  connectionId: string;
  wabaId?: string | null;
  templateConnectionId: string;
  templateWabaId?: string | null;
}): boolean {
  return !bindingMatchesTemplateWaba(input);
}
