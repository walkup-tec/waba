"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.injectPublicPricingBootstrap = exports.buildPublicPricingBootstrapScript = exports.applySalePricingCopyToHtml = exports.buildPublicSalePricingCatalog = exports.buildSalePricingLane = exports.formatBrlUnitFromCents = exports.formatBrlFromCents = void 0;
const waba_money_cents_1 = require("./waba-money-cents");
const waba_pricing_service_1 = require("./waba-pricing.service");
const formatThousandsPtBr = (whole) => String(Math.trunc(Math.abs(whole))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const formatBrlFromCents = (cents) => {
    const n = (0, waba_money_cents_1.toNonNegativeCents)(cents);
    const whole = Math.floor(n / 100);
    const frac = String(n % 100).padStart(2, "0");
    return `R$ ${formatThousandsPtBr(whole)},${frac}`;
};
exports.formatBrlFromCents = formatBrlFromCents;
const formatBrlUnitFromCents = (cents) => (0, exports.formatBrlFromCents)(cents);
exports.formatBrlUnitFromCents = formatBrlUnitFromCents;
const mapPackages = (rows) => rows.map((pack) => ({
    shipments: pack.shipments,
    valueCents: (0, waba_money_cents_1.toNonNegativeCents)(pack.valueCents),
    unitPriceCents: (0, waba_money_cents_1.unitCentsFromTotal)(pack.valueCents, pack.shipments),
}));
const buildSalePricingLane = (key, segment, apiKind, rows) => {
    const packages = mapPackages(rows);
    const units = packages.map((pack) => pack.unitPriceCents).filter((unit) => unit > 0);
    const minUnitPriceCents = units.length ? Math.min(...units) : 0;
    const maxUnitPriceCents = units.length ? Math.max(...units) : 0;
    const first = packages[0];
    return {
        key,
        segment,
        apiKind,
        packages,
        minUnitPriceCents,
        maxUnitPriceCents,
        fromLabel: (0, exports.formatBrlUnitFromCents)(minUnitPriceCents),
        rangeLabel: minUnitPriceCents && maxUnitPriceCents
            ? `De ${(0, exports.formatBrlUnitFromCents)(minUnitPriceCents)} a ${(0, exports.formatBrlUnitFromCents)(maxUnitPriceCents)}`
            : "",
        minPackageLabel: first ? (0, exports.formatBrlFromCents)(first.valueCents) : "",
    };
};
exports.buildSalePricingLane = buildSalePricingLane;
const buildPublicSalePricingCatalog = () => ({
    source: "sale-packages",
    outros: {
        oficial: (0, exports.buildSalePricingLane)("outros-oficial", "outros", "oficial", waba_pricing_service_1.DISPAROS_OFICIAL_SALE_PACKAGES),
        alternativa: (0, exports.buildSalePricingLane)("alternativa", "outros", "alternativa", waba_pricing_service_1.DISPAROS_ALTERNATIVA_SALE_PACKAGES),
    },
    bets: {
        oficial: (0, exports.buildSalePricingLane)("bets-oficial", "bets", "oficial", waba_pricing_service_1.DISPAROS_BETS_OFICIAL_SALE_PACKAGES),
    },
});
exports.buildPublicSalePricingCatalog = buildPublicSalePricingCatalog;
const DATA_SALE_PRICE_VALUES = (catalog) => ({
    "outros-oficial-from": catalog.outros.oficial.fromLabel,
    "outros-oficial-range": catalog.outros.oficial.rangeLabel,
    "outros-oficial-min": catalog.outros.oficial.minPackageLabel,
    "bets-oficial-from": catalog.bets.oficial.fromLabel,
    "bets-oficial-range": catalog.bets.oficial.rangeLabel,
    "alternativa-from": catalog.outros.alternativa.fromLabel,
    "alternativa-range": catalog.outros.alternativa.rangeLabel,
    "alternativa-min": catalog.outros.alternativa.minPackageLabel,
});
const applySalePricingCopyToHtml = (html, options) => {
    const catalog = options?.catalog ?? (0, exports.buildPublicSalePricingCatalog)();
    const labels = DATA_SALE_PRICE_VALUES(catalog);
    let out = String(html ?? "");
    for (const [key, value] of Object.entries(labels)) {
        if (!value)
            continue;
        out = out.replace(new RegExp(`(<[^>]*\\bdata-sale-price="${key}"[^>]*>)([^<]*)`, "g"), `$1${value}`);
    }
    const fromLane = options?.segment === "bets" ? catalog.bets.oficial : catalog.outros.oficial;
    out = out.replace(/a partir de R\$ \d{1,3}(?:\.\d{3})*,\d{2}/gi, `a partir de ${fromLane.fromLabel}`);
    return out;
};
exports.applySalePricingCopyToHtml = applySalePricingCopyToHtml;
const buildPublicPricingBootstrapScript = (catalog = (0, exports.buildPublicSalePricingCatalog)()) => `<script>window.WABA_PUBLIC_PRICING=${JSON.stringify(catalog)};</script>`;
exports.buildPublicPricingBootstrapScript = buildPublicPricingBootstrapScript;
const injectPublicPricingBootstrap = (html) => {
    const script = (0, exports.buildPublicPricingBootstrapScript)();
    if (html.includes("window.WABA_PUBLIC_PRICING="))
        return html;
    return html.includes("<head>") ? html.replace("<head>", `<head>\n${script}`) : `${script}${html}`;
};
exports.injectPublicPricingBootstrap = injectPublicPricingBootstrap;
