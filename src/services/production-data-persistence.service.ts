import { accessSync, constants, existsSync, readdirSync, statSync } from "fs";
import path from "path";
import { resolveDataDir, resolveDataFile } from "../data-path";
import { WABA_ENV } from "../load-env";

/** Arquivos JSON críticos em `/app/data` (produção) — nunca sobrescrever no deploy. */
export const PRODUCTION_PERSISTENCE_CATALOG = [
  { id: "subscribers", file: "waba-subscribers.json", label: "Assinantes" },
  { id: "systemUsers", file: "waba-system-users.json", label: "Usuários (staff/master)" },
  { id: "billingOrders", file: "waba-billing-orders.json", label: "Financeiro / pedidos" },
  { id: "coupons", file: "waba-coupons.json", label: "Cupons de desconto" },
  { id: "financeiroSplit", file: "waba-financeiro-split-config.json", label: "Financeiro / split" },
  { id: "financeiroSettlements", file: "waba-financeiro-split-settlements.json", label: "Financeiro / liquidações" },
  { id: "creditUsage", file: "waba-disparos-credit-usage.json", label: "Créditos consumidos" },
  { id: "creditBonus", file: "waba-disparos-bonus-balances.json", label: "Créditos bônus" },
  { id: "campaignIntakes", file: "waba-campaign-intakes.json", label: "Campanhas (wizard)" },
  { id: "disparosLocal", file: "disparos-local-state.json", label: "Campanhas / fila local" },
  { id: "supportTickets", file: "waba-support-tickets.json", label: "Chamados de suporte" },
  { id: "pushMessages", file: "waba-push-messages.json", label: "Push / comunicados" },
  { id: "pushConfig", file: "waba-push-config.json", label: "Push / config comunidade" },
  { id: "instanceOwners", file: "instance-owners.json", label: "Instâncias por assinante" },
  { id: "instanceAliases", file: "instance-aliases.json", label: "Aliases de instâncias" },
  { id: "aquecedorLifecycle", file: "aquecedor-instance-lifecycle.json", label: "Aquecedor / lifecycle" },
  { id: "aquecedorConfig", file: "aquecedor-config.json", label: "Aquecedor / config local" },
  { id: "aquecedorEnviosLog", file: "aquecedor-envios-log.json", label: "Aquecedor / envios" },
  { id: "aquecedorCommandLog", file: "aquecedor-command-log.json", label: "Aquecedor / logs de comando" },
  { id: "runtimeIntent", file: "runtime-intent.json", label: "Motor disparador/aquecedor" },
  {
    id: "aquecedorDesiredOwners",
    file: "aquecedor-desired-owners.json",
    label: "Aquecedor / intenção ligada (pós-redeploy)",
  },
  { id: "adminBadges", file: "waba-admin-master-menu-badges.json", label: "Dashboard / badges admin" },
  { id: "alternativaActivations", file: "alternativa-number-activations.json", label: "Números alternativa" },
] as const;

export type ProductionDataFileStatus = {
  id: string;
  label: string;
  file: string;
  exists: boolean;
  sizeBytes: number;
  updatedAt: string | null;
};

export type ProductionDataPersistenceSnapshot = {
  wabaEnv: string;
  dataDir: string;
  dataDirWritable: boolean;
  fileCount: number;
  catalog: ProductionDataFileStatus[];
  supabaseNote: string;
  deploySafetyNote: string;
};

function isDataDirWritable(dataDir: string): boolean {
  try {
    accessSync(dataDir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function safeStat(filePath: string) {
  try {
    const st = statSync(filePath);
    return { sizeBytes: st.size, updatedAt: st.mtime.toISOString() };
  } catch {
    return { sizeBytes: 0, updatedAt: null };
  }
}

export function getProductionDataPersistenceSnapshot(): ProductionDataPersistenceSnapshot {
  const dataDir = resolveDataDir();
  let fileCount = 0;
  try {
    fileCount = readdirSync(dataDir).length;
  } catch {
    fileCount = 0;
  }

  const catalog: ProductionDataFileStatus[] = PRODUCTION_PERSISTENCE_CATALOG.map((row) => {
    const filePath = resolveDataFile(row.file);
    const exists = existsSync(filePath);
    const stat = exists ? safeStat(filePath) : { sizeBytes: 0, updatedAt: null };
    return {
      id: row.id,
      label: row.label,
      file: row.file,
      exists,
      sizeBytes: stat.sizeBytes,
      updatedAt: stat.updatedAt,
    };
  });

  return {
    wabaEnv: WABA_ENV || "production",
    dataDir,
    dataDirWritable: isDataDirWritable(dataDir),
    fileCount,
    catalog,
    supabaseNote:
      "Campanhas, leads e aquecedor também persistem no Supabase quando SUPABASE_* está configurado.",
    deploySafetyNote:
      WABA_ENV === "v01" || WABA_ENV === "v02"
        ? "Ambiente local isolado (data/v01 ou data/v02)."
        : "Produção: monte volume em /app/data; deploy só atualiza código (dist/), nunca substitua data/ via Git ou FTP.",
  };
}

/** Caminho relativo seguro para logs (sem expor segredos). */
export function describeDataDirForOps(): string {
  const snap = getProductionDataPersistenceSnapshot();
  const present = snap.catalog.filter((f) => f.exists).length;
  return `${snap.dataDir} (${present}/${snap.catalog.length} arquivos críticos presentes, writable=${snap.dataDirWritable})`;
}
