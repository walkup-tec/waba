import { equivalentOwnedWabaIdsForBusiness, isKnownClientWabaId } from "./meta-whatsapp-known-owned-wabas";

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

export function broadcastNumberMatchesSelectedWaba(input: {
  connectionId: string;
  selected: ReadonlyArray<{ connectionId?: string | null; wabaId?: string | null }>;
  itemWabaId?: string | null;
  portfolioWabaId?: string | null;
  businessId?: string | null;
}): boolean {
  const connectionId = String(input.connectionId || "").trim();
  if (!connectionId) return false;
  const selectedForCard = input.selected
    .filter((row) => String(row.connectionId || "").trim() === connectionId)
    .map((row) => String(row.wabaId || "").trim())
    .filter(Boolean);
  if (!selectedForCard.length) return false;

  const itemWaba = String(input.itemWabaId || "").trim();
  const businessId = String(input.businessId || "").trim();
  const portfolioWaba = String(input.portfolioWabaId || "").trim();
  const portfolioAliases = new Set(equivalentOwnedWabaIdsForBusiness(businessId, portfolioWaba));
  if (portfolioWaba) portfolioAliases.add(portfolioWaba);

  if (!itemWaba) {
    return selectedForCard.some((id) => portfolioAliases.has(id));
  }
  if (selectedForCard.includes(itemWaba)) return true;
  return selectedForCard.some((id) => {
    const selectedAliases = new Set(equivalentOwnedWabaIdsForBusiness(businessId, id));
    return selectedAliases.has(itemWaba);
  });
}

export function listBroadcastNumbersForSelectedWabas(input: {
  portfolios: ReadonlyArray<{
    id?: string | null;
    connectionId?: string | null;
    name?: string | null;
    wabaId?: string | null;
    numbers?: ReadonlyArray<{
      phoneNumberId?: string | null;
      displayPhoneNumber?: string | null;
      verifiedName?: string | null;
      uiStatus?: string | null;
      dispatchStatus?: string | null;
      wabaId?: string | null;
      messagingLimit?: string | null;
    }>;
  }>;
  selected: ReadonlyArray<{ connectionId?: string | null; wabaId?: string | null }>;
  selectedConnectionIds?: ReadonlyArray<string | null | undefined>;
}): Array<{
  phoneNumberId: string;
  connectionId: string;
  portfolioName: string | null;
  wabaId: string | null;
  uiStatus: string;
  dispatchStatus: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  messagingLimit: string;
}> {
  const selected = (input.selected || []).filter((row) => String(row.wabaId || "").trim());
  const selectedConnections = new Set(
    [
      ...(input.selectedConnectionIds || []).map((id) => String(id || "").trim()),
      ...selected.map((row) => String(row.connectionId || "").trim()),
    ].filter(Boolean),
  );
  if (!selected.length && !selectedConnections.size) return [];
  const aliasWabas = new Set<string>();
  for (const row of selected) {
    for (const id of equivalentOwnedWabaIdsForBusiness("", row.wabaId)) aliasWabas.add(id);
  }
  const selectedBizIds = new Set(
    (input.portfolios || [])
      .filter((card) => selectedConnections.has(String(card.connectionId || "").trim()))
      .map((card) => String(card.id || "").trim())
      .filter(Boolean),
  );
  const out: Array<{
    phoneNumberId: string;
    connectionId: string;
    portfolioName: string | null;
    wabaId: string | null;
    uiStatus: string;
    dispatchStatus: string;
    displayPhoneNumber: string | null;
    verifiedName: string | null;
    messagingLimit: string;
  }> = [];
  const seen = new Set<string>();
  for (const card of input.portfolios || []) {
    const cardConnectionId = String(card.connectionId || "").trim();
    const businessId = String(card.id || "").trim();
    const onSelectedCard =
      Boolean(cardConnectionId && selectedConnections.has(cardConnectionId)) ||
      Boolean(businessId && selectedBizIds.has(businessId));
    const connectionId =
      cardConnectionId ||
      (onSelectedCard ? [...selectedConnections][0] || "" : "");
    if (!connectionId && !onSelectedCard) continue;
    const portfolioWaba = String(card.wabaId || "").trim();
    const portfolioName = String(card.name || "").trim() || null;
    for (const number of card.numbers || []) {
      const phoneNumberId = String(number.phoneNumberId || number.displayPhoneNumber || "").trim();
      if (!phoneNumberId || seen.has(phoneNumberId)) continue;
      const itemWaba = String(number.wabaId || "").trim();
      const effectiveWaba = itemWaba || portfolioWaba;
      if (effectiveWaba && isKnownClientWabaId(effectiveWaba) && !aliasWabas.has(effectiveWaba)) {
        continue;
      }
      const match =
        onSelectedCard ||
        Boolean(effectiveWaba && aliasWabas.has(effectiveWaba)) ||
        Boolean(
          connectionId &&
            broadcastNumberMatchesSelectedWaba({
              connectionId,
              selected,
              itemWabaId: number.wabaId,
              portfolioWabaId: card.wabaId,
              businessId: card.id,
            }),
        );
      if (!match) continue;
      seen.add(phoneNumberId);
      out.push({
        phoneNumberId,
        connectionId,
        portfolioName,
        wabaId: effectiveWaba || null,
        uiStatus: String(number.uiStatus || "").trim(),
        dispatchStatus: String(number.dispatchStatus || "livre").trim(),
        displayPhoneNumber: number.displayPhoneNumber ? String(number.displayPhoneNumber) : null,
        verifiedName: number.verifiedName ? String(number.verifiedName) : null,
        messagingLimit: String(number.messagingLimit || "").trim(),
      });
    }
  }
  return out;
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
