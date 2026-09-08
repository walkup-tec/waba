"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wabaPricingService = exports.WabaPricingService = exports.getBaseDisparosSalePackages = exports.DISPAROS_ALTERNATIVA_SALE_PACKAGES = exports.DISPAROS_BETS_OFICIAL_SALE_PACKAGES = exports.DISPAROS_OFICIAL_SALE_PACKAGES = void 0;
const waba_oficial_pricing_overrides_1 = require("./waba-oficial-pricing-overrides");
const waba_money_cents_1 = require("./waba-money-cents");
const waba_subscriber_segment_1 = require("../subscribers/waba-subscriber-segment");
const waba_subscriber_repository_1 = require("../subscribers/waba-subscriber.repository");
const waba_indicator_profile_repository_1 = require("../indicators/waba-indicator-profile.repository");
/** Tabela de venda API Oficial (envios × valor total em centavos). */
exports.DISPAROS_OFICIAL_SALE_PACKAGES = [
    { shipments: 1000, valueCents: 32000 },
    { shipments: 3000, valueCents: 93000 },
    { shipments: 5000, valueCents: 150000 },
    { shipments: 8000, valueCents: 232000 },
    { shipments: 10000, valueCents: 270000 },
    { shipments: 20000, valueCents: 520000 },
    { shipments: 30000, valueCents: 750000 },
];
/** Tabela de venda API Oficial — segmento Bets. */
exports.DISPAROS_BETS_OFICIAL_SALE_PACKAGES = [
    { shipments: 5000, valueCents: 200000 },
    { shipments: 10000, valueCents: 380000 },
    { shipments: 20000, valueCents: 740000 },
    { shipments: 30000, valueCents: 1080000 },
    { shipments: 40000, valueCents: 1400000 },
    { shipments: 50000, valueCents: 1650000 },
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
    customerUnitPriceCents: 0,
    baseAmountCents: 0,
    spreadAmountCents: 0,
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
        const email = String(ownerEmail ?? "").trim().toLowerCase();
        if (!email.includes("@"))
            return { indicatorUserId: "", spreadCentsPerSend: 0 };
        const subscriber = this.subscriberRepository.getByEmail(email);
        const indicatorUserId = String(subscriber?.indicatorUserId ?? "").trim();
        if (!indicatorUserId)
            return { indicatorUserId: "", spreadCentsPerSend: 0 };
        const profile = this.indicatorProfileRepository.getByUserId(indicatorUserId);
        if (!profile || profile.status !== "active") {
            return { indicatorUserId: "", spreadCentsPerSend: 0 };
        }
        return {
            indicatorUserId,
            spreadCentsPerSend: (0, waba_money_cents_1.toNonNegativeCents)(profile.spreadCentsPerSend),
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
        const { indicatorUserId, spreadCentsPerSend } = this.resolveActiveSpreadCentsForOwnerEmail(ownerEmail);
        const spreadAmountCents = (0, waba_money_cents_1.multiplyCents)(spreadCentsPerSend, quantity);
        const totalAmountCents = baseAmountCents + spreadAmountCents;
        return {
            quantity,
            baseUnitPriceCents: (0, waba_money_cents_1.unitCentsFromTotal)(baseAmountCents, quantity),
            spreadUnitPriceCents: spreadCentsPerSend,
            customerUnitPriceCents: (0, waba_money_cents_1.unitCentsFromTotal)(totalAmountCents, quantity),
            baseAmountCents,
            spreadAmountCents,
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
