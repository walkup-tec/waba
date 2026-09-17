import { toNonNegativeCents, unitCentsFromTotal } from "./waba-money-cents";
import {
  DISPAROS_ALTERNATIVA_SALE_PACKAGES,
  DISPAROS_BETS_OFICIAL_SALE_PACKAGES,
  DISPAROS_OFICIAL_SALE_PACKAGES,
  type WabaSalePackage,
} from "./waba-pricing.service";

export type SalePricingLaneKey = "outros-oficial" | "bets-oficial" | "alternativa";

export type SalePricingPackage = {
  shipments: number;
  valueCents: number;
  unitPriceCents: number;
};

export type SalePricingLane = {
  key: SalePricingLaneKey;
  segment: "outros" | "bets";
  apiKind: "oficial" | "alternativa";
  packages: SalePricingPackage[];
  minUnitPriceCents: number;
  maxUnitPriceCents: number;
  fromLabel: string;
  rangeLabel: string;
  minPackageLabel: string;
};

export type PublicSalePricingCatalog = {
  source: "sale-packages";
  outros: { oficial: SalePricingLane; alternativa: SalePricingLane };
  bets: { oficial: SalePricingLane };
};

const formatThousandsPtBr = (whole: number): string =>
  String(Math.trunc(Math.abs(whole))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export const formatBrlFromCents = (cents: number): string => {
  const n = toNonNegativeCents(cents);
  const whole = Math.floor(n / 100);
  const frac = String(n % 100).padStart(2, "0");
  return `R$ ${formatThousandsPtBr(whole)},${frac}`;
};

export const formatBrlUnitFromCents = (cents: number): string => formatBrlFromCents(cents);

const mapPackages = (rows: ReadonlyArray<WabaSalePackage>): SalePricingPackage[] =>
  rows.map((pack) => ({
    shipments: pack.shipments,
    valueCents: toNonNegativeCents(pack.valueCents),
    unitPriceCents: unitCentsFromTotal(pack.valueCents, pack.shipments),
  }));

export const buildSalePricingLane = (
  key: SalePricingLaneKey,
  segment: "outros" | "bets",
  apiKind: "oficial" | "alternativa",
  rows: ReadonlyArray<WabaSalePackage>,
): SalePricingLane => {
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
    fromLabel: formatBrlUnitFromCents(minUnitPriceCents),
    rangeLabel:
      minUnitPriceCents && maxUnitPriceCents
        ? `De ${formatBrlUnitFromCents(minUnitPriceCents)} a ${formatBrlUnitFromCents(maxUnitPriceCents)}`
        : "",
    minPackageLabel: first ? formatBrlFromCents(first.valueCents) : "",
  };
};

export const buildPublicSalePricingCatalog = (): PublicSalePricingCatalog => ({
  source: "sale-packages",
  outros: {
    oficial: buildSalePricingLane("outros-oficial", "outros", "oficial", DISPAROS_OFICIAL_SALE_PACKAGES),
    alternativa: buildSalePricingLane("alternativa", "outros", "alternativa", DISPAROS_ALTERNATIVA_SALE_PACKAGES),
  },
  bets: {
    oficial: buildSalePricingLane("bets-oficial", "bets", "oficial", DISPAROS_BETS_OFICIAL_SALE_PACKAGES),
  },
});

const DATA_SALE_PRICE_VALUES = (catalog: PublicSalePricingCatalog): Record<string, string> => ({
  "outros-oficial-from": catalog.outros.oficial.fromLabel,
  "outros-oficial-range": catalog.outros.oficial.rangeLabel,
  "outros-oficial-min": catalog.outros.oficial.minPackageLabel,
  "bets-oficial-from": catalog.bets.oficial.fromLabel,
  "bets-oficial-range": catalog.bets.oficial.rangeLabel,
  "alternativa-from": catalog.outros.alternativa.fromLabel,
  "alternativa-range": catalog.outros.alternativa.rangeLabel,
  "alternativa-min": catalog.outros.alternativa.minPackageLabel,
});

export const applySalePricingCopyToHtml = (
  html: string,
  options?: { segment?: "outros" | "bets"; catalog?: PublicSalePricingCatalog },
): string => {
  const catalog = options?.catalog ?? buildPublicSalePricingCatalog();
  const labels = DATA_SALE_PRICE_VALUES(catalog);
  let out = String(html ?? "");
  for (const [key, value] of Object.entries(labels)) {
    if (!value) continue;
    out = out.replace(new RegExp(`(data-sale-price="${key}"[^>]*>)([^<]*)`, "g"), `$1${value}`);
  }
  const fromLane = options?.segment === "bets" ? catalog.bets.oficial : catalog.outros.oficial;
  out = out.replace(/a partir de R\$ \d{1,3}(?:\.\d{3})*,\d{2}/gi, `a partir de ${fromLane.fromLabel}`);
  return out;
};

export const buildPublicPricingBootstrapScript = (
  catalog: PublicSalePricingCatalog = buildPublicSalePricingCatalog(),
): string => `<script>window.WABA_PUBLIC_PRICING=${JSON.stringify(catalog)};</script>`;

export const injectPublicPricingBootstrap = (html: string): string => {
  const script = buildPublicPricingBootstrapScript();
  if (html.includes("window.WABA_PUBLIC_PRICING=")) return html;
  return html.includes("<head>") ? html.replace("<head>", `<head>\n${script}`) : `${script}${html}`;
};
