import { applyOficialPerSendSurchargeToPackages } from "./waba-oficial-pricing-overrides";
import { multiplyCents, toNonNegativeCents, unitCentsFromTotal } from "./waba-money-cents";
import type { WabaSubscriberSegment } from "../subscribers/waba-subscriber-segment";
import { getSubscriberSegmentByEmail } from "../subscribers/waba-subscriber-segment";
import { WabaSubscriberRepository } from "../subscribers/waba-subscriber.repository";
import { WabaIndicatorProfileRepository } from "../indicators/waba-indicator-profile.repository";
import { resolveIndicatorCommissionCentsPerSend } from "../indicators/waba-indicator-remuneration";

export type DisparosApiKind = "oficial" | "alternativa";

export type WabaSalePackage = {
  shipments: number;
  valueCents: number;
};

export type WabaPricingQuote = {
  quantity: number;
  baseUnitPriceCents: number;
  spreadUnitPriceCents: number;
  commissionUnitPriceCents: number;
  customerUnitPriceCents: number;
  baseAmountCents: number;
  spreadAmountCents: number;
  commissionAmountCents: number;
  totalAmountCents: number;
  indicatorUserId: string;
};

/**
 * Única tabela de venda. Modal, tela de Créditos e LPs leem
 * GET /public/pricing (e o checkout autenticado) a partir daqui.
 * Depois de alterar, rode `npm run sync:pricing`.
 */
export const DISPAROS_OFICIAL_SALE_PACKAGES: ReadonlyArray<WabaSalePackage> = [
  { shipments: 1000, valueCents: 36000 },
  { shipments: 3000, valueCents: 105000 },
  { shipments: 5000, valueCents: 170000 },
  { shipments: 8000, valueCents: 264000 },
  { shipments: 10000, valueCents: 310000 },
  { shipments: 20000, valueCents: 600000 },
  { shipments: 30000, valueCents: 870000 },
];

/** Tabela de venda API Oficial — segmento Bets. */
export const DISPAROS_BETS_OFICIAL_SALE_PACKAGES: ReadonlyArray<WabaSalePackage> = [
  { shipments: 5000, valueCents: 225000 },
  { shipments: 10000, valueCents: 430000 },
  { shipments: 20000, valueCents: 840000 },
  { shipments: 30000, valueCents: 1230000 },
  { shipments: 40000, valueCents: 1600000 },
  { shipments: 50000, valueCents: 1900000 },
];

/** Tabela de venda API Alternativa. */
export const DISPAROS_ALTERNATIVA_SALE_PACKAGES: ReadonlyArray<WabaSalePackage> = [
  { shipments: 1000, valueCents: 20000 },
  { shipments: 3000, valueCents: 57000 },
  { shipments: 5000, valueCents: 85000 },
  { shipments: 8000, valueCents: 128000 },
  { shipments: 10000, valueCents: 150000 },
  { shipments: 20000, valueCents: 280000 },
  { shipments: 30000, valueCents: 390000 },
];

const emptyQuote = (quantity: number): WabaPricingQuote => ({
  quantity: Math.max(0, Math.round(Number(quantity ?? 0))),
  baseUnitPriceCents: 0,
  spreadUnitPriceCents: 0,
  commissionUnitPriceCents: 0,
  customerUnitPriceCents: 0,
  baseAmountCents: 0,
  spreadAmountCents: 0,
  commissionAmountCents: 0,
  totalAmountCents: 0,
  indicatorUserId: "",
});

export const getBaseDisparosSalePackages = (
  apiKind: DisparosApiKind,
  segment: WabaSubscriberSegment = "outros",
  ownerEmail = "",
): ReadonlyArray<WabaSalePackage> => {
  if (segment === "bets") {
    if (apiKind === "alternativa") return [];
    return applyOficialPerSendSurchargeToPackages(DISPAROS_BETS_OFICIAL_SALE_PACKAGES, ownerEmail);
  }
  if (apiKind === "oficial") {
    return applyOficialPerSendSurchargeToPackages(DISPAROS_OFICIAL_SALE_PACKAGES, ownerEmail);
  }
  return DISPAROS_ALTERNATIVA_SALE_PACKAGES;
};

const resolveBaseAmountCents = (
  apiKind: DisparosApiKind,
  shipmentCount: number,
  segment: WabaSubscriberSegment,
  ownerEmail: string,
): number | null => {
  if (segment === "bets" && apiKind === "alternativa") return null;
  const qty = Math.round(Number(shipmentCount ?? 0));
  if (qty <= 0) return null;
  const tables = getBaseDisparosSalePackages(apiKind, segment, ownerEmail);
  const match = tables.find((pack) => pack.shipments === qty);
  if (match) return toNonNegativeCents(match.valueCents);
  const lastTier = tables[tables.length - 1];
  if (!lastTier || qty <= lastTier.shipments) return null;
  return Math.round((lastTier.valueCents * qty) / lastTier.shipments);
};

export class WabaPricingService {
  constructor(
    private readonly subscriberRepository = new WabaSubscriberRepository(),
    private readonly indicatorProfileRepository = new WabaIndicatorProfileRepository(),
  ) {}

  resolveActiveSpreadCentsForOwnerEmail(ownerEmail: string): {
    indicatorUserId: string;
    spreadCentsPerSend: number;
    commissionCentsPerSend: number;
  } {
    const empty = { indicatorUserId: "", spreadCentsPerSend: 0, commissionCentsPerSend: 0 };
    const email = String(ownerEmail ?? "").trim().toLowerCase();
    if (!email.includes("@")) return empty;
    const subscriber = this.subscriberRepository.getByEmail(email);
    const indicatorUserId = String(subscriber?.indicatorUserId ?? "").trim();
    if (!indicatorUserId) return empty;
    const profile = this.indicatorProfileRepository.getByUserId(indicatorUserId);
    if (!profile || profile.status !== "active") return empty;
    return {
      indicatorUserId,
      spreadCentsPerSend: toNonNegativeCents(profile.spreadCentsPerSend),
      commissionCentsPerSend: resolveIndicatorCommissionCentsPerSend(profile.commissionCentsPerSend),
    };
  }

  quote(input: {
    apiKind: DisparosApiKind;
    shipmentCount: number;
    ownerEmail?: string;
    segment?: WabaSubscriberSegment;
  }): WabaPricingQuote | null {
    const apiKind = input.apiKind;
    if (apiKind !== "oficial" && apiKind !== "alternativa") return null;
    const ownerEmail = String(input.ownerEmail ?? "").trim().toLowerCase();
    const segment = input.segment ?? getSubscriberSegmentByEmail(ownerEmail);
    const quantity = Math.round(Number(input.shipmentCount ?? 0));
    const baseAmountCents = resolveBaseAmountCents(apiKind, quantity, segment, ownerEmail);
    if (baseAmountCents == null) return null;
    const { indicatorUserId, spreadCentsPerSend, commissionCentsPerSend } =
      this.resolveActiveSpreadCentsForOwnerEmail(ownerEmail);
    const spreadAmountCents = multiplyCents(spreadCentsPerSend, quantity);
    const commissionAmountCents = multiplyCents(commissionCentsPerSend, quantity);
    const totalAmountCents = baseAmountCents + spreadAmountCents;
    return {
      quantity,
      baseUnitPriceCents: unitCentsFromTotal(baseAmountCents, quantity),
      spreadUnitPriceCents: spreadCentsPerSend,
      commissionUnitPriceCents: commissionCentsPerSend,
      customerUnitPriceCents: unitCentsFromTotal(totalAmountCents, quantity),
      baseAmountCents,
      spreadAmountCents,
      commissionAmountCents,
      totalAmountCents,
      indicatorUserId,
    };
  }

  listCustomerPackages(input: {
    apiKind: DisparosApiKind;
    ownerEmail?: string;
    segment?: WabaSubscriberSegment;
  }): Array<{ shipments: number; valueCents: number; unitPriceCents: number }> {
    const ownerEmail = String(input.ownerEmail ?? "").trim().toLowerCase();
    const segment = input.segment ?? getSubscriberSegmentByEmail(ownerEmail);
    const base = getBaseDisparosSalePackages(input.apiKind, segment, ownerEmail);
    const { spreadCentsPerSend } = this.resolveActiveSpreadCentsForOwnerEmail(ownerEmail);
    return base.map((pack) => {
      const valueCents = toNonNegativeCents(pack.valueCents) + multiplyCents(spreadCentsPerSend, pack.shipments);
      return {
        shipments: pack.shipments,
        valueCents,
        unitPriceCents: unitCentsFromTotal(valueCents, pack.shipments),
      };
    });
  }
}

export const wabaPricingService = new WabaPricingService();
