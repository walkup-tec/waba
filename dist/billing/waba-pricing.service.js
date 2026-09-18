"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wabaPricingService = exports.WabaPricingService = exports.getBaseDisparosSalePackages = exports.DISPAROS_ALTERNATIVA_SALE_PACKAGES = exports.DISPAROS_BETS_OFICIAL_SALE_PACKAGES = exports.DISPAROS_OFICIAL_SALE_PACKAGES = void 0;
const waba_oficial_pricing_overrides_1 = require("./waba-oficial-pricing-overrides");
const waba_money_cents_1 = require("./waba-money-cents");
const waba_subscriber_segment_1 = require("../subscribers/waba-subscriber-segment");
const waba_subscriber_repository_1 = require("../subscribers/waba-subscriber.repository");
const waba_indicator_profile_repository_1 = require("../indicators/waba-indicator-profile.repository");
const waba_indicator_remuneration_1 = require("../indicators/waba-indicator-remuneration");
/**
 * Única tabela de venda. Modal, tela de Créditos e LPs leem
 * GET /public/pricing (e o checkout autenticado) a partir daqui.
 * Depois de alterar, rode `npm run sync:pricing`.
 */
exports.DISPAROS_OFICIAL_SALE_PACKAGES = [
    { shipments: 5000, valueCents: 180000 },
    { shipments: 8000, valueCents: 280000 },
    { shipments: 10000, valueCents: 330000 },
    { shipments: 20000, valueCents: 620000 },
    { shipments: 30000, valueCents: 900000 },
    { shipments: 40000, valueCents: 1160000 },
    { shipments: 50000, valueCents: 1400000 },
];
/** Tabela de venda API Oficial — segmento Black. */
exports.DISPAROS_BETS_OFICIAL_SALE_PACKAGES = [
    { shipments: 5000, valueCents: 225000 },
    { shipments: 10000, valueCents: 430000 },
    { shipments: 20000, valueCents: 840000 },
    { shipments: 30000, valueCents: 1230000 },
    { shipments: 40000, valueCents: 1600000 },
    { shipments: 50000, valueCents: 1900000 },
];
/** Tabela de venda API Alternativa. */
exports.DISPAROS_ALTERNATIVA_SALE_PACKAGES = [
    { shipments: 1000, valueCents: 20000 },
    { shipments: 3000, valueCents: 57000 },
    { shipments: 5000, valueCents: 85000 },
    { shipments: 8000, valueCents: 128000 },
    { shipments: 10000, valueCents: 150000 },
    { shipments: 20000, valueCents: 280000 },
    { shipments: 30000, valueCents: 390000 },
];
const emptyQuote = (quantity) => ({
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
const getBaseDisparosSalePackages = (apiKind, segment = "outros", ownerEmail = "") => {
    if (segment === "bets") {
        if (apiKind === "alternativa")
            return [];
        return (0, waba_oficial_pricing_overrides_1.applyOficialPerSendSurchargeToPackages)(exports.DISPAROS_BETS_OFICIAL_SALE_PACKAGES, ownerEmail);
    }
    if (apiKind === "oficial") {
        return (0, waba_oficial_pricing_overrides_1.applyOficialPerSendSurchargeToPackages)(exports.DISPAROS_OFICIAL_SALE_PACKAGES, ownerEmail);
    }
    return exports.DISPAROS_ALTERNATIVA_SALE_PACKAGES;
};
exports.getBaseDisparosSalePackages = getBaseDisparosSalePackages;
const resolveBaseAmountCents = (apiKind, shipmentCount, segment, ownerEmail) => {
    if (segment === "bets" && apiKind === "alternativa")
        return null;
    const qty = Math.round(Number(shipmentCount ?? 0));
    if (qty <= 0)
        return null;
    const tables = (0, exports.getBaseDisparosSalePackages)(apiKind, segment, ownerEmail);
    const match = tables.find((pack) => pack.shipments === qty);
    if (match)
        return (0, waba_money_cents_1.toNonNegativeCents)(match.valueCents);
    const lastTier = tables[tables.length - 1];
    if (!lastTier || qty <= lastTier.shipments)
        return null;
    return Math.round((lastTier.valueCents * qty) / lastTier.shipments);
};
class WabaPricingService {
    constructor(subscriberRepository = new waba_subscriber_repository_1.WabaSubscriberRepository(), indicatorProfileRepository = new waba_indicator_profile_repository_1.WabaIndicatorProfileRepository()) {
        this.subscriberRepository = subscriberRepository;
        this.indicatorProfileRepository = indicatorProfileRepository;
    }
    resolveActiveSpreadCentsForOwnerEmail(ownerEmail) {
        const empty = { indicatorUserId: "", spreadCentsPerSend: 0, commissionCentsPerSend: 0 };
        const email = String(ownerEmail ?? "").trim().toLowerCase();
        if (!email.includes("@"))
            return empty;
        const subscriber = this.subscriberRepository.getByEmail(email);
        const indicatorUserId = String(subscriber?.indicatorUserId ?? "").trim();
        if (!indicatorUserId)
            return empty;
        const profile = this.indicatorProfileRepository.getByUserId(indicatorUserId);
        if (!profile || profile.status !== "active")
            return empty;
        return {
            indicatorUserId,
            spreadCentsPerSend: (0, waba_money_cents_1.toNonNegativeCents)(profile.spreadCentsPerSend),
            commissionCentsPerSend: (0, waba_indicator_remuneration_1.resolveIndicatorCommissionCentsPerSend)(profile.commissionCentsPerSend),
        };
    }
    quote(input) {
        const apiKind = input.apiKind;
        if (apiKind !== "oficial" && apiKind !== "alternativa")
            return null;
        const ownerEmail = String(input.ownerEmail ?? "").trim().toLowerCase();
        const segment = input.segment ?? (0, waba_subscriber_segment_1.getSubscriberSegmentByEmail)(ownerEmail);
        const quantity = Math.round(Number(input.shipmentCount ?? 0));
        const baseAmountCents = resolveBaseAmountCents(apiKind, quantity, segment, ownerEmail);
        if (baseAmountCents == null)
            return null;
        const { indicatorUserId, spreadCentsPerSend, commissionCentsPerSend } = this.resolveActiveSpreadCentsForOwnerEmail(ownerEmail);
        const spreadAmountCents = (0, waba_money_cents_1.multiplyCents)(spreadCentsPerSend, quantity);
        const commissionAmountCents = (0, waba_money_cents_1.multiplyCents)(commissionCentsPerSend, quantity);
        const totalAmountCents = baseAmountCents + spreadAmountCents;
        return {
            quantity,
            baseUnitPriceCents: (0, waba_money_cents_1.unitCentsFromTotal)(baseAmountCents, quantity),
            spreadUnitPriceCents: spreadCentsPerSend,
            commissionUnitPriceCents: commissionCentsPerSend,
            customerUnitPriceCents: (0, waba_money_cents_1.unitCentsFromTotal)(totalAmountCents, quantity),
            baseAmountCents,
            spreadAmountCents,
            commissionAmountCents,
            totalAmountCents,
            indicatorUserId,
        };
    }
    listCustomerPackages(input) {
        const ownerEmail = String(input.ownerEmail ?? "").trim().toLowerCase();
        const segment = input.segment ?? (0, waba_subscriber_segment_1.getSubscriberSegmentByEmail)(ownerEmail);
        const base = (0, exports.getBaseDisparosSalePackages)(input.apiKind, segment, ownerEmail);
        const { spreadCentsPerSend } = this.resolveActiveSpreadCentsForOwnerEmail(ownerEmail);
        return base.map((pack) => {
            const valueCents = (0, waba_money_cents_1.toNonNegativeCents)(pack.valueCents) + (0, waba_money_cents_1.multiplyCents)(spreadCentsPerSend, pack.shipments);
            return {
                shipments: pack.shipments,
                valueCents,
                unitPriceCents: (0, waba_money_cents_1.unitCentsFromTotal)(valueCents, pack.shipments),
            };
        });
    }
}
exports.WabaPricingService = WabaPricingService;
exports.wabaPricingService = new WabaPricingService();
