import {
  emptyLeadFromCnpj,
  normalizeCnpjDigits,
  WabaLeadsCnpjRepository,
} from "./waba-leads-cnpj.repository";
import {
  buildLeadsCnpjExcelBuffer,
  expandLeadsByMobileForEvo,
  isEvoBrazilMobileDigits,
  sanitizeExportBaseName,
} from "./waba-leads-cnpj-excel.service";
import {
  scrapeCasaDosDadosLeads,
  assertCasaDosDadosCredentials,
  resolvePortalUiMaxPage,
  resolvePortalResumePage,
  isSoftScrapeError,
  isLeadsScrapeError,
  LeadsScrapeError,
} from "./waba-leads-cnpj-casadosdados.adapter";
import {
  enrichLeadsCnpjList,
  formatReceitaWsLegend,
  enrichViaReceitaWs,
  leadLooksEnriched,
} from "./waba-leads-cnpj-enrichment.adapter";
import type {
  WabaLeadsCnpjFilters,
  WabaLeadsCnpjLead,
  WabaLeadsCnpjList,
  WabaLeadsCnpjListSummary,
  WabaLeadsCnpjDownloadSummary,
  WabaLeadsCnpjEnrichQueueSummary,
  WabaLeadsCnpjSituacao,
  WabaLeadsCnpjSource,
  WabaLeadsCnpjTipoPesquisa,
} from "./waba-leads-cnpj.types";

const runningJobs = new Set<string>();
/** Jobs cancelados pelo usuário (Excluir) — interrompe runJob/enrich em andamento. */
const cancelledJobs = new Set<string>();
/** Timers do pipeline automático (1 arquivo/dia → próximo dia a partir do pool). */
const continueTimers = new Map<string, ReturnType<typeof setTimeout>>();
/** Timer global da fila de enriquecimento (1 campanha por dia civil SP). */
let globalEnrichTimer: ReturnType<typeof setTimeout> | null = null;
/**
 * Soft-cap da raspagem Playwright: até N Chromiums em paralelo (default 3).
 * Evidência prod 2026-08-24: 3 dedicados simultâneos → Page crashed / login timeout.
 * Fila segura o restante; override até 12 se o VPS aguentar.
 * Override: CASADOSDADOS_MAX_CONCURRENT_SCRAPES (1–12), CASADOSDADOS_SCRAPE_STAGGER_MS.
 */
type PortalScrapeWaiter = {
  listId: string;
  grant: () => void;
  reject: (err: Error) => void;
  pulse?: ReturnType<typeof setInterval>;
};
const portalScrapeActive = new Set<string>();
const portalScrapeWaiters: PortalScrapeWaiter[] = [];
let lastPortalScrapeLaunchAt = 0;

const SITUACOES = new Set<WabaLeadsCnpjSituacao>(["Ativa", "Baixada", "Inapta", "Nula", "Suspensa"]);
const CONTINUE_POLL_MS = 60_000;
const ABORT_JOB_ERROR = "__MLC_JOB_ABORTED__";
/** Prioridade inicial da fila (pedido do usuário). */
const ENRICH_QUEUE_PREFERRED_FIRST = "portal:corretora de seguros";
/** Evita dois backfills de telefone no mesmo listId. */
const phoneRefreshJobs = new Set<string>();

function resolveMaxConcurrentScrapes(): number {
  // Evidência: 3 Chromiums → Page crashed / login timeout / SEARCH sem CNPJ.
  const raw = Math.round(Number(process.env.CASADOSDADOS_MAX_CONCURRENT_SCRAPES || 2) || 2);
  return Math.max(1, Math.min(12, Number.isFinite(raw) ? raw : 2));
}

function resolveScrapeStaggerMs(): number {
  const raw = Math.round(Number(process.env.CASADOSDADOS_SCRAPE_STAGGER_MS || 12_000) || 12_000);
  return Math.max(0, Math.min(120_000, Number.isFinite(raw) ? raw : 12_000));
}

function formatListaLabel(index: number): string {
  const n = Math.max(1, Math.round(Number(index) || 1));
  return `Lista ${String(n).padStart(2, "0")}`;
}

function portalScrapeQueuePosition(listId: string): number {
  const waitingIdx = portalScrapeWaiters.findIndex((w) => w.listId === listId);
  if (waitingIdx >= 0) return waitingIdx + 1;
  if (portalScrapeActive.has(listId)) return 0;
  return Math.max(1, portalScrapeWaiters.length + portalScrapeActive.size);
}

/**
 * Reserva vaga de Chromium (até max concurrent). Retorna `release()` — sempre em finally.
 * Com stagger: espaça o launch quando outra raspagem já está ativa.
 */
function acquirePortalScrapeSlot(
  listId: string,
  onWaiting?: (info: {
    phase: "queue" | "stagger";
    position: number;
    activeCount: number;
    max: number;
    waitMs?: number;
  }) => void,
): Promise<() => void> {
  const max = resolveMaxConcurrentScrapes();

  return new Promise((resolve, reject) => {
    const release = () => {
      portalScrapeActive.delete(listId);
      while (
        portalScrapeWaiters.length > 0 &&
        portalScrapeActive.size < resolveMaxConcurrentScrapes()
      ) {
        const next = portalScrapeWaiters.shift();
        if (!next) break;
        if (next.pulse) clearInterval(next.pulse);
        next.grant();
      }
    };

    const activate = () => {
      portalScrapeActive.add(listId);
      void (async () => {
        try {
          if (cancelledJobs.has(listId)) {
            release();
            reject(new Error(ABORT_JOB_ERROR));
            return;
          }
          const staggerMs = resolveScrapeStaggerMs();
          if (staggerMs > 0 && lastPortalScrapeLaunchAt > 0) {
            const elapsed = Date.now() - lastPortalScrapeLaunchAt;
            const waitMs = staggerMs - elapsed;
            if (waitMs > 0) {
              onWaiting?.({
                phase: "stagger",
                position: 0,
                activeCount: portalScrapeActive.size,
                max,
                waitMs,
              });
              const deadline = Date.now() + waitMs;
              while (Date.now() < deadline) {
                if (cancelledJobs.has(listId)) {
                  release();
                  reject(new Error(ABORT_JOB_ERROR));
                  return;
                }
                const left = deadline - Date.now();
                await new Promise((r) => setTimeout(r, Math.min(2000, Math.max(50, left))));
              }
            }
          }
          if (cancelledJobs.has(listId)) {
            release();
            reject(new Error(ABORT_JOB_ERROR));
            return;
          }
          lastPortalScrapeLaunchAt = Date.now();
          resolve(release);
        } catch (err) {
          release();
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      })();
    };

    // check+add síncrono: evita race entre vários enqueueJob no mesmo tick.
    if (portalScrapeActive.size < max) {
      activate();
      return;
    }

    const waiter: PortalScrapeWaiter = {
      listId,
      grant: activate,
      reject,
    };
    portalScrapeWaiters.push(waiter);
    onWaiting?.({
      phase: "queue",
      position: portalScrapeWaiters.length,
      activeCount: portalScrapeActive.size,
      max,
    });
    waiter.pulse = setInterval(() => {
      if (cancelledJobs.has(listId)) {
        if (waiter.pulse) clearInterval(waiter.pulse);
        const idx = portalScrapeWaiters.indexOf(waiter);
        if (idx >= 0) portalScrapeWaiters.splice(idx, 1);
        reject(new Error(ABORT_JOB_ERROR));
        return;
      }
      const pos = portalScrapeQueuePosition(listId);
      if (pos > 0) {
        onWaiting?.({
          phase: "queue",
          position: pos,
          activeCount: portalScrapeActive.size,
          max,
        });
      }
    }, 4000);
  });
}

function rejectPortalScrapeWaiter(listId: string) {
  const id = String(listId || "").trim();
  if (!id) return;
  for (let i = portalScrapeWaiters.length - 1; i >= 0; i -= 1) {
    if (portalScrapeWaiters[i].listId !== id) continue;
    const [w] = portalScrapeWaiters.splice(i, 1);
    if (w.pulse) clearInterval(w.pulse);
    w.reject(new Error(ABORT_JOB_ERROR));
  }
}

/** Libera vaga Chromium imediatamente (excluir não pode deixar slot zumbi bloqueando outras listas). */
function forceReleasePortalScrapeSlot(listId: string) {
  const id = String(listId || "").trim();
  if (!id) return;
  rejectPortalScrapeWaiter(id);
  if (!portalScrapeActive.has(id)) return;
  portalScrapeActive.delete(id);
  while (
    portalScrapeWaiters.length > 0 &&
    portalScrapeActive.size < resolveMaxConcurrentScrapes()
  ) {
    const next = portalScrapeWaiters.shift();
    if (!next) break;
    if (next.pulse) clearInterval(next.pulse);
    next.grant();
  }
}

/** Campanhas purgadas por Excluir — bloqueia mergePool/recreate até nova criação. */
const purgedCampaignKeys = new Set<string>();

function markCampaignPurged(campaignKey: string) {
  const key = String(campaignKey || "").trim();
  if (!key) return;
  purgedCampaignKeys.add(key);
}

function clearCampaignPurged(campaignKey: string) {
  const key = String(campaignKey || "").trim();
  if (!key) return;
  purgedCampaignKeys.delete(key);
}

function isCampaignPurged(campaignKey: string): boolean {
  return purgedCampaignKeys.has(String(campaignKey || "").trim());
}

/** Continuação de cópia do portal sem destruir Lista NN já ready (dayKey `YYYY-MM-DD#portal-copy`). */
const PORTAL_COPY_DAY_SUFFIX = "#portal-copy";

function isPortalCopyContinuationList(list: Pick<WabaLeadsCnpjList, "dayKey" | "name">): boolean {
  const day = String(list.dayKey || "");
  if (day.includes(PORTAL_COPY_DAY_SUFFIX)) return true;
  return /\bc[oó]pia portal\b/i.test(String(list.name || ""));
}

function portalCopyContinuationDayKey(today = saoPauloDayKey()): string {
  return `${today}${PORTAL_COPY_DAY_SUFFIX}`;
}

function countLeadsHigienizados(list: WabaLeadsCnpjList): number {
  if (list.status === "ready") {
    return Math.max(0, Math.round(Number(list.leadCount || 0) || 0));
  }
  const leads = Array.isArray(list.leads) ? list.leads : [];
  let n = 0;
  for (const lead of leads) {
    const digits = String(lead?.telefone || "").replace(/\D/g, "");
    // Celular BR: 10–11 nacionais ou 12–13 com DDI 55.
    if (digits.length >= 10 && digits.length <= 13) n += 1;
  }
  return n;
}

/**
 * Métricas da coluna Páginas / CNPJs no histórico.
 * pagesDone = página real da paginação (checkpoint), NÃO estimativa CNPJ/20.
 * (Estimativa por volume escondia pág. 322 com só 1.180 CNPJs → mostrava 59.)
 */
export function resolveScrapeHistoryMetrics(
  list: WabaLeadsCnpjList,
  poolPending: number,
  usedCount: number,
): { pagesDone: number; pagesTotal: number; cnpjCopied: number; volumePages: number } {
  const ckpt = list.scrapeCheckpoint;
  const fromFilter = Math.max(0, Math.round(Number(list.filters?.maxPages || 0) || 0));
  const fromCkptTotal = Math.max(0, Math.round(Number(ckpt?.pagesToFetch || 0) || 0));
  const pagesTotal = Math.max(1, fromCkptTotal || fromFilter || 1000);
  const nextPage = Math.max(0, Math.round(Number(ckpt?.nextPage || 0) || 0));
  const collected = Math.max(0, Math.round(Number(ckpt?.collectedCount || 0) || 0));
  const cnpjCopied = Math.max(collected, poolPending + usedCount);
  const volumePages =
    cnpjCopied > 0 ? Math.min(pagesTotal, Math.max(0, Math.ceil(cnpjCopied / 20))) : 0;
  let ckptPages = 0;
  if (nextPage > 0) {
    ckptPages = Math.max(0, nextPage - 1);
  } else if (list.scrapeCompleted || cnpjCopied > 0) {
    ckptPages = volumePages;
  }
  // Sempre preferir checkpoint (página Oruga real). Volume só se não houver ckpt.
  const pagesDone = ckptPages > 0 ? Math.min(pagesTotal, ckptPages) : volumePages;
  return { pagesDone, pagesTotal, cnpjCopied, volumePages };
}

function toSummary(
  list: WabaLeadsCnpjList,
  downloads: WabaLeadsCnpjDownloadSummary[] = [],
  extras?: { poolPending?: number; campaignFinished?: boolean; usedCount?: number },
): WabaLeadsCnpjListSummary {
  const listaIndex =
    list.listaIndex != null && Number(list.listaIndex) > 0
      ? Math.round(Number(list.listaIndex))
      : null;
  const poolPending = extras?.poolPending ?? 0;
  const usedCount = extras?.usedCount ?? 0;
  const scrape = resolveScrapeHistoryMetrics(list, poolPending, usedCount);
  return {
    id: list.id,
    name: list.name,
    status: list.status,
    source: list.source,
    leadCount: list.leadCount,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt || list.createdAt || null,
    generatedAt: list.generatedAt,
    exportFileName: list.exportFileName,
    error: list.error,
    progressMessage: list.progressMessage ?? null,
    dayKey: list.dayKey ?? null,
    campaignKey: list.campaignKey ?? null,
    listaIndex,
    listaLabel: listaIndex ? formatListaLabel(listaIndex) : null,
    downloadedAt: list.downloadedAt ?? null,
    campaignDownloads: downloads,
    poolPending,
    campaignFinished: Boolean(extras?.campaignFinished),
    pagesDone: scrape.pagesDone,
    pagesTotal: scrape.pagesTotal,
    cnpjCopied: scrape.cnpjCopied,
    leadsHigienizados: countLeadsHigienizados(list),
  };
}

/** Dia civil em America/Sao_Paulo (YYYY-MM-DD). */
export function saoPauloDayKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Nome base da campanha (sem sufixo · YYYY-MM-DD). */
export function campaignBaseName(name: string): string {
  return String(name || "")
    .trim()
    .replace(/\s*·\s*\d{4}-\d{2}-\d{2}\s*$/, "")
    .trim();
}

export function buildCampaignKey(baseName: string, source: WabaLeadsCnpjSource): string {
  return `${source}:${campaignBaseName(baseName).toLowerCase()}`;
}

/**
 * Limite diário de enriquecimento.
 * N8n Wait1 = 30s entre consultas ReceitaWS → ~2 CNPJs/minuto → até ~2880/dia.
 * Override: LEADS_CNPJ_DAILY_LIMIT.
 */
export function resolveDailyEnrichLimit(): number {
  const delayMs = Math.max(
    1000,
    Math.round(Number(process.env.RECEITAWS_DELAY_MS || 30000) || 30000),
  );
  const fromRate = Math.max(1, Math.floor((24 * 60 * 60 * 1000) / delayMs));
  const configured = Number(process.env.LEADS_CNPJ_DAILY_LIMIT || 0);
  if (Number.isFinite(configured) && configured > 0) {
    return Math.min(Math.round(configured), fromRate);
  }
  return fromRate;
}

function asBool(value: unknown, fallback = false): boolean {
  if (value === true || value === false) return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return fallback;
}

function asText(value: unknown, max = 200): string | undefined {
  const text = String(value ?? "").trim().slice(0, max);
  return text || undefined;
}

/** CNAE colado com máscara (ex.: 6619-3/02) → só dígitos; nome textual permanece. */
export function normalizeAtividadePrincipalCnae(value: unknown): string | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  if (/\d/.test(raw) && /^[\d\s.\-\/]+$/.test(raw)) {
    const digits = raw.replace(/\D/g, "").slice(0, 20);
    return digits || undefined;
  }
  return raw.slice(0, 120);
}

export function parseLeadsCnpjFilters(raw: unknown): WabaLeadsCnpjFilters {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const situacaoRaw = Array.isArray(input.situacaoCadastral)
    ? input.situacaoCadastral
    : String(input.situacaoCadastral || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  const situacaoCadastral = situacaoRaw
    .map((s) => String(s))
    .filter((s): s is WabaLeadsCnpjSituacao => SITUACOES.has(s as WabaLeadsCnpjSituacao));

  const tipo = String(input.tipoPesquisa || "Exata").trim();
  const tipoPesquisa = (tipo === "Aproximada" ? "Aproximada" : "Exata") as WabaLeadsCnpjTipoPesquisa;
  const maxPagesRaw = Number(input.maxPages);
  // 0 / NaN / ausente = sem teto (copia até o teto da UI do portal = 1000).
  // Valor >0 = teto manual, limitado a 1000 (portal Oruga não navega além).
  const maxPages = Number.isFinite(maxPagesRaw)
    ? Math.max(0, Math.min(1000, Math.round(maxPagesRaw)))
    : 0;

  return {
    cnpj: asText(input.cnpj, 5000),
    buscaTextual: asText(input.buscaTextual, 200),
    buscaEmRazaoSocial: asBool(input.buscaEmRazaoSocial, true),
    buscaEmNomeFantasia: asBool(input.buscaEmNomeFantasia, true),
    buscaEmNomeSocio: asBool(input.buscaEmNomeSocio, true),
    tipoPesquisa,

    cnpjRaiz: asText(input.cnpjRaiz, 8)?.replace(/\D/g, "").slice(0, 8),
    situacaoCadastral: situacaoCadastral.length ? situacaoCadastral : ["Ativa"],
    atividadePrincipalCnae: normalizeAtividadePrincipalCnae(input.atividadePrincipalCnae),
    incluirAtividadeSecundaria: asBool(input.incluirAtividadeSecundaria, false),
    naturezaJuridica: asText(input.naturezaJuridica, 120),

    estadoUf: asText(input.estadoUf || input.uf, 2)?.toUpperCase(),
    municipio: asText(input.municipio || input.cidade, 120),
    bairro: asText(input.bairro, 120),
    cep: asText(input.cep, 8)?.replace(/\D/g, "").slice(0, 8),
    ddd: asText(input.ddd, 2)?.replace(/\D/g, "").slice(0, 2),
    telefone: asText(input.telefone, 11)?.replace(/\D/g, "").slice(0, 11),

    dataAberturaDe: asText(input.dataAberturaDe, 20),
    dataAberturaAte: asText(input.dataAberturaAte, 20),
    capitalSocialMin: asText(input.capitalSocialMin, 40),
    capitalSocialMax: asText(input.capitalSocialMax, 40),
    empresasExcluidasMei: asBool(input.empresasExcluidasMei, false),
    excluidasMeiDe: asText(input.excluidasMeiDe, 20),
    excluidasMeiAte: asText(input.excluidasMeiAte, 20),
    empresasExcluidasSimples: asBool(input.empresasExcluidasSimples, false),
    excluidasSimplesDe: asText(input.excluidasSimplesDe, 20),
    excluidasSimplesAte: asText(input.excluidasSimplesAte, 20),
    porteEmpresa: asText(input.porteEmpresa, 80),

    somenteMei: asBool(input.somenteMei, false),
    excluirMei: asBool(input.excluirMei, false),
    somenteMatriz: asBool(input.somenteMatriz, false),
    somenteFilial: asBool(input.somenteFilial, false),
    empresasDoSimples: asBool(input.empresasDoSimples, false),
    excluirEmpresasDoSimples: asBool(input.excluirEmpresasDoSimples, false),
    comContatoTelefone: asBool(input.comContatoTelefone || input.somenteComTelefone, false),
    somenteFixo: asBool(input.somenteFixo, false),
    somenteCelular: asBool(input.somenteCelular, false),
    comEmail: asBool(input.comEmail || input.somenteComEmail, false),
    excluirEmpresasVisualizadas: asBool(input.excluirEmpresasVisualizadas, false),
    excluirEmailContab: asBool(input.excluirEmailContab, false),

    maxPages,
  };
}

function parseManualLeads(raw: unknown): WabaLeadsCnpjLead[] {
  if (Array.isArray(raw)) {
    const leads: WabaLeadsCnpjLead[] = [];
    for (const item of raw) {
      if (typeof item === "string") {
        const cnpj = normalizeCnpjDigits(item);
        if (cnpj.length === 14) leads.push(emptyLeadFromCnpj(cnpj));
        continue;
      }
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const cnpj = normalizeCnpjDigits(row.cnpj || row.CNPJ);
      if (cnpj.length !== 14) continue;
      leads.push({
        cnpj,
        nome: String(row.nome || row.Nome || "").trim(),
        telefone: String(row.telefone || row.Telefone || "").trim(),
        email: String(row.email || row.Email || "").trim(),
        situacao: String(row.situacao || row.Situação || "").trim(),
        dataAbertura: String(row.dataAbertura || row["Data de Abertura"] || "").trim(),
        cidade: String(row.cidade || row.Cidade || "").trim(),
        estado: String(row.estado || row.Estado || "").trim(),
        endereco: String(row.endereco || row.Endereço || "").trim(),
      });
    }
    return dedupeLeads(leads);
  }
  const text = String(raw || "");
  if (!text.trim()) return [];
  const matches = text.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{14}/g) || [];
  return dedupeLeads(matches.map((m) => emptyLeadFromCnpj(m)).filter((l) => l.cnpj.length === 14));
}

function dedupeLeads(leads: WabaLeadsCnpjLead[]): WabaLeadsCnpjLead[] {
  const map = new Map<string, WabaLeadsCnpjLead>();
  for (const lead of leads) {
    if (!map.has(lead.cnpj)) map.set(lead.cnpj, lead);
  }
  return [...map.values()];
}

export class WabaLeadsCnpjService {
  private readonly repository = new WabaLeadsCnpjRepository();

  listSummaries(): WabaLeadsCnpjListSummary[] {
    return this.listHistory().items;
  }

  /** Histórico + fila global (legenda na UI). */
  listHistory(): {
    items: WabaLeadsCnpjListSummary[];
    enrichQueue: WabaLeadsCnpjEnrichQueueSummary;
  } {
    const lists = this.repository.list();
    const downloadsByCampaign = new Map<string, WabaLeadsCnpjDownloadSummary[]>();
    for (const list of lists) {
      if (list.status !== "ready" || !list.exportFileName) continue;
      const key = String(list.campaignKey || "").trim();
      if (!key) continue;
      const idx =
        list.listaIndex != null && Number(list.listaIndex) > 0
          ? Math.round(Number(list.listaIndex))
          : 1;
      const row: WabaLeadsCnpjDownloadSummary = {
        id: list.id,
        listaIndex: idx,
        listaLabel: formatListaLabel(idx),
        dayKey: list.dayKey ?? null,
        downloadedAt: list.downloadedAt ?? null,
        exportFileName: list.exportFileName,
      };
      const arr = downloadsByCampaign.get(key) || [];
      arr.push(row);
      downloadsByCampaign.set(key, arr);
    }
    for (const [, arr] of downloadsByCampaign) {
      arr.sort((a, b) => a.listaIndex - b.listaIndex);
    }

    const items = lists
      .slice()
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .map((list) => {
        const key = String(list.campaignKey || "").trim();
        const poolPending = key
          ? this.repository.getPool(key)?.pending.length || 0
          : 0;
        const usedCount = key ? this.repository.collectUsedCnpjs(key).size : 0;
        const busySame = key
          ? lists.some(
              (l) =>
                String(l.campaignKey || "").trim() === key &&
                (l.status === "enriching" ||
                  l.status === "queued" ||
                  l.status === "scraping" ||
                  l.status === "draft"),
            )
          : false;
        const campaignFinished = Boolean(key) && poolPending === 0 && !busySame;
        return toSummary(list, key ? downloadsByCampaign.get(key) || [] : [], {
          poolPending,
          campaignFinished,
          usedCount,
        });
      });

    return { items, enrichQueue: this.getEnrichQueueSummary() };
  }

  getEnrichQueueSummary(): WabaLeadsCnpjEnrichQueueSummary {
    const q = this.repository.getEnrichQueue();
    const order = (q.order || []).length ? q.order : this.rebuildEnrichOrder();
    const work = new Set(this.campaignsWithEnrichWork());
    const nameByKey = new Map<string, string>();
    for (const pool of this.repository.listPools()) {
      nameByKey.set(pool.key, pool.name);
    }
    for (const list of this.repository.list()) {
      const key = String(list.campaignKey || "").trim();
      if (key && !nameByKey.has(key)) nameByKey.set(key, campaignBaseName(list.name));
    }
    const entries = order.map((key, i) => {
      let state: "active" | "waiting" | "done" | "idle" = "idle";
      if (q.activeCampaignKey && key === q.activeCampaignKey) state = "active";
      else if (q.lastCompletedCampaignKey && key === q.lastCompletedCampaignKey) state = "done";
      else if (work.has(key)) state = "waiting";
      return {
        key,
        name: nameByKey.get(key) || key.replace(/^portal:/, ""),
        position: i + 1,
        state,
      };
    });
    return {
      dayKey: q.dayKey || saoPauloDayKey(),
      activeCampaignKey: q.activeCampaignKey,
      lastCompletedCampaignKey: q.lastCompletedCampaignKey,
      entries,
    };
  }

  getById(id: string): WabaLeadsCnpjList | null {
    return this.repository.getById(id);
  }

  getDownload(id: string): { filePath: string; fileName: string; downloadName: string } | null {
    const list = this.repository.getById(id);
    if (!list || list.status !== "ready" || !list.exportFileName) return null;
    const filePath = this.repository.resolveExportPath(list.exportFileName);
    if (!filePath) return null;
    const idx =
      list.listaIndex != null && Number(list.listaIndex) > 0
        ? Math.round(Number(list.listaIndex))
        : 1;
    const base = sanitizeExportBaseName(campaignBaseName(list.name));
    return {
      filePath,
      fileName: list.exportFileName,
      downloadName: `${base}-${formatListaLabel(idx).replace(/\s+/g, "-")}.xlsx`,
    };
  }

  /** Marca Excel como baixado (botão azul → verde). */
  markDownloaded(id: string): WabaLeadsCnpjListSummary | null {
    const list = this.repository.getById(String(id || "").trim());
    if (!list || list.status !== "ready" || !list.exportFileName) return null;
    const updated = this.repository.update({
      ...list,
      downloadedAt: list.downloadedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const downloads = this.listSummaries().find((s) => s.id === updated.id)?.campaignDownloads || [];
    return toSummary(updated, downloads);
  }

  /** Campanha já marcou cópia do portal como definitiva. */
  private isCampaignPortalCopyComplete(campaignKey: string): boolean {
    const key = String(campaignKey || "").trim();
    if (!key) return false;
    const portalUiMaxPage = resolvePortalUiMaxPage();
    const pool = this.repository.getPool(key);
    const pending = pool?.pending.length || 0;
    const used = this.repository.collectUsedCnpjs(key).size;
    return this.repository.list().some((l) => {
      if (String(l.campaignKey || "").trim() !== key) return false;
      if (l.scrapeCompleted !== true) return false;
      return this.isPortalScrapeReallyComplete(l, pending, used, portalUiMaxPage);
    });
  }

  /**
   * scrapeCompleted prematuro (ex.: pagesToFetch encolhido pelo portalTotal ≈ 104)
   * NÃO conta como fim — exige atingir maxPages/teto UI ou fim real da paginação.
   */
  private isPortalScrapeReallyComplete(
    list: WabaLeadsCnpjList,
    poolPending: number,
    usedCount: number,
    portalUiMaxPage = resolvePortalUiMaxPage(),
  ): boolean {
    if (list.scrapeCompleted !== true) return false;
    const reason = String(list.scrapeDoneReason || "").trim().toUpperCase();
    if (
      reason === "THREE_EMPTY_PAGES" ||
      reason === "EMPTY_AT_END" ||
      reason === "SEARCH_EMPTY" ||
      reason === "UI_MAX_PAGE"
    ) {
      return true;
    }
    const maxWanted = Math.max(
      1,
      Math.round(Number(list.filters?.maxPages || 0) || 0) || portalUiMaxPage,
    );
    const target = Math.min(maxWanted, portalUiMaxPage);
    const metrics = resolveScrapeHistoryMetrics(list, poolPending, usedCount);
    return metrics.pagesDone >= target;
  }

  /**
   * Estima próxima página a retomar (checkpoint ou pool+used / 20).
   * Nunca acima do teto da UI Oruga.
   * Checkpoint inflado (páginas ≫ CNPJs/20) → piso pelo volume arquivado.
   */
  private estimatePortalResumePage(campaignKey: string, hint?: WabaLeadsCnpjList | null): number {
    const portalUiMaxPage = resolvePortalUiMaxPage();
    const key = String(campaignKey || "").trim();
    const pool = key ? this.repository.getPool(key) : null;
    const pending = pool?.pending.length || 0;
    const used = key ? this.repository.collectUsedCnpjs(key).size : 0;
    const fromCkpt = Math.max(
      0,
      Math.round(Number(hint?.scrapeCheckpoint?.nextPage || 0) || 0),
    );
    const fromVolume = Math.max(1, Math.floor((pending + used) / 20) + 1);
    const next =
      fromCkpt > 0 ? resolvePortalResumePage(fromCkpt, fromVolume) : fromVolume;
    return Math.min(portalUiMaxPage, Math.max(1, next));
  }

  /**
   * Se a cópia do portal ficou incompleta (ex.: Lista 01 ready com 118/1000),
   * retoma a raspagem. Listas ready com Excel são preservadas — cria fila `#portal-copy`.
   */
  ensureIncompletePortalCopiesResume(): void {
    const portalUiMaxPage = resolvePortalUiMaxPage();
    const seen = new Set<string>();
    for (const list of this.repository.list()) {
      if (list.source !== "portal") continue;
      const key = String(list.campaignKey || "").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      try {
        this.ensurePortalCopyContinues(key, portalUiMaxPage);
      } catch {
        /* boot não pode falhar por uma campanha */
      }
    }
  }

  private ensurePortalCopyContinues(campaignKey: string, portalUiMaxPage: number): void {
    const key = String(campaignKey || "").trim();
    if (!key || this.isCampaignPortalCopyComplete(key)) return;

    const lists = this.repository
      .list()
      .filter((l) => String(l.campaignKey || "").trim() === key && l.source === "portal");
    if (!lists.length) return;

    const activeScrape = lists.find(
      (l) => l.status === "scraping" && !l.skipPortalScrape,
    );
    if (activeScrape) {
      this.enqueueJob(activeScrape.id);
      return;
    }

    const pool = this.repository.getPool(key);
    const pending = pool?.pending.length || 0;
    const used = this.repository.collectUsedCnpjs(key).size;
    const sample =
      lists.find((l) => isPortalCopyContinuationList(l)) ||
      lists.find((l) => l.status === "ready") ||
      lists.find((l) => !l.skipPortalScrape) ||
      lists[0];
    const metrics = resolveScrapeHistoryMetrics(sample, pending, used);
    const resumePage = this.estimatePortalResumePage(key, sample);
    const clearlyIncomplete =
      metrics.pagesDone > 0 &&
      metrics.pagesDone < portalUiMaxPage &&
      resumePage <= portalUiMaxPage;
    const neverFinished = sample.scrapeCompleted !== true && resumePage <= portalUiMaxPage;
    if (!clearlyIncomplete && !(neverFinished && (pending > 0 || metrics.cnpjCopied > 0))) {
      return;
    }
    // Checkpoint já além do teto = cópia tratada como fim da UI.
    if (resumePage > portalUiMaxPage) return;

    const openPartial = lists.find(
      (l) =>
        !isPortalCopyContinuationList(l) &&
        (l.status === "enriching" || l.status === "queued" || l.status === "failed") &&
        !l.skipPortalScrape,
    );
    if (openPartial) {
      this.resumeIncompletePortalScrape(openPartial.id);
      return;
    }

    const readyWithExcel = lists.find(
      (l) =>
        !isPortalCopyContinuationList(l) &&
        l.status === "ready" &&
        Boolean(l.exportFileName) &&
        l.scrapeCompleted !== true,
    );
    if (readyWithExcel) {
      this.startPortalCopyContinuation(readyWithExcel, resumePage, pending);
      return;
    }

    const anyIncomplete = lists.find(
      (l) =>
        !l.skipPortalScrape &&
        l.scrapeCompleted !== true &&
        ["draft", "failed", "scraping"].includes(l.status),
    );
    if (anyIncomplete) {
      if (anyIncomplete.status === "failed" || anyIncomplete.status === "draft") {
        this.resumeIncompletePortalScrape(anyIncomplete.id);
      } else {
        this.enqueueJob(anyIncomplete.id);
      }
    }
  }

  /**
   * Nova linha de cópia do portal (não apaga Lista NN ready).
   * dayKey `hoje#portal-copy` evita colisão com a lista do dia no enrich.
   */
  private startPortalCopyContinuation(
    from: WabaLeadsCnpjList,
    resumePage: number,
    pendingCount: number,
  ): WabaLeadsCnpjListSummary {
    const campaignKey = String(from.campaignKey || "").trim();
    const baseName = campaignBaseName(from.name);
    const copyDay = portalCopyContinuationDayKey();
    const existing = this.repository.findListByCampaignDay(campaignKey, copyDay);
    if (existing) {
      if (existing.status === "scraping" || existing.status === "failed") {
        const updated = this.repository.update(
          {
            ...existing,
            status: "scraping",
            skipPortalScrape: false,
            scrapeCompleted: false,
            scrapeCheckpoint: {
              nextPage: resumePage,
              portalTotal: existing.scrapeCheckpoint?.portalTotal ?? from.scrapeCheckpoint?.portalTotal ?? null,
              pagesToFetch:
                existing.scrapeCheckpoint?.pagesToFetch ??
                from.scrapeCheckpoint?.pagesToFetch ??
                resolvePortalUiMaxPage(),
              collectedCount: pendingCount,
            },
            scrapeReconnectAttempts: 0,
            progressMessage: `Retomando cópia do portal na página ${resumePage} (Lista pronta preservada; pool ${pendingCount.toLocaleString("pt-BR")})…`,
            error: null,
            updatedAt: new Date().toISOString(),
          },
          { persist: "flush" },
        );
        cancelledJobs.delete(updated.id);
        this.enqueueJob(updated.id);
        return toSummary(updated, [], { poolPending: pendingCount });
      }
      if (existing.scrapeCompleted === true) {
        return toSummary(existing, [], { poolPending: pendingCount });
      }
    }

    assertCasaDosDadosCredentials();
    const now = new Date().toISOString();
    const portalUiMaxPage = resolvePortalUiMaxPage();
    const list: WabaLeadsCnpjList = {
      id: this.repository.newId(),
      name: `${baseName} · cópia portal`,
      status: "scraping",
      source: "portal",
      filters: {
        ...from.filters,
        maxPages: Number(from.filters?.maxPages) > 0 ? Number(from.filters.maxPages) : portalUiMaxPage,
      },
      leads: [],
      leadCount: 0,
      createdAt: now,
      updatedAt: now,
      generatedAt: null,
      exportFileName: null,
      error: null,
      createdByEmail: "pipeline@local",
      dayKey: copyDay,
      campaignKey,
      skipPortalScrape: false,
      scrapeCheckpoint: {
        nextPage: resumePage,
        portalTotal: from.scrapeCheckpoint?.portalTotal ?? null,
        pagesToFetch: from.scrapeCheckpoint?.pagesToFetch ?? portalUiMaxPage,
        collectedCount: pendingCount,
      },
      scrapeReconnectAttempts: 0,
      scrapeCompleted: false,
      progressMessage: `Retomando cópia do portal na página ${resumePage}/${portalUiMaxPage} (Lista pronta preservada; pool ${pendingCount.toLocaleString("pt-BR")})…`,
    };
    this.repository.create(list);
    this.repository.setPoolAutoContinuePaused(campaignKey, false);
    cancelledJobs.delete(list.id);
    this.enqueueJob(list.id);
    this.armGlobalEnrichQueue();
    return toSummary(list, [], { poolPending: pendingCount });
  }

  /**
   * Interrompe enrich/queued parcial e volta a copiar o portal.
   * Devolve os CNPJs do lote ao pool e retoma a partir da página estimada (pool/20 + 1).
   * Uso: raspagem encerrou cedo (ex. 140 de ~8070) e já tinha ido para ReceitaWS.
   */
  resumeIncompletePortalScrape(id: string): WabaLeadsCnpjListSummary {
    const listId = String(id || "").trim();
    const list = this.repository.getById(listId);
    if (!list) throw new Error("Lista não encontrada.");
    if (list.source !== "portal" || list.skipPortalScrape) {
      throw new Error("Só listas do portal podem retomar a cópia.");
    }
    if (!["enriching", "queued", "failed", "ready", "scraping"].includes(list.status)) {
      throw new Error(`Status ${list.status} não permite retomar a raspagem.`);
    }
    // Ready com Excel: não apaga Lista NN — sobe linha `#portal-copy`.
    if (list.status === "ready" && list.exportFileName && !isPortalCopyContinuationList(list)) {
      const campaignKey = String(
        list.campaignKey || buildCampaignKey(campaignBaseName(list.name), list.source),
      ).trim();
      const pending = this.repository.getPool(campaignKey)?.pending.length || 0;
      const resumePage = this.estimatePortalResumePage(campaignKey, list);
      return this.startPortalCopyContinuation(list, resumePage, pending);
    }
    const campaignKey = String(
      list.campaignKey || buildCampaignKey(campaignBaseName(list.name), list.source),
    ).trim();
    const baseName = campaignBaseName(list.name);
    cancelledJobs.add(listId);

    const leads = Array.isArray(list.leads) ? list.leads : [];
    const used = this.repository.collectUsedCnpjs(campaignKey);
    // CNPJs do lote atual voltam ao pool (ainda não são “usados” de listas prontas anteriores).
    for (const lead of leads) used.delete(normalizeCnpjDigits(lead.cnpj));
    if (leads.length) {
      this.repository.mergePool({
        key: campaignKey,
        name: baseName,
        source: "portal",
        filters: list.filters,
        items: leads.map((l) => ({ cnpj: l.cnpj, nome: l.nome })),
        usedCnpjs: used,
        persist: "flush",
      });
    }

    const pending = this.repository.getPool(campaignKey)?.pending.length || 0;
    const portalUiMaxPage = resolvePortalUiMaxPage();
    const nextPage = Math.min(
      portalUiMaxPage,
      Math.max(1, Math.floor(pending / 20) + 1),
    );

    cancelledJobs.delete(listId);
    const updated = this.repository.update(
      {
        ...list,
        status: "scraping",
        leads: [],
        leadCount: 0,
        generatedAt: null,
        exportFileName: null,
        listaIndex: null,
        downloadedAt: null,
        error: null,
        scrapeCompleted: false,
        scrapeDoneReason: null,
        scrapeCheckpoint: {
          nextPage,
          portalTotal: list.scrapeCheckpoint?.portalTotal ?? null,
          pagesToFetch:
            Math.max(
              1,
              Math.round(Number(list.filters?.maxPages || 0) || 0) || portalUiMaxPage,
            ),
          collectedCount: pending,
        },
        scrapeReconnectAttempts: 0,
        progressMessage: `Retomando cópia do portal na página ${nextPage} (pool ${pending.toLocaleString("pt-BR")})…`,
        updatedAt: new Date().toISOString(),
      },
      { persist: "flush" },
    );

    this.enqueueJob(updated.id);
    const downloads =
      this.listSummaries().find((s) => s.id === updated.id)?.campaignDownloads || [];
    return toSummary(updated, downloads, { poolPending: pending });
  }

  /**
   * Finaliza o lote de enriquecimento agora (mesmo incompleto): gera Lista NN,
   * devolve CNPJs não enriquecidos ao pool e inicia a próxima campanha hoje.
   */
  finalizeEnrichDayNow(
    id: string,
    options?: { startNextNow?: boolean },
  ): WabaLeadsCnpjListSummary {
    const listId = String(id || "").trim();
    const list = this.repository.getById(listId);
    if (!list) throw new Error("Lista não encontrada.");
    if (list.status !== "enriching" && list.status !== "queued") {
      throw new Error("Só é possível finalizar listas em enriquecimento ou na fila.");
    }
    const campaignKey = String(
      list.campaignKey || buildCampaignKey(campaignBaseName(list.name), list.source),
    ).trim();
    const baseName = campaignBaseName(list.name);
    const dayKey = list.dayKey || saoPauloDayKey();
    cancelledJobs.add(listId);

    const leads = Array.isArray(list.leads) ? list.leads : [];
    const enrichedLeads = leads.filter((l) => leadLooksEnriched(l));
    if (!enrichedLeads.length) {
      cancelledJobs.delete(listId);
      throw new Error("Nenhum CNPJ enriquecido ainda para gerar a lista do dia.");
    }
    const enrichedSet = new Set(enrichedLeads.map((l) => normalizeCnpjDigits(l.cnpj)));
    const leftover = leads.filter((l) => !enrichedSet.has(normalizeCnpjDigits(l.cnpj)));
    if (leftover.length) {
      const used = this.repository.collectUsedCnpjs(campaignKey);
      for (const lead of enrichedLeads) used.add(normalizeCnpjDigits(lead.cnpj));
      this.repository.mergePool({
        key: campaignKey,
        name: baseName,
        source: list.source,
        filters: list.filters,
        items: leftover.map((l) => ({ cnpj: l.cnpj, nome: l.nome })),
        usedCnpjs: used,
        persist: "flush",
      });
    }

    const forExport = expandLeadsByMobileForEvo(enrichedLeads);
    const excel = buildLeadsCnpjExcelBuffer(forExport);
    const listaIndex = this.repository.nextListaIndex(campaignKey);
    const exportFileName = this.repository.saveExportFile(
      listId,
      excel,
      sanitizeExportBaseName(`${baseName}-${formatListaLabel(listaIndex)}`),
      dayKey,
    );
    const remaining = this.repository.getPool(campaignKey)?.pending.length || 0;
    const today = saoPauloDayKey();
    const startNext = options?.startNextNow !== false;
    const updated = this.repository.update(
      {
        ...list,
        leads: forExport,
        leadCount: forExport.length,
        status: "ready",
        generatedAt: new Date().toISOString(),
        exportFileName,
        listaIndex,
        downloadedAt: null,
        error: null,
        progressMessage: `${formatListaLabel(listaIndex)} finalizada (${forExport.length} linha(s) com celular; ${leftover.length} devolvidos ao pool).${
          startNext ? " Próxima campanha da fila iniciando." : " Continuação desta campanha / fila conforme slot do dia."
        }${remaining ? ` Pool: ${remaining.toLocaleString("pt-BR")} pendente(s).` : ""}`,
        updatedAt: new Date().toISOString(),
      },
      { persist: "flush" },
    );

    const order = this.rebuildEnrichOrder();
    const next = this.nextCampaignAfter(order, campaignKey);
    this.repository.saveEnrichQueue({
      version: 1,
      dayKey: today,
      activeCampaignKey: startNext ? next : null,
      lastCompletedCampaignKey: startNext ? campaignKey : this.repository.getEnrichQueue().lastCompletedCampaignKey,
      order,
    });
    // Se não avança a fila, mantém/restaura a campanha atual como ativa no dia.
    if (!startNext) {
      this.repository.saveEnrichQueue({
        ...this.repository.getEnrichQueue(),
        dayKey: today,
        activeCampaignKey: campaignKey,
        order,
      });
    }
    this.pauseNonActiveEnrichLists(startNext ? next : campaignKey);
    if (startNext && next) {
      this.startActiveCampaignEnrichDay(next);
    } else {
      this.armGlobalEnrichQueue();
    }
    cancelledJobs.delete(listId);
    const downloads =
      this.listSummaries().find((s) => s.id === updated.id)?.campaignDownloads || [];
    return toSummary(updated, downloads);
  }

  /**
   * Exclui a extração como se nunca tivesse existido:
   * cancela jobs/Chromium, apaga listas + Excels + pool + fila de enrich,
   * e impede o job moribundo de recriar o pool (purgedCampaignKeys).
   */
  deleteList(id: string): boolean {
    const listId = String(id || "").trim();
    if (!listId) return false;
    const list = this.repository.getById(listId);
    if (!list) return false;

    const campaignKey = String(
      list.campaignKey || buildCampaignKey(campaignBaseName(list.name), list.source),
    ).trim();

    // Cancela a linha clicada e qualquer outra lista ativa da mesma campanha.
    const sameCampaign = campaignKey
      ? this.repository.list().filter((item) => String(item.campaignKey || "").trim() === campaignKey)
      : [list];
    for (const item of sameCampaign) {
      cancelledJobs.add(item.id);
      forceReleasePortalScrapeSlot(item.id);
      phoneRefreshJobs.delete(item.id);
    }
    this.clearContinueTimer(campaignKey);
    if (campaignKey) markCampaignPurged(campaignKey);

    const removed = campaignKey
      ? this.repository.deleteByCampaignKey(campaignKey)
      : (() => {
          const one = this.repository.delete(listId);
          return one ? [one] : [];
        })();

    if (campaignKey) {
      this.repository.deletePool(campaignKey);
      this.removeCampaignFromEnrichOrder(campaignKey);
      // Segunda passada: job async pode ter reescrito o pool entre delete e cancel.
      this.repository.deletePool(campaignKey);
    }

    this.armGlobalEnrichQueue();
    return removed.length > 0;
  }

  private removeCampaignFromEnrichOrder(campaignKey: string) {
    const key = String(campaignKey || "").trim();
    if (!key) return;
    const q = this.repository.getEnrichQueue();
    const order = (q.order || []).filter((k) => k !== key);
    this.repository.saveEnrichQueue({
      ...q,
      order,
      activeCampaignKey: q.activeCampaignKey === key ? null : q.activeCampaignKey,
      lastCompletedCampaignKey:
        q.lastCompletedCampaignKey === key ? null : q.lastCompletedCampaignKey,
    });
  }

  /** Campanhas com trabalho de enriquecimento pendente (lote ou pool). */
  private campaignsWithEnrichWork(): string[] {
    const keys = new Set<string>();
    for (const list of this.repository.list()) {
      const key = String(list.campaignKey || "").trim();
      if (!key) continue;
      if (
        list.status === "enriching" ||
        list.status === "queued" ||
        (list.status === "scraping" && !list.skipPortalScrape)
      ) {
        keys.add(key);
      }
      if (
        (list.status === "enriching" || list.status === "queued") &&
        Array.isArray(list.leads) &&
        list.leads.length > 0
      ) {
        keys.add(key);
      }
    }
    for (const pool of this.repository.listPools()) {
      if (pool.autoContinuePaused) continue;
      if ((pool.pending || []).length > 0) keys.add(pool.key);
    }
    return [...keys];
  }

  private rebuildEnrichOrder(): string[] {
    const work = new Set(this.campaignsWithEnrichWork());
    const q = this.repository.getEnrichQueue();
    const prev = (q.order || []).filter((k) => work.has(k));
    const known = new Set(prev);
    const extras = [...work]
      .filter((k) => !known.has(k))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
    let order = [...prev, ...extras];
    if (work.has(ENRICH_QUEUE_PREFERRED_FIRST)) {
      order = [
        ENRICH_QUEUE_PREFERRED_FIRST,
        ...order.filter((k) => k !== ENRICH_QUEUE_PREFERRED_FIRST),
      ];
    }
    return order;
  }

  private nextCampaignAfter(order: string[], lastKey: string | null): string | null {
    if (!order.length) return null;
    if (!lastKey) return order[0];
    const idx = order.indexOf(lastKey);
    if (idx < 0) return order[0];
    for (let i = 1; i <= order.length; i += 1) {
      const candidate = order[(idx + i) % order.length];
      if (this.campaignsWithEnrichWork().includes(candidate)) return candidate;
    }
    return null;
  }

  /**
   * Garante o slot do dia (1 campanha/dia SP). Corretora de seguros tem prioridade na 1ª fila.
   */
  private ensureEnrichSlotForToday(): string | null {
    const today = saoPauloDayKey();
    const order = this.rebuildEnrichOrder();
    const q = this.repository.getEnrichQueue();
    if (q.dayKey === today) {
      // Slot do dia já existe (active=null = Excel do dia gerado; não inicia outra campanha hoje).
      this.repository.saveEnrichQueue({ ...q, dayKey: today, order });
      return q.activeCampaignKey;
    }
    // Novo dia civil: próxima campanha após a última concluída.
    const active = this.nextCampaignAfter(order, q.lastCompletedCampaignKey);
    this.repository.saveEnrichQueue({
      version: 1,
      dayKey: today,
      activeCampaignKey: active,
      lastCompletedCampaignKey: q.lastCompletedCampaignKey,
      order,
    });
    return active;
  }

  private queuePositionLabel(campaignKey: string): string {
    const q = this.repository.getEnrichQueue();
    const order = q.order.length ? q.order : this.rebuildEnrichOrder();
    const active = q.activeCampaignKey;
    const idx = order.indexOf(campaignKey);
    if (idx < 0) return "Na fila de enriquecimento (1 campanha por dia)…";
    if (campaignKey === active) return "Enriquecimento do dia (fila ativa)…";
    const activeIdx = active ? order.indexOf(active) : -1;
    let pos = 0;
    for (let i = 1; i <= order.length; i += 1) {
      const k = order[(Math.max(0, activeIdx) + i) % order.length];
      if (!this.campaignsWithEnrichWork().includes(k)) continue;
      pos += 1;
      if (k === campaignKey) {
        return `Na fila de enriquecimento — posição ${pos} (1 campanha/dia; após a virada SP)…`;
      }
    }
    return "Na fila de enriquecimento (1 campanha por dia)…";
  }

  private pauseNonActiveEnrichLists(activeCampaignKey: string | null) {
    for (const list of this.repository.list()) {
      if (list.status !== "enriching" && list.status !== "queued") continue;
      const key = String(list.campaignKey || "").trim();
      if (!key) continue;
      if (activeCampaignKey && key === activeCampaignKey) {
        if (list.status === "queued" && Array.isArray(list.leads) && list.leads.length) {
          this.repository.update({
            ...list,
            status: "enriching",
            progressMessage: formatReceitaWsLegend(
              list.leads.filter((l) => l.enriched).length,
              list.leads.length,
              "retomando fila…",
            ),
            updatedAt: new Date().toISOString(),
          });
        }
        continue;
      }
      if (list.status === "enriching" || list.status === "queued") {
        this.repository.update({
          ...list,
          status: "queued",
          progressMessage: this.queuePositionLabel(key),
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  private armGlobalEnrichQueue() {
    if (globalEnrichTimer) return;
    const tick = () => {
      globalEnrichTimer = null;
      try {
        this.syncEnrichQueueDay();
      } catch {
        /* tenta de novo */
      }
      const still =
        this.campaignsWithEnrichWork().length > 0 ||
        this.repository.list().some((l) => l.status === "queued" || l.status === "enriching");
      if (still) {
        globalEnrichTimer = setTimeout(tick, CONTINUE_POLL_MS);
      }
    };
    globalEnrichTimer = setTimeout(tick, 5_000);
  }

  /**
   * Virada do dia SP:
   * 1) Fecha a campanha ativa com Excel parcial (Lista NN) do que já enriquecido.
   * 2) Devolve não enriquecidos ao pool.
   * 3) Inicia a próxima campanha da fila no novo dia.
   *
   * Nunca renomeia lista em andamento para “hoje” sem gerar o arquivo do dia anterior.
   */
  private syncEnrichQueueDay() {
    const today = saoPauloDayKey();
    const q = this.repository.getEnrichQueue();

    if (q.dayKey !== today) {
      const prevActive = String(q.activeCampaignKey || "").trim();
      if (prevActive) {
        const prevList = this.repository.list().find(
          (l) =>
            String(l.campaignKey || "") === prevActive &&
            (l.status === "enriching" || l.status === "queued") &&
            Array.isArray(l.leads) &&
            l.leads.length > 0,
        );
        if (prevList && prevList.leads.some((l) => leadLooksEnriched(l))) {
          try {
            // Fecha o dia anterior (parcial OK) e sobe a próxima da fila hoje.
            this.finalizeEnrichDayNow(prevList.id, { startNextNow: true });
            return;
          } catch {
            /* sem enriquecidos suficientes — segue abrindo o slot */
          }
        }
      }
      const active = this.ensureEnrichSlotForToday();
      this.pauseNonActiveEnrichLists(active);
      if (active) this.startActiveCampaignEnrichDay(active);
      return;
    }

    if (!q.activeCampaignKey) {
      // Slot do dia já fechado (Excel gerado) — próxima campanha só após nova virada.
      this.pauseNonActiveEnrichLists(null);
      return;
    }

    this.pauseNonActiveEnrichLists(q.activeCampaignKey);
    this.startActiveCampaignEnrichDay(q.activeCampaignKey);
  }

  /** Inicia o enriquecimento do dia para a campanha ativa — lote do dayKey de hoje. */
  private startActiveCampaignEnrichDay(activeCampaignKey: string) {
    const active = String(activeCampaignKey || "").trim();
    if (!active) return;
    const today = saoPauloDayKey();
    const existingToday = this.repository.findListByCampaignDay(active, today);
    if (existingToday) {
      if (
        (existingToday.status === "enriching" || existingToday.status === "queued") &&
        Array.isArray(existingToday.leads) &&
        existingToday.leads.length > 0
      ) {
        this.repository.update({
          ...existingToday,
          status: "enriching",
          updatedAt: new Date().toISOString(),
        });
        this.enqueueJob(existingToday.id);
        return;
      }
      if (existingToday.status === "scraping" || existingToday.status === "draft") {
        this.enqueueJob(existingToday.id);
        return;
      }
      if (existingToday.status === "ready") {
        // Lista do dia já gerada — se a cópia do portal ficou pela metade, retoma sem apagar o Excel.
        this.ensurePortalCopyContinues(active, resolvePortalUiMaxPage());
        return;
      }
      if (existingToday.status === "failed") {
        /* cai no createAndStart abaixo (createAndStart permite recriar failed) */
      } else {
        return;
      }
    }

    // Listas abertas de dias anteriores: fecha parcial ou devolve ao pool (nunca “renomeia” para hoje).
    const staleOpen = this.repository
      .list()
      .filter(
        (l) =>
          String(l.campaignKey || "") === active &&
          (l.status === "enriching" || l.status === "queued") &&
          String(l.dayKey || "") !== today,
      );
    for (const stale of staleOpen) {
      if ((stale.leads || []).some((row) => leadLooksEnriched(row))) {
        try {
          this.finalizeEnrichDayNow(stale.id, { startNextNow: false });
        } catch {
          this.returnListLeadsToPoolAndClose(stale, "Lote antigo sem Excel — CNPJs devolvidos ao pool.");
        }
      } else {
        this.returnListLeadsToPoolAndClose(stale, "Lote antigo sem enriquecidos — CNPJs devolvidos ao pool.");
      }
    }

    // Reabre o slot do dia para esta campanha (finalize pode ter alterado a fila).
    this.repository.saveEnrichQueue({
      ...this.repository.getEnrichQueue(),
      dayKey: today,
      activeCampaignKey: active,
      order: this.rebuildEnrichOrder(),
    });

    const pool = this.repository.getPool(active);
    if (pool && (pool.pending || []).length > 0 && !pool.autoContinuePaused) {
      this.createAndStart({
        name: pool.name,
        source: pool.source,
        filters: pool.filters,
        createdByEmail: "pipeline@local",
        skipPortalScrape: true,
      });
    }
  }

  /** Devolve CNPJs de uma lista aberta ao pool e marca a lista como failed (sem Excel). */
  private returnListLeadsToPoolAndClose(
    list: WabaLeadsCnpjList,
    progressMessage: string,
  ): void {
    const campaignKey = String(list.campaignKey || "").trim();
    const baseName = campaignBaseName(list.name);
    const leads = Array.isArray(list.leads) ? list.leads : [];
    if (campaignKey && leads.length) {
      const used = this.repository.collectUsedCnpjs(campaignKey);
      this.repository.mergePool({
        key: campaignKey,
        name: baseName,
        source: list.source,
        filters: list.filters,
        items: leads.map((l) => ({ cnpj: l.cnpj, nome: l.nome })),
        usedCnpjs: used,
        persist: "flush",
      });
    }
    cancelledJobs.add(list.id);
    this.repository.update(
      {
        ...list,
        status: "failed",
        leads: [],
        leadCount: 0,
        error: null,
        progressMessage,
        updatedAt: new Date().toISOString(),
      },
      { persist: "flush" },
    );
    cancelledJobs.delete(list.id);
  }

  /** Fecha listas enriching/queued com dayKey anterior a hoje (recupera virada perdida). */
  private closeOverdueEnrichDays(): void {
    const today = saoPauloDayKey();
    const overdue = this.repository
      .list()
      .filter(
        (l) =>
          (l.status === "enriching" || l.status === "queued") &&
          String(l.dayKey || "") &&
          String(l.dayKey) < today &&
          Array.isArray(l.leads) &&
          l.leads.some((row) => leadLooksEnriched(row)),
      )
      .sort((a, b) => String(a.dayKey).localeCompare(String(b.dayKey)));
    for (const list of overdue) {
      try {
        this.finalizeEnrichDayNow(list.id, { startNextNow: false });
      } catch {
        /* ignora se não houver enriquecidos */
      }
    }
  }

  private hasActiveEnrichWork(): boolean {
    const q = this.repository.getEnrichQueue();
    if (q.activeCampaignKey) {
      return this.repository.list().some(
        (l) =>
          String(l.campaignKey || "") === q.activeCampaignKey &&
          (l.status === "enriching" || l.status === "queued"),
      );
    }
    return this.repository.list().some((l) => l.status === "enriching");
  }

  private canEnrichCampaignToday(campaignKey: string): boolean {
    const key = String(campaignKey || "").trim();
    if (!key) return false;
    const active = this.ensureEnrichSlotForToday();
    return Boolean(active && active === key);
  }

  /**
   * No boot: fecha lotes atrasados (Excel parcial), fila 1 campanha/dia, retoma scraping.
   * Backfill de telefone só quando não há enriquecimento ativo (não compete na ReceitaWS).
   */
  resumeDailyPipelinesAfterBoot(): void {
    this.closeOverdueEnrichDays();
    const today = saoPauloDayKey();
    let q = this.repository.getEnrichQueue();
    // Se fechamos lotes atrasados e o slot de hoje ficou vazio, abre a próxima da fila.
    if (q.dayKey === today && !q.activeCampaignKey) {
      const next = this.nextCampaignAfter(this.rebuildEnrichOrder(), q.lastCompletedCampaignKey);
      if (next) {
        this.repository.saveEnrichQueue({
          ...q,
          dayKey: today,
          activeCampaignKey: next,
          order: this.rebuildEnrichOrder(),
        });
      }
    }
    const active = this.ensureEnrichSlotForToday();
    this.pauseNonActiveEnrichLists(active);
    // Antes do enrich: retoma cópia incompleta (ex. 118/1000 com Lista 01 já ready).
    this.ensureIncompletePortalCopiesResume();
    for (const list of this.repository.list()) {
      if (list.status === "scraping") {
        this.enqueueJob(list.id);
        continue;
      }
    }
    if (active) this.startActiveCampaignEnrichDay(active);
    if (!this.hasActiveEnrichWork()) {
      for (const list of this.repository.list()) {
        if (list.status === "ready" && list.exportFileName && Array.isArray(list.leads) && list.leads.length) {
          if (isPortalCopyContinuationList(list)) continue;
          const evoPhones = list.leads.filter((l) => isEvoBrazilMobileDigits(l.telefone)).length;
          const anyPhone = list.leads.filter((l) => String(l.telefone || "").trim()).length;
          if (evoPhones === 0 && anyPhone > 0) {
            void this.rebuildExportWithEvoPhones(list.id);
          } else if (evoPhones === 0) {
            void this.refreshPhonesAndRebuildExcel(list.id);
          }
        }
      }
    }
    this.armGlobalEnrichQueue();
  }

  /** Regenera Excel (e leads) no formato EVO a partir dos telefones já gravados — sem ReceitaWS. */
  rebuildExportWithEvoPhones(id: string): WabaLeadsCnpjListSummary | null {
    const listId = String(id || "").trim();
    const list = this.repository.getById(listId);
    if (!list || list.status !== "ready" || !Array.isArray(list.leads) || !list.leads.length) {
      return null;
    }
    const baseName = campaignBaseName(list.name);
    const dayKey = list.dayKey || saoPauloDayKey();
    const campaignKey = String(list.campaignKey || "").trim();
    const forExport = expandLeadsByMobileForEvo(list.leads);
    const withEvo = forExport.filter((l) => isEvoBrazilMobileDigits(l.telefone)).length;
    const listaIndex =
      list.listaIndex != null && Number(list.listaIndex) > 0
        ? Math.round(Number(list.listaIndex))
        : this.repository.nextListaIndex(campaignKey);
    const exportFileName = this.repository.saveExportFile(
      listId,
      buildLeadsCnpjExcelBuffer(forExport),
      sanitizeExportBaseName(`${baseName}-${formatListaLabel(listaIndex)}`),
      dayKey,
    );
    const updated = this.repository.update(
      {
        ...list,
        leads: forExport,
        leadCount: forExport.length,
        exportFileName,
        listaIndex,
        progressMessage: `${formatListaLabel(listaIndex)} pronta para EVO: ${withEvo.toLocaleString("pt-BR")} celular(es) 55… (1 por linha).`,
        updatedAt: new Date().toISOString(),
      },
      { persist: "flush" },
    );
    const downloads =
      this.listSummaries().find((s) => s.id === updated.id)?.campaignDownloads || [];
    return toSummary(updated, downloads, {
      poolPending: campaignKey ? this.repository.getPool(campaignKey)?.pending.length || 0 : 0,
      campaignFinished: false,
    });
  }

  /**
   * Reconsulta ReceitaWS só para preencher telefone e regenera o Excel (Lista NN).
   * Não usa o lock de enriquecimento — pode rodar em paralelo à fila ativa.
   * Preserva telefones já obtidos (checkpoint) e só consulta CNPJs sem telefone.
   */
  async refreshPhonesAndRebuildExcel(id: string): Promise<WabaLeadsCnpjListSummary | null> {
    const listId = String(id || "").trim();
    if (!listId || phoneRefreshJobs.has(listId)) return null;
    const list = this.repository.getById(listId);
    if (!list || list.status !== "ready" || !Array.isArray(list.leads) || !list.leads.length) {
      return null;
    }
    phoneRefreshJobs.add(listId);
    const apiKey = String(process.env.RECEITAWS_API_KEY || "").trim();
    // Ritmo/fila ReceitaWS ficam em enrichViaReceitaWs (evita 429). Não sleep extra aqui.
    const baseName = campaignBaseName(list.name);
    const dayKey = list.dayKey || saoPauloDayKey();
    const campaignKey = String(list.campaignKey || "").trim();
    const CHECKPOINT_EVERY = 5;
    try {
      const out = list.leads.map((l) => ({ ...l }));
      let withTel = out.filter((l) => String(l.telefone || "").trim()).length;
      let fetched = 0;
      for (let i = 0; i < out.length; i += 1) {
        const current = out[i];
        if (!this.repository.getById(listId)) return null;
        const existing = String(current.telefone || "").trim();
        if (existing) {
          this.repository.update(
            {
              ...this.repository.getById(listId)!,
              progressMessage: `Atualizando telefones ReceitaWS ${i + 1}/${out.length} (já tinha ${withTel.toLocaleString("pt-BR")})…`,
              updatedAt: new Date().toISOString(),
            },
            { persist: "debounce" },
          );
          continue;
        }
        this.repository.update(
          {
            ...this.repository.getById(listId)!,
            progressMessage: `Atualizando telefones ReceitaWS ${i + 1}/${out.length}…`,
            updatedAt: new Date().toISOString(),
          },
          { persist: "debounce" },
        );
        try {
          const next = await enrichViaReceitaWs(current.cnpj, apiKey);
          const telefone = String(next.telefone || "").trim();
          out[i] = {
            ...current,
            telefone,
            email: current.email || next.email || "",
            situacao: current.situacao || next.situacao || "",
            dataAbertura: current.dataAbertura || next.dataAbertura || "",
            cidade: current.cidade || next.cidade || "",
            estado: current.estado || next.estado || "",
            endereco: current.endereco || next.endereco || "",
            nome: current.nome || next.nome || "",
          };
          if (telefone) withTel += 1;
          fetched += 1;
        } catch {
          /* mantém linha */
        }
        if (fetched > 0 && fetched % CHECKPOINT_EVERY === 0) {
          const partialExport = expandLeadsByMobileForEvo(out);
          const withEvoPartial = partialExport.filter((l) => isEvoBrazilMobileDigits(l.telefone)).length;
          const listaIndexPartial =
            list.listaIndex != null && Number(list.listaIndex) > 0
              ? Math.round(Number(list.listaIndex))
              : this.repository.nextListaIndex(campaignKey);
          const exportPartial = this.repository.saveExportFile(
            listId,
            buildLeadsCnpjExcelBuffer(partialExport),
            sanitizeExportBaseName(`${baseName}-${formatListaLabel(listaIndexPartial)}`),
            dayKey,
          );
          this.repository.update(
            {
              ...this.repository.getById(listId)!,
              leads: out.map((l) => ({ ...l })),
              leadCount: out.length,
              exportFileName: exportPartial,
              listaIndex: listaIndexPartial,
              progressMessage: `Atualizando telefones ReceitaWS ${i + 1}/${out.length} (checkpoint ${withTel.toLocaleString("pt-BR")} tel / ${withEvoPartial.toLocaleString("pt-BR")} EVO no Excel)…`,
              updatedAt: new Date().toISOString(),
            },
            { persist: "flush" },
          );
        }
      }
      const forExport = expandLeadsByMobileForEvo(out);
      const withEvo = forExport.filter((l) => isEvoBrazilMobileDigits(l.telefone)).length;
      const excel = buildLeadsCnpjExcelBuffer(forExport);
      const listaIndex =
        list.listaIndex != null && Number(list.listaIndex) > 0
          ? Math.round(Number(list.listaIndex))
          : this.repository.nextListaIndex(campaignKey);
      const exportFileName = this.repository.saveExportFile(
        listId,
        excel,
        sanitizeExportBaseName(`${baseName}-${formatListaLabel(listaIndex)}`),
        dayKey,
      );
      const updated = this.repository.update(
        {
          ...list,
          leads: forExport,
          leadCount: forExport.length,
          exportFileName,
          listaIndex,
          progressMessage: `${formatListaLabel(listaIndex)} pronta para EVO: ${withEvo.toLocaleString("pt-BR")} celular(es) 55… (${withTel.toLocaleString("pt-BR")} com tel na ReceitaWS).`,
          updatedAt: new Date().toISOString(),
        },
        { persist: "flush" },
      );
      const downloads =
        this.listSummaries().find((s) => s.id === updated.id)?.campaignDownloads || [];
      return toSummary(updated, downloads, {
        poolPending: campaignKey
          ? this.repository.getPool(campaignKey)?.pending.length || 0
          : 0,
        campaignFinished: false,
      });
    } finally {
      phoneRefreshJobs.delete(listId);
    }
  }

  createAndStart(input: {
    name: string;
    source?: WabaLeadsCnpjSource;
    filters?: unknown;
    manualCnpjs?: unknown;
    createdByEmail: string;
    /** Pipeline dia seguinte: não raspar portal de novo. */
    skipPortalScrape?: boolean;
  }): WabaLeadsCnpjListSummary {
    const baseName = campaignBaseName(String(input.name || ""));
    if (!baseName) throw new Error("Informe o nome da lista.");
    if (baseName.length > 100) throw new Error("Nome da lista deve ter no máximo 100 caracteres.");

    const source: WabaLeadsCnpjSource = input.source === "manual" ? "manual" : "portal";
    if (source === "portal" && !input.skipPortalScrape) {
      assertCasaDosDadosCredentials();
    }
    const filters = parseLeadsCnpjFilters(input.filters);
    const manualLeads = source === "manual" ? parseManualLeads(input.manualCnpjs) : [];
    if (source === "manual" && !manualLeads.length) {
      throw new Error("Cole ao menos um CNPJ válido (14 dígitos) para a lista manual.");
    }

    const dayKey = saoPauloDayKey();
    const campaignKey = buildCampaignKey(baseName, source);
    clearCampaignPurged(campaignKey);
    const existingToday = this.repository.findListByCampaignDay(campaignKey, dayKey);
    if (existingToday && existingToday.status !== "failed") {
      throw new Error(
        `Já existe lista de hoje (${dayKey}) para “${baseName}” (status: ${existingToday.status}). Amanhã: nova linha + novo arquivo, sem CNPJs repetidos.`,
      );
    }

    const dailyName = `${baseName} · ${dayKey}`;
    const now = new Date().toISOString();
    const listId = existingToday?.status === "failed" ? existingToday.id : this.repository.newId();
    const list: WabaLeadsCnpjList = {
      id: listId,
      name: dailyName,
      status: source === "manual" ? "enriching" : "scraping",
      source,
      filters,
      leads: [],
      leadCount: 0,
      createdAt: existingToday?.createdAt || now,
      updatedAt: now,
      generatedAt: null,
      exportFileName: null,
      error: null,
      createdByEmail: String(input.createdByEmail || "").trim().toLowerCase() || "pipeline@local",
      dayKey,
      campaignKey,
      skipPortalScrape: Boolean(input.skipPortalScrape),
      // Reprocessar failed: mantém cursor e pool já arquivado.
      scrapeCheckpoint:
        existingToday?.status === "failed" ? existingToday.scrapeCheckpoint ?? null : null,
      scrapeReconnectAttempts: 0,
      progressMessage: input.skipPortalScrape
        ? `Pipeline diário: montando lote ${dayKey} a partir do pool…`
        : source === "manual"
          ? "Montando lote do dia (sem duplicados)…"
          : existingToday?.status === "failed" && existingToday.scrapeCheckpoint?.nextPage
            ? `Retomando coleta na página ${existingToday.scrapeCheckpoint.nextPage}…`
            : "Iniciando coleta do lote diário…",
    };

    // Guarda manuais no pool (sem CNPJs já exportados nesta campanha).
    if (source === "manual") {
      const used = this.repository.collectUsedCnpjs(campaignKey);
      // Se estamos reprocessando failed, remove leads antigos do "used" desta lista:
      for (const lead of existingToday?.leads || []) {
        used.delete(normalizeCnpjDigits(lead.cnpj));
      }
      this.repository.mergePool({
        key: campaignKey,
        name: baseName,
        source,
        filters,
        items: manualLeads.map((l) => ({ cnpj: l.cnpj, nome: l.nome })),
        usedCnpjs: used,
      });
    }

    if (existingToday?.status === "failed") {
      this.repository.update(list);
    } else {
      this.repository.create(list);
    }
    // Nova extração manual (ou pipeline) reativa a continuação automática do pool.
    this.repository.setPoolAutoContinuePaused(campaignKey, false);
    cancelledJobs.delete(list.id);
    const q = this.repository.getEnrichQueue();
    this.repository.saveEnrichQueue({
      ...q,
      order: this.rebuildEnrichOrder(),
    });
    this.enqueueJob(list.id);
    this.armGlobalEnrichQueue();
    return toSummary(list);
  }

  private clearContinueTimer(campaignKey: string) {
    const key = String(campaignKey || "").trim();
    if (!key) return;
    const handle = continueTimers.get(key);
    if (handle) {
      clearTimeout(handle);
      continueTimers.delete(key);
    }
  }

  /** Agenda checagens até o próximo dia civil (SP) para tirar o próximo lote do pool. */
  private armContinueFromPool(campaignKey: string) {
    const key = String(campaignKey || "").trim();
    if (!key) return;
    if (this.repository.getPool(key)?.autoContinuePaused) return;
    if (continueTimers.has(key)) return;
    const tick = () => {
      continueTimers.delete(key);
      try {
        this.tryStartNextDayFromPool(key);
      } catch {
        /* tenta de novo no próximo ciclo */
      }
      const pool = this.repository.getPool(key);
      if (pool?.autoContinuePaused) return;
      const pending = pool?.pending.length || 0;
      if (pending > 0) {
        const handle = setTimeout(tick, CONTINUE_POLL_MS);
        continueTimers.set(key, handle);
      }
    };
    const handle = setTimeout(tick, 5_000);
    continueTimers.set(key, handle);
  }

  /**
   * Se já viramos o dia (SP) e não há lista de hoje, cria o lote a partir do pool.
   * Não inicia segundo lote no mesmo dayKey se o Excel do dia já está ready.
   */
  private tryStartNextDayFromPool(campaignKey: string): boolean {
    const pool = this.repository.getPool(campaignKey);
    if (!pool || !(pool.pending || []).length) return false;
    if (pool.autoContinuePaused) return false;

    const busy = this.repository
      .list()
      .some(
        (l) =>
          l.campaignKey === campaignKey &&
          (l.status === "scraping" || l.status === "enriching" || l.status === "draft"),
      );
    if (busy) return false;

    const today = saoPauloDayKey();
    const existingToday = this.repository.findListByCampaignDay(campaignKey, today);
    if (existingToday) {
      if (existingToday.status === "ready") {
        // Arquivo do dia já gerado — espera o próximo dia civil.
        return false;
      }
      if (existingToday.status === "failed") {
        this.createAndStart({
          name: pool.name,
          source: pool.source,
          filters: pool.filters,
          createdByEmail: "pipeline@local",
          skipPortalScrape: true,
        });
        return true;
      }
      return false;
    }

    // Sem lista hoje: inicia o lote do dia (após boot ou virada do dia).
    this.createAndStart({
      name: pool.name,
      source: pool.source,
      filters: pool.filters,
      createdByEmail: "pipeline@local",
      skipPortalScrape: true,
    });
    return true;
  }

  private enqueueJob(listId: string) {
    if (runningJobs.has(listId)) return;
    runningJobs.add(listId);
    setImmediate(() => {
      void this.runJob(listId).finally(() => runningJobs.delete(listId));
    });
  }

  private async runJob(listId: string) {
    if (cancelledJobs.has(listId)) {
      cancelledJobs.delete(listId);
      return;
    }
    let list = this.repository.getById(listId);
    if (!list) return;

    const assertAlive = () => {
      if (cancelledJobs.has(listId) || !this.repository.getById(listId)) {
        throw new Error(ABORT_JOB_ERROR);
      }
    };

    const patch = (
      partial: Partial<WabaLeadsCnpjList>,
      options?: { persist?: "debounce" | "flush" },
    ) => {
      if (cancelledJobs.has(listId)) return null;
      const current = this.repository.getById(listId);
      if (!current) return null;
      const next: WabaLeadsCnpjList = {
        ...current,
        ...partial,
        updatedAt: new Date().toISOString(),
      };
      if (partial.leads) next.leadCount = partial.leads.length;
      const onlyProgress =
        partial.progressMessage !== undefined &&
        Object.keys(partial).every((k) => k === "progressMessage");
      const persist =
        options?.persist ||
        (onlyProgress ? "debounce" : partial.leads ? "flush" : "debounce");
      this.repository.update(next, { persist });
      return next;
    };

    try {
      assertAlive();
      const campaignKey = String(list.campaignKey || buildCampaignKey(list.name, list.source));
      const baseName = campaignBaseName(list.name);
      const dayKey = String(list.dayKey || saoPauloDayKey());
      const dailyLimit = resolveDailyEnrichLimit();
      const delayMs = Math.max(
        1000,
        Math.round(Number(process.env.RECEITAWS_DELAY_MS || 30000) || 30000),
      );
      const used = this.repository.collectUsedCnpjs(campaignKey);

      // Retomada após restart: já tem o lote do dia na lista — só enriquecer de novo.
      // Exceto se a cópia do portal ficou prematura (ex. parou em 104/1000).
      const poolPendingForGate = this.repository.getPool(campaignKey)?.pending.length || 0;
      const prematurePortalCopy =
        list.source === "portal" &&
        !list.skipPortalScrape &&
        (list.status === "enriching" || list.status === "queued") &&
        !this.isPortalScrapeReallyComplete(list, poolPendingForGate, used.size);

      const resumeEnrichment =
        !prematurePortalCopy &&
        list.status === "enriching" &&
        Array.isArray(list.leads) &&
        list.leads.length > 0;
      const resumeQueued =
        !prematurePortalCopy &&
        list.status === "queued" &&
        Array.isArray(list.leads) &&
        list.leads.length > 0;

      if (prematurePortalCopy && Array.isArray(list.leads) && list.leads.length > 0) {
        // Devolve o lote parcial ao pool e limpa flags antes de retomar COPY.
        for (const lead of list.leads) used.delete(normalizeCnpjDigits(lead.cnpj));
        this.repository.mergePool({
          key: campaignKey,
          name: baseName,
          source: "portal",
          filters: list.filters,
          items: list.leads.map((l) => ({ cnpj: l.cnpj, nome: l.nome })),
          usedCnpjs: used,
          persist: "flush",
        });
        const pendingAfter = this.repository.getPool(campaignKey)?.pending.length || 0;
        const resumePage = this.estimatePortalResumePage(campaignKey, list);
        patch({
          status: "scraping",
          leads: [],
          leadCount: 0,
          scrapeCompleted: false,
          scrapeDoneReason: null,
          scrapeCheckpoint: {
            nextPage: resumePage,
            portalTotal: list.scrapeCheckpoint?.portalTotal ?? null,
            pagesToFetch:
              Math.max(
                1,
                Math.round(Number(list.filters?.maxPages || 0) || 0) || resolvePortalUiMaxPage(),
              ),
            collectedCount: pendingAfter,
          },
          progressMessage: `COPY prematura detectada (${resolveScrapeHistoryMetrics(list, pendingAfter, used.size).pagesDone}/${Math.max(1, Number(list.filters?.maxPages) || 1000)}) — retomando na pág. ${resumePage}…`,
          error: null,
        });
        list = this.repository.getById(listId) || list;
      }

      let dayLeads: WabaLeadsCnpjLead[] = [];
      let remaining = this.repository.getPool(campaignKey)?.pending.length || 0;

      if (resumeEnrichment || resumeQueued) {
        if (!this.canEnrichCampaignToday(campaignKey)) {
          patch({
            status: "queued",
            progressMessage: this.queuePositionLabel(campaignKey),
            error: null,
          });
          this.armGlobalEnrichQueue();
          return;
        }
        dayLeads = list.leads.slice();
        const already = dayLeads.filter((l) => l.enriched === true).length;
        patch({
          status: "enriching",
          progressMessage: formatReceitaWsLegend(
            already,
            dayLeads.length,
            already > 0 ? "retomando…" : "iniciando…",
          ),
        });
      } else {
        if (list.source === "portal" && !list.skipPortalScrape) {
          const pool = this.repository.getPool(campaignKey);
          const pendingCount = pool?.pending.length || 0;
          const ckpt = list.scrapeCheckpoint;
          const resumeFromPage = Math.max(1, Math.round(Number(ckpt?.nextPage || 1) || 1));
          const portalUiMaxPage = resolvePortalUiMaxPage();
          // Checkpoint além do teto da UI Oruga (página 1000): não reabrir Chromium em loop.
          if (ckpt && resumeFromPage > portalUiMaxPage) {
            patch({
              scrapeCheckpoint: null,
              scrapeReconnectAttempts: 0,
              error: null,
              progressMessage: `Copiando: teto da UI do portal (página ${portalUiMaxPage}) atingido — ${pendingCount.toLocaleString("pt-BR")} CNPJ(s) no pool; seguindo para enriquecimento.`,
            });
          }
          const freshList = this.repository.getById(listId) || list;
          const mustResumeScrape = Boolean(
            freshList.scrapeCheckpoint &&
              Math.max(1, Math.round(Number(freshList.scrapeCheckpoint.nextPage || 1) || 1)) >= 1 &&
              Math.max(1, Math.round(Number(freshList.scrapeCheckpoint.nextPage || 1) || 1)) <=
                portalUiMaxPage,
          );
          /**
           * Regra de produto: copiar até maxPages / teto UI ANTES de enriquecer.
           * scrapeCompleted prematuro (total do portal subestimado → ~104 págs.) não conta.
           */
          const portalCopyDone =
            this.isPortalScrapeReallyComplete(
              freshList,
              pendingCount,
              used.size,
              portalUiMaxPage,
            ) ||
            Boolean(ckpt && resumeFromPage > portalUiMaxPage) ||
            this.repository.list().some(
              (l) =>
                String(l.campaignKey || "").trim() === campaignKey &&
                this.isPortalScrapeReallyComplete(l, pendingCount, used.size, portalUiMaxPage),
            );
          const needPortalCopy =
            !portalCopyDone &&
            !(ckpt && resumeFromPage > portalUiMaxPage);
          if (needPortalCopy || mustResumeScrape) {
            const scrapeResumeRaw = Math.max(
              1,
              Math.round(Number(freshList.scrapeCheckpoint?.nextPage || 1) || 1),
            );
            // Pool vazio + checkpoint > 1 = retomada fantasma (ex.: pág. 11 sem CNPJs arquivados).
            // Checkpoint inflado ou atrás do pool → piso ≈ pending/20 + 1.
            const poolFloorPage = Math.max(1, Math.floor(pendingCount / 20) + 1);
            const scrapeResumeFrom =
              pendingCount === 0 && scrapeResumeRaw > 1
                ? 1
                : resolvePortalResumePage(scrapeResumeRaw, poolFloorPage);
            if (scrapeResumeFrom !== scrapeResumeRaw) {
              patch({
                status: "scraping",
                scrapeCheckpoint: {
                  nextPage: scrapeResumeFrom,
                  portalTotal: freshList.scrapeCheckpoint?.portalTotal ?? null,
                  pagesToFetch: freshList.scrapeCheckpoint?.pagesToFetch ?? null,
                  collectedCount: pendingCount,
                },
                progressMessage:
                  pendingCount === 0
                    ? `Abrindo Portal: checkpoint pág. ${scrapeResumeRaw} ignorado (pool vazio) — copiando desde a página 1…`
                    : `COPY: checkpoint pág. ${scrapeResumeRaw} → ${scrapeResumeFrom} (piso pool ${poolFloorPage}, ~${pendingCount} CNPJs)…`,
                error: null,
              });
            }
            const scrapeFilters = {
              ...list.filters,
              maxPages: Number(list.filters.maxPages) > 0 ? Number(list.filters.maxPages) : 0,
            };
            const campaignFilters = list.filters;
            const pagesToFetchTarget =
              Number(list.filters?.maxPages) > 0
                ? Number(list.filters.maxPages)
                : portalUiMaxPage;
            // Garante checkpoint desde o início: crash antes da 1ª página ainda retoma (pág. 1 ou pool).
            patch({
              status: "scraping",
              scrapeCompleted: false,
              scrapeCheckpoint: {
                nextPage: scrapeResumeFrom,
                portalTotal: freshList.scrapeCheckpoint?.portalTotal ?? null,
                pagesToFetch: pagesToFetchTarget,
                collectedCount: pendingCount,
              },
              progressMessage:
                scrapeResumeFrom > 1
                  ? `COPY: retomando da página ${scrapeResumeFrom} (pool ${pendingCount}; copiando até pág. ${pagesToFetchTarget} antes do ReceitaWS)…`
                  : `Abrindo Portal: robô na tela (pool ${pendingCount}; copiando até pág. ${pagesToFetchTarget} · 20/pág. — enrich só depois)…`,
              error: null,
            });
            let releaseScrapeSlot: (() => void) | null = null;
            let scraped: WabaLeadsCnpjLead[] = [];
            let scrapeSessionCompleted = false;
            let scrapeSessionDoneReason = "";
            /**
             * NÃO fechar Chromium por “stall” de progresso (default off).
             * Em produção o watchdog de 90s matava a sessão no meio de CNAE/Pesquisar
             * e reabria login+filtros em loop — oposto do V02 (1 janela até copiar tudo).
             * Opt-in diagnóstico: CASADOSDADOS_SCRAPE_STALL_MS=90000
             */
            const stallMs = Math.max(
              0,
              Math.round(Number(process.env.CASADOSDADOS_SCRAPE_STALL_MS || 0) || 0),
            );
            let lastProgressAt = Date.now();
            try {
              releaseScrapeSlot = await acquirePortalScrapeSlot(listId, (info) => {
                lastProgressAt = Date.now();
                if (info.phase === "stagger") {
                  const secs = Math.max(1, Math.ceil((info.waitMs || 0) / 1000));
                  patch({
                    status: "scraping",
                    progressMessage: `Abrindo Portal: espaçando início (~${secs}s) — ${info.activeCount}/${info.max} Chromium(s) ativos…`,
                    error: null,
                  });
                  return;
                }
                patch({
                  status: "scraping",
                  progressMessage: `Fila de raspagem: posição ${info.position} (máx. ${info.max} em paralelo; ${info.activeCount} ativo(s))…`,
                  error: null,
                });
              });
              assertAlive();
              const scrapeResult = await scrapeCasaDosDadosLeads(
                scrapeFilters,
                (message) => {
                  lastProgressAt = Date.now();
                  patch({ progressMessage: message });
                },
                {
                  resumeFromPage: scrapeResumeFrom,
                  // Piso pelo pool: não pular páginas ainda sem CNPJs arquivados.
                  resumeFloorPage: Math.max(1, Math.floor(pendingCount / 20) + 1),
                  shouldAbort: () => {
                    // Só fecha navegador se o usuário excluiu / job sumiu — nunca por demora.
                    if (cancelledJobs.has(listId) || isCampaignPurged(campaignKey)) return true;
                    if (!this.repository.getById(listId)) return true;
                    if (stallMs > 0 && Date.now() - lastProgressAt > stallMs) return true;
                    return false;
                  },
                  onPageCheckpoint: async (c) => {
                    lastProgressAt = Date.now();
                    if (
                      cancelledJobs.has(listId) ||
                      isCampaignPurged(campaignKey) ||
                      !this.repository.getById(listId)
                    ) {
                      throw new Error(ABORT_JOB_ERROR);
                    }
                    if (c.pageLeads.length) {
                      this.repository.mergePool({
                        key: campaignKey,
                        name: baseName,
                        source: "portal",
                        filters: campaignFilters,
                        items: c.pageLeads.map((l) => ({ cnpj: l.cnpj, nome: l.nome })),
                        usedCnpjs: used,
                      });
                    }
                    if (
                      cancelledJobs.has(listId) ||
                      isCampaignPurged(campaignKey) ||
                      !this.repository.getById(listId)
                    ) {
                      throw new Error(ABORT_JOB_ERROR);
                    }
                    const archived =
                      this.repository.getPool(campaignKey)?.pending.length || 0;
                    const sequential = Math.max(
                      1,
                      Math.round(Number(c.completedPage || 0) || 0) + 1,
                    );
                    // Sempre persiste a página Oruga real. NÃO rebobinar para volume/20
                    // (isso fazia a coluna Páginas mostrar 59 enquanto o log ia 322→323).
                    const nextPage = sequential;
                    // Não persiste checkpoint > teto UI (evita retomada em 1001+).
                    const beyondUi = nextPage > portalUiMaxPage;
                    patch({
                      status: "scraping",
                      scrapeCompleted: false,
                      scrapeCheckpoint: beyondUi
                        ? null
                        : {
                            nextPage,
                            portalTotal: c.portalTotal,
                            pagesToFetch: c.pagesToFetch,
                            collectedCount: archived,
                          },
                      scrapeReconnectAttempts: 0,
                      progressMessage: beyondUi
                        ? `COPY: página ${c.completedPage} (teto UI ${portalUiMaxPage}) — ${archived.toLocaleString("pt-BR")} CNPJs; encerrando.`
                        : `COPY: página ${c.completedPage}/${c.pagesToFetch}${
                            c.portalTotal != null
                              ? ` de ${c.portalTotal.toLocaleString("pt-BR")}`
                              : ""
                          } (${archived.toLocaleString("pt-BR")} CNPJs arquivados; próxima ${nextPage})…`,
                      error: null,
                    });
                  },
                },
              );
              scraped = scrapeResult.leads;
              scrapeSessionCompleted = scrapeResult.scrapeCompleted;
              scrapeSessionDoneReason = scrapeResult.doneReason;
            } finally {
              releaseScrapeSlot?.();
            }
            if (!this.repository.getById(listId)) return;
            if (isCampaignPurged(campaignKey) || cancelledJobs.has(listId)) return;
            if (scraped.length) {
              this.repository.mergePool({
                key: campaignKey,
                name: baseName,
                source: "portal",
                filters: campaignFilters,
                items: scraped.map((l) => ({ cnpj: l.cnpj, nome: l.nome })),
                usedCnpjs: used,
              });
            }
            const afterMerge = this.repository.getPool(campaignKey)?.pending.length || 0;
            // Retomada sem cards novos: não limpar checkpoint nem seguir para enrich parcial.
            if (scrapeResumeFrom > 1 && scraped.length === 0) {
              throw new Error(
                `Raspagem retomada da página ${scrapeResumeFrom} não trouxe cards — mantendo pool (${afterMerge}) e checkpoint.`,
              );
            }
            const liveAfter = this.repository.getById(listId);
            const ckNext = Math.max(
              0,
              Math.round(Number(liveAfter?.scrapeCheckpoint?.nextPage || 0) || 0),
            );
            // Enrich só com scrapeCompleted explícito E realmente completo (nunca parcial ~104/1000).
            if (scrapeSessionCompleted) {
              const provisional: WabaLeadsCnpjList = {
                ...(this.repository.getById(listId) || list),
                scrapeCompleted: true,
                scrapeDoneReason: scrapeSessionDoneReason || "DONE",
              };
              if (
                !this.isPortalScrapeReallyComplete(
                  provisional,
                  afterMerge,
                  used.size,
                  portalUiMaxPage,
                )
              ) {
                scrapeSessionCompleted = false;
                scrapeSessionDoneReason = `${scrapeSessionDoneReason || "DONE"}_PREMATURE`;
              }
            }
            if (!scrapeSessionCompleted) {
              patch({
                status: "scraping",
                scrapeCompleted: false,
                scrapeDoneReason: scrapeSessionDoneReason || "INCOMPLETE",
                scrapeReconnectAttempts: 0,
                progressMessage: `COPY: incompleta (${scrapeSessionDoneReason || "INCOMPLETE"}) — pág. ${ckNext || "?"} · pool ${afterMerge.toLocaleString("pt-BR")}; retomando cópia (enrich só após ${Number(list.filters?.maxPages) > 0 ? list.filters.maxPages : portalUiMaxPage} pág./fim do portal)…`,
                error: null,
              });
              setTimeout(() => {
                const again = this.repository.getById(listId);
                if (again?.status === "scraping" && !cancelledJobs.has(listId)) {
                  this.enqueueJob(listId);
                }
              }, 8_000);
              return;
            }
            patch({
              scrapeCheckpoint: null,
              scrapeCompleted: true,
              scrapeDoneReason: scrapeSessionDoneReason || "DONE",
              scrapeReconnectAttempts: 0,
              progressMessage: `DONE: raspagem concluída (${scrapeSessionDoneReason}) — ${afterMerge.toLocaleString("pt-BR")} CNPJ(s) no pool; liberando fila ReceitaWS…`,
            });
            if (!afterMerge && scraped.length > 0) {
              throw new Error(
                `Raspagem trouxe ${scraped.length} CNPJ(s), mas todos já saíram em listas anteriores desta campanha (anti-duplicidade). Use outro filtro/CNAE ou aguarde novos resultados no portal.`,
              );
            }
          } else if (!portalCopyDone) {
            // Precisa copiar, mas não entrou no if (ex.: race) — não enriquecer.
            patch({
              status: "scraping",
              scrapeCompleted: false,
              progressMessage: `Aguardando cópia completa do portal (até pág. ${portalUiMaxPage}) antes do ReceitaWS…`,
              error: null,
            });
            setTimeout(() => {
              const again = this.repository.getById(listId);
              if (again && !cancelledJobs.has(listId)) this.enqueueJob(listId);
            }, 8_000);
            return;
          } else {
            patch({
              progressMessage: `Usando pool existente (${pendingCount} pendente(s)); raspagem do portal já concluída.`,
            });
          }
        } else if (list.skipPortalScrape) {
          const pendingCount = this.repository.getPool(campaignKey)?.pending.length || 0;
          patch({
            progressMessage: `Pipeline diário: usando pool (${pendingCount} pendente(s)) para o lote ${dayKey}…`,
          });
        }

        if (!this.repository.getById(listId)) return;

        // Continuação `#portal-copy`: só alimenta o pool; Lista NN ready permanece.
        {
          const liveCopy = this.repository.getById(listId);
          const poolLeftGate = this.repository.getPool(campaignKey)?.pending.length || 0;
          if (
            liveCopy &&
            isPortalCopyContinuationList(liveCopy) &&
            this.isPortalScrapeReallyComplete(liveCopy, poolLeftGate, used.size)
          ) {
            const poolLeft = poolLeftGate;
            patch({
              status: "ready",
              leads: [],
              leadCount: 0,
              exportFileName: null,
              listaIndex: null,
              generatedAt: new Date().toISOString(),
              progressMessage: `Cópia do portal concluída — ${poolLeft.toLocaleString("pt-BR")} CNPJ(s) no pool para a fila ReceitaWS (próximas listas diárias).`,
              error: null,
            });
            this.armContinueFromPool(campaignKey);
            this.armGlobalEnrichQueue();
            return;
          }
        }

        // Trava: nunca enriquecer enquanto a cópia do portal da campanha não terminou.
        if (list.source === "portal" && !list.skipPortalScrape) {
          const liveGate = this.repository.getById(listId);
          const poolLeftGate = this.repository.getPool(campaignKey)?.pending.length || 0;
          const campaignCopyDone =
            (liveGate
              ? this.isPortalScrapeReallyComplete(liveGate, poolLeftGate, used.size)
              : false) || this.isCampaignPortalCopyComplete(campaignKey);
          if (!campaignCopyDone) {
            patch({
              status: "scraping",
              scrapeCompleted: false,
              progressMessage:
                "Cópia do portal incompleta — enriquecimento ReceitaWS só após todas as páginas (até maxPages/teto UI).",
              error: null,
            });
            setTimeout(() => {
              const again = this.repository.getById(listId);
              if (again && !cancelledJobs.has(listId)) this.enqueueJob(listId);
            }, 8_000);
            return;
          }
        }

        // Fila global: só a campanha do dia tira do pool / enriquece.
        if (!this.canEnrichCampaignToday(campaignKey)) {
          this.rebuildEnrichOrder();
          const order = this.repository.getEnrichQueue();
          this.repository.saveEnrichQueue({
            ...order,
            order: this.rebuildEnrichOrder(),
          });
          patch({
            status: "queued",
            progressMessage: this.queuePositionLabel(campaignKey),
            error: null,
          });
          this.armGlobalEnrichQueue();
          return;
        }

        const taken = this.repository.takeFromPool(campaignKey, dailyLimit);
        if (!taken.length) {
          throw new Error(
            "Nenhum CNPJ novo para o lote de hoje (pool vazio após raspagem/paginação, ou todos já usados em listas anteriores).",
          );
        }

        remaining = this.repository.getPool(campaignKey)?.pending.length || 0;
        dayLeads = taken.map((item) => {
          const lead = emptyLeadFromCnpj(item.cnpj);
          lead.nome = item.nome;
          return lead;
        });

        list = patch({
          leads: dayLeads,
          leadCount: dayLeads.length,
          status: "enriching",
          scrapeCheckpoint: null,
          scrapeReconnectAttempts: 0,
          progressMessage: formatReceitaWsLegend(0, dayLeads.length, "iniciando…"),
        })!;
        if (!list) return;
      }

      const enriched = await enrichLeadsCnpjList(
        listId,
        dayLeads,
        (message) => {
          assertAlive();
          patch({ progressMessage: message }, { persist: "debounce" });
        },
        (snapshot) => {
          assertAlive();
          // Só persiste leads; a legenda (incl. countdown) vem do onProgress.
          patch(
            {
              leads: snapshot,
              leadCount: snapshot.length,
              status: "enriching",
            },
            { persist: "flush" },
          );
        },
        () => cancelledJobs.has(listId) || !this.repository.getById(listId),
      );
      assertAlive();
      if (!this.repository.getById(listId)) return;

      remaining = this.repository.getPool(campaignKey)?.pending.length || 0;
      patch({
        progressMessage: `Formatando telefones para WhatsApp/EVO (1 celular por linha)…`,
      });
      const forExport = expandLeadsByMobileForEvo(enriched);
      const excel = buildLeadsCnpjExcelBuffer(forExport);
      const listaIndex = this.repository.nextListaIndex(campaignKey);
      const exportFileName = this.repository.saveExportFile(
        listId,
        excel,
        sanitizeExportBaseName(`${baseName}-${formatListaLabel(listaIndex)}`),
        dayKey,
      );
      const campaignScrapeDone = this.repository.list().some(
        (l) =>
          String(l.campaignKey || "").trim() === campaignKey && l.scrapeCompleted === true,
      );
      const continueHint =
        remaining > 0
          ? ` Pool: ${remaining.toLocaleString("pt-BR")} pendente(s) — amanhã a fila ReceitaWS continua (Lista seguinte).`
          : campaignScrapeDone
            ? " Pool esgotado — raspagem do portal concluída."
            : " Lote do dia esgotado; a cópia do portal ainda precisa completar as páginas restantes.";
      patch({
        leads: forExport,
        leadCount: forExport.length,
        status: "ready",
        generatedAt: new Date().toISOString(),
        exportFileName,
        listaIndex,
        downloadedAt: null,
        progressMessage: `${formatListaLabel(listaIndex)} pronta (${forExport.length} linha(s) com celular EVO 55+DDD+9…).${continueHint}`,
        error: null,
      });

      // Fecha o slot do dia: próxima campanha só após a virada SP.
      const q = this.repository.getEnrichQueue();
      this.repository.saveEnrichQueue({
        ...q,
        dayKey: saoPauloDayKey(),
        activeCampaignKey: null,
        lastCompletedCampaignKey: campaignKey,
        order: this.rebuildEnrichOrder(),
      });
      this.armGlobalEnrichQueue();
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Falha ao processar a lista de leads CNPJ.";
      if (msg === ABORT_JOB_ERROR || cancelledJobs.has(listId) || !this.repository.getById(listId)) {
        cancelledJobs.delete(listId);
        return;
      }

      // Soft (same-page/stop): NUNCA scheduleResume / LOGIN de novo.
      // Erros soft já esgotaram retry local no adapter.
      if (isSoftScrapeError(error) || (isLeadsScrapeError(error) && error.recovery !== "new-browser")) {
        const code = isLeadsScrapeError(error) ? error.code : "SOFT_SCRAPE";
        patch({
          status: "failed",
          error: msg,
          scrapeCompleted: false,
          scrapeDoneReason: code,
          progressMessage: `Pausado (erro operacional ${code}) — sem reconnect automático: ${msg.slice(0, 180)}`,
        });
        return;
      }

      const current = this.repository.getById(listId);
      const ckptPage = Math.max(0, Math.round(Number(current?.scrapeCheckpoint?.nextPage || 0) || 0));
      const archived = current?.campaignKey
        ? this.repository.getPool(current.campaignKey)?.pending.length || 0
        : 0;
      const attempts = Math.max(0, Math.round(Number(current?.scrapeReconnectAttempts || 0) || 0));
      const maxReconnect = Math.max(
        1,
        Math.round(Number(process.env.CASADOSDADOS_JOB_RECONNECTS || 20) || 20),
      );
      // Sem checkpoint explícito: estima pela quantidade já no pool (20 cards/página).
      // Pool 0 → sempre página 1 (nunca inventar pág. 8/11 e travar no posicionamento Xvfb).
      const resumePage =
        archived <= 0
          ? 1
          : Math.max(1, ckptPage || Math.floor(archived / 20) + 1);

      const hardRecovery =
        (isLeadsScrapeError(error) && error.recovery === "new-browser") ||
        (!(error instanceof LeadsScrapeError) &&
          /Target crashed|Page crashed|net::ERR_ABORTED|frame was detached|browser has been closed|has been closed|RENDERER_UNRESPONSIVE|BROWSER_DISCONNECTED|CDP_PROBE_TIMEOUT|LOGIN_TIMEOUT|locator\.waitFor|input\[name=.email/i.test(
            msg,
          ));

      const wasPortalScrape =
        Boolean(current) &&
        current!.source === "portal" &&
        !current!.skipPortalScrape &&
        (current!.status === "scraping" || ckptPage >= 1);

      // Só reconnect automático em HARD (crash/disconnect/renderer morto).
      if (current && wasPortalScrape && hardRecovery && attempts < maxReconnect) {
        patch({
          status: "scraping",
          error: msg,
          scrapeCheckpoint: {
            nextPage: resumePage,
            portalTotal: current.scrapeCheckpoint?.portalTotal ?? null,
            pagesToFetch: current.scrapeCheckpoint?.pagesToFetch ?? null,
            collectedCount: archived,
          },
          scrapeReconnectAttempts: attempts + 1,
          progressMessage: `COPY: recover Chromium — retomando página ${resumePage} em ~15s (arquivados: ${archived.toLocaleString("pt-BR")}; tentativa ${attempts + 1}/${maxReconnect})…`,
        });
        setTimeout(() => {
          const again = this.repository.getById(listId);
          if (again?.status === "scraping" && !cancelledJobs.has(listId)) this.enqueueJob(listId);
        }, 15_000);
        return;
      }

      // Erro desconhecido: NÃO destruir sessão automaticamente (conservador).
      patch({
        status: "failed",
        error: msg,
        progressMessage: wasPortalScrape
          ? `Falhou (sem reconnect auto). Checkpoint página ${resumePage} e ${archived.toLocaleString("pt-BR")} CNPJ(s) no pool mantidos. ${msg.slice(0, 120)}`
          : null,
      });
    }
  }
}
