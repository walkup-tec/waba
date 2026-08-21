export type WabaLeadsCnpjListStatus =
  | "draft"
  | "scraping"
  | "enriching"
  | "queued"
  | "ready"
  | "failed";

export type WabaLeadsCnpjLead = {
  cnpj: string;
  nome: string;
  telefone: string;
  email: string;
  situacao: string;
  dataAbertura: string;
  cidade: string;
  estado: string;
  endereco: string;
  /** Já consultado na ReceitaWS neste lote (retomada não zera a contagem). */
  enriched?: boolean;
};

export type WabaLeadsCnpjSituacao = "Ativa" | "Baixada" | "Inapta" | "Nula" | "Suspensa";

export type WabaLeadsCnpjTipoPesquisa = "Exata" | "Aproximada";

/**
 * Filtros alinhados ao portal Casa dos Dados (prints da tela de pesquisa).
 */
export type WabaLeadsCnpjFilters = {
  cnpj?: string;
  buscaTextual?: string;
  buscaEmRazaoSocial?: boolean;
  buscaEmNomeFantasia?: boolean;
  buscaEmNomeSocio?: boolean;
  tipoPesquisa?: WabaLeadsCnpjTipoPesquisa;

  cnpjRaiz?: string;
  situacaoCadastral?: WabaLeadsCnpjSituacao[];
  atividadePrincipalCnae?: string;
  incluirAtividadeSecundaria?: boolean;
  naturezaJuridica?: string;

  estadoUf?: string;
  municipio?: string;
  bairro?: string;
  cep?: string;
  ddd?: string;
  telefone?: string;

  dataAberturaDe?: string;
  dataAberturaAte?: string;
  capitalSocialMin?: string;
  capitalSocialMax?: string;
  empresasExcluidasMei?: boolean;
  excluidasMeiDe?: string;
  excluidasMeiAte?: string;
  empresasExcluidasSimples?: boolean;
  excluidasSimplesDe?: string;
  excluidasSimplesAte?: string;
  porteEmpresa?: string;

  somenteMei?: boolean;
  excluirMei?: boolean;
  somenteMatriz?: boolean;
  somenteFilial?: boolean;
  empresasDoSimples?: boolean;
  excluirEmpresasDoSimples?: boolean;
  comContatoTelefone?: boolean;
  somenteFixo?: boolean;
  somenteCelular?: boolean;
  comEmail?: boolean;
  excluirEmpresasVisualizadas?: boolean;
  excluirEmailContab?: boolean;

  /** 0 / omitido = todas as páginas do portal. Valor >0 só para teto manual de teste. */
  maxPages?: number;
};

export type WabaLeadsCnpjSource = "portal" | "manual";

/** Item pendente no pool da campanha (ainda não exportado em lista diária). */
export type WabaLeadsCnpjPoolItem = {
  cnpj: string;
  nome: string;
};

export type WabaLeadsCnpjPool = {
  key: string;
  name: string;
  source: WabaLeadsCnpjSource;
  filters: WabaLeadsCnpjFilters;
  pending: WabaLeadsCnpjPoolItem[];
  updatedAt: string;
  /**
   * Quando true (ex.: usuário clicou Excluir), o pipeline NÃO recria lista do dia
   * a partir do pool até uma nova extração manual.
   */
  autoContinuePaused?: boolean;
};

/** Cursor de raspagem Casa dos Dados (página Oruga). */
export type WabaLeadsCnpjScrapeCheckpoint = {
  nextPage: number;
  portalTotal?: number | null;
  pagesToFetch?: number | null;
  collectedCount?: number;
};

export type WabaLeadsCnpjList = {
  id: string;
  name: string;
  status: WabaLeadsCnpjListStatus;
  source: WabaLeadsCnpjSource;
  filters: WabaLeadsCnpjFilters;
  leads: WabaLeadsCnpjLead[];
  leadCount: number;
  createdAt: string;
  updatedAt: string;
  generatedAt: string | null;
  exportFileName: string | null;
  error: string | null;
  createdByEmail: string;
  progressMessage?: string | null;
  /** Dia civil America/Sao_Paulo (YYYY-MM-DD) desta lista. */
  dayKey?: string;
  /** Chave estável da campanha (nome base + origem), para pool e anti-duplicidade entre dias da mesma extração. */
  campaignKey?: string;
  /**
   * Se true, o job do dia só tira do pool (não raspa o portal de novo).
   * Usado pelo pipeline automático dia→dia.
   */
  skipPortalScrape?: boolean;
  /**
   * Checkpoint da raspagem no portal: próxima página a ler.
   * Em interrupção (modal/browser), retoma daqui e mantém o pool já arquivado.
   */
  scrapeCheckpoint?: WabaLeadsCnpjScrapeCheckpoint | null;
  /** Tentativas de reconexão após falha com checkpoint (cap no service). */
  scrapeReconnectAttempts?: number;
  /** Índice do Excel na campanha (Lista 01, 02, …). */
  listaIndex?: number | null;
  /** Quando o master baixou este Excel (ISO). */
  downloadedAt?: string | null;
};

export type WabaLeadsCnpjDownloadSummary = {
  id: string;
  listaIndex: number;
  listaLabel: string;
  dayKey: string | null;
  downloadedAt: string | null;
  exportFileName: string | null;
};

export type WabaLeadsCnpjListSummary = {
  id: string;
  name: string;
  status: WabaLeadsCnpjListStatus;
  source: WabaLeadsCnpjSource;
  leadCount: number;
  createdAt: string;
  generatedAt: string | null;
  exportFileName: string | null;
  error: string | null;
  progressMessage?: string | null;
  dayKey?: string | null;
  campaignKey?: string | null;
  listaIndex?: number | null;
  listaLabel?: string | null;
  downloadedAt?: string | null;
  /** Excels ready da mesma campanha (botões Lista 01…N). */
  campaignDownloads?: WabaLeadsCnpjDownloadSummary[];
  /** CNPJs ainda no pool da campanha (lista total não finalizada). */
  poolPending?: number;
  /** true só quando pool zerou e não há lote em andamento desta campanha. */
  campaignFinished?: boolean;
};

export type WabaLeadsCnpjEnrichQueueEntry = {
  key: string;
  name: string;
  position: number;
  state: "active" | "waiting" | "done" | "idle";
};

export type WabaLeadsCnpjEnrichQueueSummary = {
  dayKey: string;
  activeCampaignKey: string | null;
  lastCompletedCampaignKey: string | null;
  entries: WabaLeadsCnpjEnrichQueueEntry[];
};

export type WabaLeadsCnpjEnrichQueue = {
  version: 1;
  dayKey: string;
  activeCampaignKey: string | null;
  lastCompletedCampaignKey: string | null;
  order: string[];
};
