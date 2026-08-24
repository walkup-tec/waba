import type { WabaLeadsCnpjFilters, WabaLeadsCnpjLead } from "./waba-leads-cnpj.types";
import { emptyLeadFromCnpj, normalizeCnpjDigits } from "./waba-leads-cnpj.repository";

const PORTAL_LOGIN_URL =
  process.env.CASADOSDADOS_LOGIN_URL || "https://portal.casadosdados.com.br/entrar";
const PORTAL_SEARCH_URL =
  process.env.CASADOSDADOS_SEARCH_URL ||
  "https://portal.casadosdados.com.br/plataforma/pesquisa";

async function isCloudflareInterstitial(page: {
  title: () => Promise<string>;
  evaluate: <T>(fn: () => T) => Promise<T>;
  url?: () => string;
}): Promise<boolean> {
  const title = await page.title().catch(() => "");
  if (/um momento|just a moment/i.test(title)) return true;
  const url = typeof page.url === "function" ? String(page.url() || "") : "";
  if (/__cf_chl|cf-challenge|cdn-cgi\/challenge/i.test(url)) return true;
  const hint = await page
    .evaluate(() => {
      const text = String(document.body?.innerText || "").slice(0, 800).toLowerCase();
      return (
        text.includes("cloudflare") ||
        text.includes("verificação de segurança") ||
        text.includes("checking your browser") ||
        text.includes("just a moment")
      );
    })
    .catch(() => false);
  return Boolean(hint);
}

/**
 * Anti-bot do portal (título "Um momento…" / "Just a moment…").
 * Em headless costuma NÃO limpar; com janela (V02) ou Xvfb+headed limpa em <2s.
 */
async function waitPastCloudflare(
  page: {
    title: () => Promise<string>;
    waitForFunction: (fn: () => boolean, options?: { timeout?: number }) => Promise<unknown>;
    waitForTimeout: (ms: number) => Promise<void>;
    evaluate: <T>(fn: () => T) => Promise<T>;
    url?: () => string;
  },
  options?: { timeoutMs?: number; onProgress?: CasaDosDadosProgress; stage?: string },
) {
  const timeoutMs = Math.max(
    5000,
    Math.round(Number(options?.timeoutMs ?? (Number(process.env.CASADOSDADOS_CF_WAIT_MS || 90000) || 90000))),
  );
  const stage = options?.stage || "portal";
  if (!(await isCloudflareInterstitial(page))) return;

  options?.onProgress?.(
    `Abrindo Portal: verificação anti-bot em andamento (${stage}) — aguardando liberação…`,
  );
  const cleared = await page
    .waitForFunction(() => !/um momento|just a moment/i.test(document.title), {
      timeout: timeoutMs,
    })
    .then(() => true)
    .catch(() => false);
  await page.waitForTimeout(800);
  if (cleared && !(await isCloudflareInterstitial(page))) return;

  const title = await page.title().catch(() => "");
  const url = typeof page.url === "function" ? page.url() : "";
  throw new Error(
    `Portal Casa dos Dados bloqueou o robô (anti-bot / "Um momento…"). ` +
      `No V02 funciona com janela visível; no Docker use Xvfb + Chromium headed (entrypoint). ` +
      `stage=${stage}; title=${title || "(vazio)"}; url=${String(url).slice(0, 160)}`,
  );
}

/**
 * Evita "Navigation … is interrupted by another navigation" (ex.: pós-login
 * ainda indo para /plataforma enquanto o robô chama goto /pesquisa).
 */
async function gotoWithRetry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  url: string,
  options?: { waitUntil?: "domcontentloaded" | "load" | "networkidle"; timeout?: number },
) {
  const waitUntil = options?.waitUntil || "domcontentloaded";
  const timeout = options?.timeout || 60000;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      await page.goto(url, { waitUntil, timeout });
      return;
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      if (!/interrupted by another navigation/i.test(msg)) throw error;
      await page.waitForLoadState("domcontentloaded").catch(() => null);
      await page.waitForTimeout(600 * attempt);
    }
  }
  throw lastError;
}

/**
 * Login /entrar (evidência medida em probe 2026-08-11):
 * - Acessar inicia disabled.
 * - Habilita IFF email+senha preenchidos via Playwright fill (ambos).
 * - email-only / senha-only / vazio → disabled → mesmo erro do usuário ("element is not enabled").
 * - Com ambos preenchidos → click ~70ms (não fica 45s).
 * Logo: timeout 45s com Acessar disabled = formulário sem os dois campos aceitos o tempo todo.
 */
async function loginCasaDosDadosPortal(
  // Playwright Page (tipagem folgada: evita acoplar ao tipo completo do pacote).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  email: string,
  password: string,
) {
  if (!email || !password) {
    throw new Error(
      `Login Casa dos Dados: credencial vazia no processo (emailLen=${email.length}, passwordLen=${password.length}).`,
    );
  }

  const emailInput = page.locator('input[name="email"]').first();
  const passwordInput = page.locator('input[name="senha"]').first();
  const accessBtn = page.locator('button:has-text("Acessar")').first();

  await emailInput.waitFor({ state: "visible", timeout: 30000 });
  await passwordInput.waitFor({ state: "visible", timeout: 15000 });
  await accessBtn.waitFor({ state: "visible", timeout: 10000 });

  const readLoginState = async () =>
    page.evaluate(() => {
      const emailEl = document.querySelector('input[name="email"]') as HTMLInputElement | null;
      const senhaEl = document.querySelector('input[name="senha"]') as HTMLInputElement | null;
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        /acessar/i.test(b.textContent || ""),
      ) as HTMLButtonElement | undefined;
      return {
        emailLen: emailEl ? String(emailEl.value || "").length : -1,
        senhaLen: senhaEl ? String(senhaEl.value || "").length : -1,
        btnDisabled: btn ? btn.disabled : null,
        url: location.href,
      };
    }) as Promise<{ emailLen: number; senhaLen: number; btnDisabled: boolean | null; url: string }>;

  const fillBoth = async (mode: "fill" | "type") => {
    await emailInput.click({ clickCount: 3 });
    await emailInput.fill("");
    if (mode === "fill") await emailInput.fill(email);
    else await emailInput.pressSequentially(email, { delay: 15 });
    await emailInput.dispatchEvent("input").catch(() => undefined);
    await emailInput.dispatchEvent("change").catch(() => undefined);

    await passwordInput.click({ clickCount: 3 });
    await passwordInput.fill("");
    if (mode === "fill") await passwordInput.fill(password);
    else await passwordInput.pressSequentially(password, { delay: 15 });
    await passwordInput.dispatchEvent("input").catch(() => undefined);
    await passwordInput.dispatchEvent("change").catch(() => undefined);
  };

  await fillBoth("fill");
  let state = await readLoginState();
  if (state.btnDisabled !== false || state.emailLen < 3 || state.senhaLen < 1) {
    await fillBoth("type");
    state = await readLoginState();
  }

  if (state.btnDisabled !== false) {
    await page
      .waitForFunction(() => {
        const btn = Array.from(document.querySelectorAll("button")).find((b) =>
          /acessar/i.test((b as HTMLButtonElement).textContent || ""),
        );
        return Boolean(btn && !(btn as HTMLButtonElement).disabled);
      }, { timeout: 8000 })
      .catch(() => null);
    state = await readLoginState();
  }

  if (state.btnDisabled !== false) {
    throw new Error(
      `Login Casa dos Dados: botão Acessar continua disabled (emailLen=${state.emailLen}, senhaLen=${state.senhaLen}, url=${state.url}). O portal só habilita com e-mail e senha aceitos no formulário — não é falha de clique.`,
    );
  }

  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => null),
    accessBtn.click({ timeout: 15000 }),
  ]);
  // Pós-login o portal costuma ir para /plataforma (redirect). Espera sair de /entrar.
  await page
    .waitForURL((url: URL) => !/\/entrar\/?$/i.test(url.pathname), { timeout: 45000 })
    .catch(() => null);
  await page.waitForLoadState("domcontentloaded").catch(() => null);
  await page.waitForTimeout(400);

  const afterUrl = String(page.url?.() || "");
  if (/\/entrar\/?$/i.test(new URL(afterUrl || "https://portal.casadosdados.com.br/entrar").pathname)) {
    const tip = await page
      .evaluate(() => String(document.body?.innerText || "").replace(/\s+/g, " ").slice(0, 220))
      .catch(() => "");
    throw new Error(
      `Login Casa dos Dados: ainda em /entrar após Acessar (url=${afterUrl}). ` +
        `Confira CASADOSDADOS_EMAIL/PASSWORD no ambiente. Detalhe: ${tip || "(sem texto)"}`,
    );
  }
}

export type CasaDosDadosProgress = (message: string) => void;

export type ScrapePageCheckpoint = {
  completedPage: number;
  nextPage: number;
  pageLeads: WabaLeadsCnpjLead[];
  sessionCollected: WabaLeadsCnpjLead[];
  portalTotal: number | null;
  pagesToFetch: number;
};

export type ScrapeCasaDosDadosOptions = {
  /** Página Oruga a partir da qual continuar (1 = início). */
  resumeFromPage?: number;
  /** Chamado após cada página lida com sucesso (antes de avançar). */
  onPageCheckpoint?: (ckpt: ScrapePageCheckpoint) => void | Promise<void>;
  /** Se retornar true, fecha o Chromium e aborta (stall / exclusão). */
  shouldAbort?: () => boolean;
  /** Cookies/localStorage de sessão anterior (recovery sem re-login quando possível). */
  storageState?: unknown;
  /** Persistido após login bem-sucedido para o próximo recovery. */
  onStorageState?: (state: unknown) => void | Promise<void>;
};

/** Resultado da raspagem — enrich só se scrapeCompleted. */
export type ScrapeCasaDosDadosResult = {
  leads: WabaLeadsCnpjLead[];
  scrapeCompleted: boolean;
  doneReason: string;
};

export type ScrapePhase =
  | "BOOT"
  | "LOGIN"
  | "FILTERS"
  | "SEARCH"
  | "COPY"
  | "RECOVER"
  | "DONE";

export class RendererUnresponsiveError extends Error {
  readonly code = "RENDERER_UNRESPONSIVE" as const;
  constructor(stage: string) {
    super(`Renderer não responde durante ${stage}`);
    this.name = "RendererUnresponsiveError";
  }
}

/**
 * Erro tipado do scraper — recovery decide se o service pode scheduleResume.
 * same-page / stop → NUNCA reconnect automático no service.
 * new-browser → Target crashed / renderer morto.
 */
export class LeadsScrapeError extends Error {
  constructor(
    public readonly code: string,
    public readonly recovery: "same-page" | "new-browser" | "stop",
    message: string,
  ) {
    super(message);
    this.name = "LeadsScrapeError";
  }
}

export function isLeadsScrapeError(error: unknown): error is LeadsScrapeError {
  return error instanceof LeadsScrapeError;
}

export function isSoftScrapeError(error: unknown): boolean {
  if (error instanceof LeadsScrapeError) {
    return error.recovery === "same-page" || error.recovery === "stop";
  }
  const anyErr = error as { recovery?: string; soft?: boolean; code?: string } | null;
  if (anyErr?.soft === true) return true;
  if (anyErr?.recovery === "same-page" || anyErr?.recovery === "stop") return true;
  const msg = error instanceof Error ? error.message : String(error || "");
  return /SEARCH_TIMEOUT_RESPONSIVE|SEARCH_DISPATCH_FAILED|SEARCH_BUTTON_NOT_FOUND|PAGINATION_STALL/i.test(
    msg,
  );
}

type SearchTransition =
  | { kind: "results"; total: number | null }
  | { kind: "empty" }
  | { kind: "blocked" }
  | { kind: "timeout-responsive"; probe?: SearchProbe }
  | { kind: "renderer-unresponsive" };

type SearchButtonCandidate = {
  tag: string;
  text: string;
  aria: string;
  title: string;
  type: string;
  classes: string;
  score: number;
  source: "control" | "ancestor";
  rect: { x: number; y: number; width: number; height: number };
};

type SearchProbe = {
  url: string;
  readyState: string;
  searchButtonFound: boolean;
  searchButtonDisabled: boolean;
  searchButtonText: string | null;
  searchButtonCount: number;
  searchButtonCandidate: SearchButtonCandidate | null;
  topCandidates: SearchButtonCandidate[];
  pagination: boolean;
  currentPage: number | null;
  cnpjNodes: number;
  totalCandidates: string[];
  loadingNodes: number;
  dialogs: number;
  iframeCount: number;
  iframeSrcs: string[];
  challengeNodes: number;
  buttonDebug: {
    tag: string;
    type: string | null;
    classes: string;
    rect: { x: number; y: number; width: number; height: number } | null;
    html: string;
    score: number;
    source: string;
  } | null;
};

function formatProbeShort(p: SearchProbe): string {
  const win = p.searchButtonCandidate;
  const winLabel = win
    ? `${win.tag} text="${win.text.slice(0, 40)}" score=${win.score}`
    : "none";
  return (
    `url=${p.url.replace(/^https?:\/\/[^/]+/, "")} ` +
    `btn=${p.searchButtonFound}/${p.searchButtonCount} ` +
    `win=${winLabel} ` +
    `disabled=${p.searchButtonDisabled} ` +
    `loading=${p.loadingNodes} ` +
    `pag=${p.pagination} ` +
    `cnpj=${p.cnpjNodes} ` +
    `iframes=${p.iframeCount} ` +
    `dialogs=${p.dialogs} ` +
    `challenge=${p.challengeNodes}`
  );
}

export function readCasaDosDadosCredentials(): { email: string; password: string } {
  const email = String(process.env.CASADOSDADOS_EMAIL || "").trim();
  const password = String(process.env.CASADOSDADOS_PASSWORD || "").trim();
  if (!email || !password) {
    throw new Error(
      "Credenciais do Casa dos Dados ausentes. Configure CASADOSDADOS_EMAIL e CASADOSDADOS_PASSWORD no .env.v02 e reinicie o V02.",
    );
  }
  return { email, password };
}

/** Valida credenciais antes de criar a lista (falha rápida na UI). */
export function assertCasaDosDadosCredentials(): void {
  readCasaDosDadosCredentials();
}

async function loadPlaywright(): Promise<any> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("playwright");
  } catch {
    throw new Error(
      "Playwright não instalado. Execute: npm i playwright && npx playwright install chromium",
    );
  }
}

function cellText(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Portal Oruga: 20 cards por página (evidência probe 2026-08-11 — nav data-oruga=pagination). */
const PORTAL_PAGE_SIZE = 20;

/**
 * Teto da UI Oruga: botões de página só até "1000" (20×1000 ≈ 20 000 cards).
 * Além disso o next fica inútil e a retomada em 1001+ abre/fecha Chromium em loop.
 * Override: CASADOSDADOS_UI_MAX_PAGE.
 */
export function resolvePortalUiMaxPage(): number {
  const raw = Math.round(Number(process.env.CASADOSDADOS_UI_MAX_PAGE || 1000) || 1000);
  return Math.max(1, Number.isFinite(raw) ? raw : 1000);
}

/**
 * Formato do card: "94.361.474/0001-02 - LCT - CORRETORA DE SEGUROS LTDA"
 * Coleta apenas CNPJ + Razão Social (enriquecimento preenche o restante).
 */
function parsePortalLeadText(text: string): WabaLeadsCnpjLead | null {
  const raw = cellText(text);
  if (!raw) return null;
  const formatted = raw.match(
    /^(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\s*[-–—]\s*(.+)$/i,
  );
  if (formatted) {
    const cnpj = normalizeCnpjDigits(formatted[1]);
    if (cnpj.length !== 14) return null;
    const lead = emptyLeadFromCnpj(cnpj);
    lead.nome = cellText(
      formatted[2].replace(/\s*\b(Ativa|Baixada|Inapta|Nula|Suspensa)\b.*$/i, ""),
    );
    return lead;
  }
  const digits = raw.replace(/\D/g, "").match(/\d{14}/);
  if (!digits) return null;
  const cnpj = digits[0];
  const lead = emptyLeadFromCnpj(cnpj);
  const after = raw.replace(/^\D*\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\s*[-–—]?\s*/i, "");
  lead.nome = cellText(after.replace(/\s*\b(Ativa|Baixada|Inapta|Nula|Suspensa)\b.*$/i, ""));
  return lead;
}

function mapRowCells(cells: string[]): WabaLeadsCnpjLead | null {
  if (!cells.length) return null;
  const fromJoined = parsePortalLeadText(cells.join(" "));
  if (fromJoined) return fromJoined;
  if (cells.length >= 2) {
    const cnpj = normalizeCnpjDigits(cells[0]);
    if (cnpj.length === 14) {
      const lead = emptyLeadFromCnpj(cnpj);
      lead.nome = cellText(cells[1]);
      return lead;
    }
  }
  return parsePortalLeadText(cells[0] || "");
}

type LocatorLike = {
  count: () => Promise<number>;
  fill: (value: string, options?: { force?: boolean }) => Promise<void>;
  type: (text: string, options?: { delay?: number }) => Promise<void>;
  click: (options?: { force?: boolean; timeout?: number }) => Promise<void>;
  check: (options?: { force?: boolean }) => Promise<void>;
  uncheck: () => Promise<void>;
  isChecked: () => Promise<boolean>;
  isDisabled: () => Promise<boolean>;
  isVisible: () => Promise<boolean>;
  press: (key: string) => Promise<void>;
  dispatchEvent: (type: string) => Promise<void>;
  scrollIntoViewIfNeeded: () => Promise<void>;
  selectOption: (value: string) => Promise<unknown>;
};

type PageLike = {
  locator: (selector: string) => { first: () => LocatorLike; last: () => LocatorLike };
  keyboard: { press: (key: string) => Promise<void>; type?: (text: string, options?: { delay?: number }) => Promise<void> };
  waitForTimeout: (ms: number) => Promise<void>;
  // Playwright aceita argumento; tipagem folgada para CNAE via DOM.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evaluate: <T>(fn: (arg?: any) => T, arg?: any) => Promise<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  waitForFunction?: (fn: (arg?: any) => unknown, arg?: any, options?: { timeout?: number }) => Promise<unknown>;
};

const XPATH_FOLD =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZÁÀÂÃÉÊÍÓÔÕÚÇ','abcdefghijklmnopqrstuvwxyzáàâãéêíóôõúç";

function xpathLower(expr = "."): string {
  return `translate(normalize-space(${expr}), '${XPATH_FOLD}')`;
}

/** Fecha modal "Inserir CNPJ em lote" se estiver aberto (bloqueia cliques nos filtros). */
async function dismissBlockingPortalOverlays(page: PageLike) {
  const batchModal = page
    .locator(
      'xpath=//textarea[contains(@placeholder,"Um CNPJ por linha") or contains(@placeholder,"CNPJ por linha")]',
    )
    .first();
  if ((await batchModal.count()) > 0 && (await batchModal.isVisible().catch(() => false))) {
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(300);
    const closeBtn = page
      .locator(
        'button:has-text("Cancelar"), button:has-text("Fechar"), .modal-close, button.delete',
      )
      .first();
    if ((await closeBtn.count()) > 0 && (await closeBtn.isVisible().catch(() => false))) {
      await closeBtn.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(200);
    }
  }
}

function isChromiumTargetCrash(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || "");
  return /Target crashed|has been closed|browser has been closed|Target page, context or browser has been closed/i.test(
    msg,
  );
}

function requiresBrowserRecovery(error: unknown): boolean {
  if (error instanceof LeadsScrapeError) return error.recovery === "new-browser";
  if (error instanceof RendererUnresponsiveError) return true;
  const anyErr = error as { code?: string; recovery?: string } | null;
  if (anyErr?.recovery === "new-browser") return true;
  if (anyErr?.code === "RENDERER_UNRESPONSIVE") return true;
  if (isSoftScrapeError(error)) return false;
  return isChromiumTargetCrash(error);
}

/** Texto da área de resultados (evita serializar document.body inteiro via CDP). */
async function readResultsSampleText(page: PageLike, maxChars = 12_000): Promise<string> {
  return page.evaluate((limit: number) => {
    const root =
      (document.querySelector("main") as HTMLElement | null) ||
      (document.querySelector(".section, .container, #app") as HTMLElement | null) ||
      document.body;
    return String(root?.innerText || "").slice(0, Math.max(1000, limit));
  }, maxChars);
}

/** Cards CNPJ na tela — evaluate leve, sem scroll artificial. */
async function readScreenCardsLight(page: PageLike): Promise<string[][]> {
  return page.evaluate(() => {
    const re = /^(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\s+-\s+(.+)$/;
    const seen = new Set<string>();
    const out: string[][] = [];
    const root =
      (document.querySelector("main") as HTMLElement | null) ||
      (document.querySelector(".section, .container, #app") as HTMLElement | null) ||
      document.body;
    const lines = String(root?.innerText || "")
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    // Cards ficam no miolo; evita varrer menus/rodapé enormes.
    const slice = lines.length > 400 ? lines.slice(0, 400) : lines;
    for (const line of slice) {
      const m = line.match(re);
      if (!m || seen.has(m[1])) continue;
      seen.add(m[1]);
      out.push([m[1], m[2]]);
      if (out.length >= 40) break;
    }
    return out;
  });
}

async function readFirstVisibleCnpjDigits(page: PageLike): Promise<string> {
  const rows = await readScreenCardsLight(page);
  const raw = rows[0]?.[0] || "";
  return normalizeCnpjDigits(raw);
}

async function rendererProbe(page: { evaluate: <T>(fn: () => T) => Promise<T> }, timeoutMs = 3000): Promise<boolean> {
  return Promise.race([
    page
      .evaluate(() => ({
        href: location.href,
        title: document.title,
        readyState: document.readyState,
      }))
      .then(() => true)
      .catch(() => false),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
  ]);
}

type SearchStateLite = {
  hasPagination: boolean;
  currentPage: number | null;
  searching: boolean;
  hasCnpj: boolean;
  cnpjNodes: number;
  totalHint: number | null;
  emptyHint: boolean;
  blocked: boolean;
  loadingNodes: number;
};

async function findSearchButtonCandidates(page: PageLike): Promise<SearchButtonCandidate[]> {
  return page.evaluate(() => {
    const clean = (v: unknown) =>
      String(v || "")
        .replace(/\s+/g, " ")
        .trim();
    const normalize = (v: unknown) => clean(v).toLowerCase();
    const isVisible = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return (
        r.width >= 20 &&
        r.height >= 15 &&
        r.bottom > 0 &&
        r.right > 0 &&
        s.display !== "none" &&
        s.visibility !== "hidden" &&
        Number(s.opacity || "1") > 0
      );
    };
    const scoreEl = (
      el: HTMLElement,
      text: string,
      aria: string,
      title: string,
    ): number | null => {
      const nt = normalize(text);
      const na = normalize(aria);
      const nti = normalize(title);
      const combined = `${nt} ${na} ${nti}`;
      if (!combined.includes("pesquisar") && !combined.includes("buscar")) return null;
      let score = 0;
      if (nt === "pesquisar" || nt === "buscar") score += 100;
      if (nt.includes("pesquisar")) score += 70;
      if (nt.includes("buscar")) score += 50;
      if (na.includes("pesquisar") || na.includes("buscar")) score += 60;
      if (nti.includes("pesquisar") || nti.includes("buscar")) score += 40;
      if (el.tagName === "BUTTON") score += 30;
      if (el.getAttribute("type") === "submit") score += 25;
      if (el.tagName === "A") score += 10;
      const r = el.getBoundingClientRect();
      score += Math.min(30, Math.round((r.width * r.height) / 1000));
      return score;
    };
    const toCandidate = (
      el: HTMLElement,
      score: number,
      source: "control" | "ancestor",
    ) => {
      const r = el.getBoundingClientRect();
      const text =
        el instanceof HTMLInputElement ? clean(el.value) : clean(el.textContent);
      return {
        tag: el.tagName,
        text: text.slice(0, 120),
        aria: clean(el.getAttribute("aria-label")).slice(0, 120),
        title: clean(el.getAttribute("title")).slice(0, 120),
        type: el.getAttribute("type") || "",
        classes: typeof el.className === "string" ? el.className.slice(0, 250) : "",
        score,
        source,
        rect: { x: r.x, y: r.y, width: r.width, height: r.height },
      };
    };
    const getClickableAncestor = (el: Element): HTMLElement | null => {
      let current: HTMLElement | null = el as HTMLElement;
      for (let depth = 0; current && depth < 5; depth += 1) {
        const tag = current.tagName;
        const role = current.getAttribute("role");
        const type = current.getAttribute("type");
        if (
          tag === "BUTTON" ||
          tag === "A" ||
          role === "button" ||
          type === "submit" ||
          type === "button" ||
          current.tabIndex >= 0
        ) {
          return current;
        }
        current = current.parentElement;
      }
      return null;
    };

    const selector = [
      "button",
      "a",
      '[role="button"]',
      'input[type="submit"]',
      'input[type="button"]',
      '[type="submit"]',
      "[tabindex]",
      '[class*="button"]',
      '[class*="btn"]',
    ].join(",");

    const seen = new Set<Element>();
    const out: ReturnType<typeof toCandidate>[] = [];

    for (const raw of Array.from(document.querySelectorAll(selector))) {
      if (seen.has(raw) || !(raw instanceof HTMLElement)) continue;
      seen.add(raw);
      if (!isVisible(raw)) continue;
      const text =
        raw instanceof HTMLInputElement ? clean(raw.value) : clean(raw.textContent);
      const aria = clean(raw.getAttribute("aria-label"));
      const title = clean(raw.getAttribute("title"));
      const textForScore = text.length > 120 ? text.slice(0, 120) : text;
      if (
        text.length > 80 &&
        !normalize(aria).includes("pesquis") &&
        !normalize(title).includes("pesquis") &&
        !normalize(aria).includes("busc") &&
        !normalize(title).includes("busc")
      ) {
        const shortSelf = normalize(text).slice(0, 40);
        if (!shortSelf.includes("pesquis") && !shortSelf.includes("busc")) continue;
      }
      const score = scoreEl(raw, textForScore, aria, title);
      if (score == null) continue;
      out.push(toCandidate(raw, score, "control"));
    }

    const root = document.querySelector("main") || document.body;
    for (const raw of Array.from(root.querySelectorAll("*")).slice(0, 2500)) {
      if (!(raw instanceof HTMLElement)) continue;
      const own = clean(
        Array.from(raw.childNodes)
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent || "")
          .join(" "),
      );
      const text = own || clean(raw.textContent).slice(0, 80);
      if (!text || text.length > 80) continue;
      if (!/pesquisar|buscar/i.test(text)) continue;
      const clickable = getClickableAncestor(raw);
      if (!clickable || seen.has(clickable) || !isVisible(clickable)) continue;
      seen.add(clickable);
      const cText =
        clickable instanceof HTMLInputElement
          ? clean(clickable.value)
          : clean(clickable.textContent).slice(0, 120);
      const aria = clean(clickable.getAttribute("aria-label"));
      const title = clean(clickable.getAttribute("title"));
      const score = scoreEl(clickable, cText || text, aria, title);
      if (score == null) continue;
      out.push(toCandidate(clickable, score + 5, "ancestor"));
    }

    return out.sort((a, b) => b.score - a.score).slice(0, 10);
  });
}

async function dumpVisibleActions(page: PageLike): Promise<unknown[]> {
  return page.evaluate(() => {
    const clean = (v: unknown) =>
      String(v || "")
        .replace(/\s+/g, " ")
        .trim();
    const root = document.querySelector("main") ?? document.body;
    const elements = Array.from(
      root.querySelectorAll(
        'button, a, [role="button"], input[type="submit"], input[type="button"], [tabindex]',
      ),
    ) as HTMLElement[];
    return elements
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const visible =
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden";
        if (!visible) return null;
        return {
          tag: el.tagName,
          text:
            el instanceof HTMLInputElement
              ? clean(el.value)
              : clean(el.textContent).slice(0, 80),
          aria: clean(el.getAttribute("aria-label")),
          title: clean(el.getAttribute("title")),
          type: el.getAttribute("type") || "",
          classes: typeof el.className === "string" ? el.className.slice(0, 150) : "",
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
          },
        };
      })
      .filter(Boolean)
      .slice(0, 30);
  });
}

async function dumpSearchTextNodes(page: PageLike): Promise<unknown[]> {
  return page.evaluate(() => {
    const clean = (v: unknown) =>
      String(v || "")
        .replace(/\s+/g, " ")
        .trim();
    const root = document.querySelector("main");
    if (!root) return [];
    return Array.from(root.querySelectorAll("*"))
      .map((el) => {
        const text = clean((el as HTMLElement).textContent).slice(0, 120);
        if (!/pesq|busc/i.test(text)) return null;
        if (text.length > 120) return null;
        return {
          tag: el.tagName,
          text,
          classes:
            typeof (el as HTMLElement).className === "string"
              ? String((el as HTMLElement).className).slice(0, 120)
              : "",
        };
      })
      .filter(Boolean)
      .slice(0, 30);
  });
}

async function captureSearchDiagnostics(page: PageLike): Promise<void> {
  const actions = await dumpVisibleActions(page).catch(() => []);
  const texts = await dumpSearchTextNodes(page).catch(() => []);
  console.warn(
    "[Leads PJ] SEARCH_ACTION_DUMP",
    JSON.stringify({ actions, texts, at: new Date().toISOString() }),
  );
}

async function probeSearchState(page: PageLike): Promise<SearchProbe> {
  const topCandidates = await findSearchButtonCandidates(page);
  const winner = topCandidates[0] || null;
  const rest = await page.evaluate(() => {
    const clean = (v: unknown) =>
      String(v || "")
        .replace(/\s+/g, " ")
        .trim();
    const pagination = document.querySelector('nav[data-oruga="pagination"]');
    const current = pagination?.querySelector(
      ['[aria-current="page"]', ".pagination-link.is-current", '[aria-current="true"]'].join(","),
    );
    const contentNodes = Array.from(
      document.querySelectorAll(
        "main a, main p, main span, main div, main li, main h1, main h2, main h3",
      ),
    ).slice(0, 1500);
    const cnpjRe = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/;
    let cnpjNodes = 0;
    const totalCandidates: string[] = [];
    for (const el of contentNodes) {
      const text = clean(el.textContent);
      if (!text || text.length > 200) continue;
      if (cnpjRe.test(text)) cnpjNodes += 1;
      if (/\b\d[\d.]*\s+(empresas?|resultados?)\b/i.test(text)) totalCandidates.push(text);
    }
    const loadingNodes = document.querySelectorAll(
      [
        '[aria-busy="true"]',
        ".loading",
        ".is-loading",
        ".loader",
        ".spinner",
        '[class*="loading"]',
        '[class*="spinner"]',
      ].join(","),
    ).length;
    const iframes = Array.from(document.querySelectorAll("iframe"));
    return {
      url: location.href,
      readyState: document.readyState,
      pagination: Boolean(pagination),
      currentPage: Number(clean(current?.textContent)) || null,
      cnpjNodes,
      totalCandidates: totalCandidates.slice(0, 5),
      loadingNodes,
      dialogs: document.querySelectorAll('[role="dialog"], .modal, .o-modal').length,
      iframeCount: iframes.length,
      iframeSrcs: iframes.map((f) => f.getAttribute("src") || "").slice(0, 10),
      challengeNodes: document.querySelectorAll(
        '[id*="challenge"], [class*="challenge"], iframe[src*="challenge"]',
      ).length,
    };
  });

  return {
    ...rest,
    searchButtonFound: Boolean(winner),
    searchButtonDisabled: false,
    searchButtonText: winner?.text || null,
    searchButtonCount: topCandidates.length,
    searchButtonCandidate: winner,
    topCandidates,
    buttonDebug: winner
      ? {
          tag: winner.tag,
          type: winner.type || null,
          classes: winner.classes,
          rect: winner.rect,
          html: `${winner.tag} ${winner.text} ${winner.aria}`.slice(0, 500),
          score: winner.score,
          source: winner.source,
        }
      : null,
  };
}

async function readSearchState(page: PageLike): Promise<SearchStateLite> {
  const probe = await probeSearchState(page);
  const sampleTotals = probe.totalCandidates.join(" ");
  const totalMatch = sampleTotals.match(/([\d.]+)\s+(empresas?|resultados?)/i);
  let totalHint: number | null = null;
  if (totalMatch) {
    const n = Number(String(totalMatch[1]).replace(/\./g, "").replace(/\s/g, ""));
    if (Number.isFinite(n)) totalHint = n;
  }
  const emptyHint =
    probe.cnpjNodes === 0 &&
    !probe.pagination &&
    /nenhum resultado|0\s+empresas|não\s+encontr|nao\s+encontr/i.test(sampleTotals);
  const blocked =
    probe.challengeNodes > 0 ||
    /cloudflare|just a moment|verificação de segurança|checking your browser|um momento/i.test(
      `${probe.url} ${probe.searchButtonText || ""}`,
    );
  return {
    hasPagination: probe.pagination,
    currentPage: probe.currentPage,
    searching: probe.loadingNodes > 0 || probe.searchButtonDisabled,
    hasCnpj: probe.cnpjNodes > 0,
    cnpjNodes: probe.cnpjNodes,
    totalHint,
    emptyHint,
    blocked,
    loadingNodes: probe.loadingNodes,
  };
}

async function withNodeTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), Math.max(50, timeoutMs));
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Probe leve só para ACK pós-clique — sem reescanear todos os CTAs. */
async function probeSearchAckLite(page: PageLike): Promise<{
  url: string;
  pagination: boolean;
  loadingNodes: number;
  cnpjNodes: number;
  dialogs: number;
  searchButtonDisabled: boolean;
} | null> {
  return page
    .evaluate(() => {
      const pagination = Boolean(document.querySelector('nav[data-oruga="pagination"]'));
      const loadingNodes = document.querySelectorAll(
        [
          '[aria-busy="true"]',
          ".loading",
          ".is-loading",
          ".loader",
          ".spinner",
          '[class*="loading"]',
          '[class*="spinner"]',
        ].join(","),
      ).length;
      const root = (document.querySelector("main") as HTMLElement | null) || document.body;
      const nodes = Array.from(root.querySelectorAll("span, a, p, li, div")).slice(0, 500);
      const cnpjRe = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/;
      let cnpjNodes = 0;
      for (const el of nodes) {
        const t = String(el.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        if (t.length < 14 || t.length > 100) continue;
        if (cnpjRe.test(t)) {
          cnpjNodes += 1;
          if (cnpjNodes >= 5) break;
        }
      }
      const buttons = Array.from(
        document.querySelectorAll('button, [role="button"], input[type="submit"]'),
      ) as HTMLElement[];
      const searchBtn = buttons.find((el) => {
        const text = String(
          el instanceof HTMLInputElement ? el.value : el.textContent || "",
        )
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
        const aria = String(el.getAttribute("aria-label") || "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
        return (
          text.includes("pesquisar") ||
          text.includes("buscar") ||
          aria.includes("pesquisar") ||
          aria.includes("buscar")
        );
      });
      return {
        url: location.href,
        pagination,
        loadingNodes,
        cnpjNodes,
        dialogs: document.querySelectorAll('[role="dialog"], .modal, .o-modal').length,
        searchButtonDisabled: searchBtn
          ? Boolean((searchBtn as HTMLButtonElement).disabled) ||
            searchBtn.getAttribute("aria-disabled") === "true"
          : false,
      };
    })
    .catch(() => null);
}

/**
 * ACK com deadline do Node. Nunca usa page.waitForTimeout no loop —
 * se o evaluate travar, o tick falha e o deadline geral encerra em timeoutMs.
 */
async function waitForSearchAck(
  page: PageLike,
  before: SearchProbe,
  timeoutMs = 5000,
): Promise<SearchProbe | null> {
  const deadline = Date.now() + Math.max(1000, timeoutMs);
  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    // Sleep no Node (não ocupa fila CDP).
    await new Promise<void>((r) => setTimeout(r, 350));
    const tickBudget = Math.min(1200, Math.max(200, deadline - Date.now()));
    const after = await withNodeTimeout(probeSearchAckLite(page), tickBudget, null);
    if (!after) continue;
    const changed =
      after.url !== before.url ||
      after.searchButtonDisabled !== before.searchButtonDisabled ||
      after.loadingNodes > before.loadingNodes ||
      after.pagination ||
      after.cnpjNodes > before.cnpjNodes ||
      after.dialogs !== before.dialogs;
    if (!changed) continue;

    // Tenta probe completo com teto Node; se travar, sintetiza ACK a partir do lite.
    const full = await withNodeTimeout(probeSearchState(page), 2000, null as SearchProbe | null);
    if (full) return full;
    return {
      ...before,
      url: after.url,
      pagination: after.pagination || before.pagination,
      loadingNodes: after.loadingNodes,
      cnpjNodes: Math.max(before.cnpjNodes, after.cnpjNodes),
      dialogs: after.dialogs,
      searchButtonDisabled: after.searchButtonDisabled,
    };
  }
  return null;
}

type PlaywrightSearchPage = PageLike & {
  mouse?: { click: (x: number, y: number) => Promise<void> };
  keyboard: { press: (k: string) => Promise<void> };
};

async function clickSearchByMouse(
  page: PlaywrightSearchPage,
  candidate: SearchButtonCandidate,
): Promise<boolean> {
  if (!page.mouse?.click) return false;
  const { x, y, width, height } = candidate.rect;
  return withNodeTimeout(
    page.mouse.click(x + width / 2, y + height / 2).then(() => true),
    3000,
    false,
  );
}

async function clickSearchDom(page: PageLike): Promise<boolean> {
  const candidates = await findSearchButtonCandidates(page);
  if (!candidates[0]) return false;
  // Reusa a mesma regra de scoring e clica o vencedor via DOM nativo.
  return page.evaluate(() => {
    const clean = (v: unknown) =>
      String(v || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    const selector = [
      "button",
      "a",
      '[role="button"]',
      'input[type="submit"]',
      'input[type="button"]',
      '[type="submit"]',
      "[tabindex]",
      '[class*="button"]',
      '[class*="btn"]',
    ].join(",");
    const scored = Array.from(document.querySelectorAll(selector))
      .map((raw) => {
        const el = raw as HTMLElement;
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        if (
          r.width < 20 ||
          r.height < 15 ||
          s.display === "none" ||
          s.visibility === "hidden"
        ) {
          return null;
        }
        const text = clean(el instanceof HTMLInputElement ? el.value : el.textContent);
        const aria = clean(el.getAttribute("aria-label"));
        const title = clean(el.getAttribute("title"));
        const combined = `${text} ${aria} ${title}`;
        if (!combined.includes("pesquisar") && !combined.includes("buscar")) return null;
        let score = 0;
        if (text === "pesquisar" || text === "buscar") score += 100;
        if (text.includes("pesquisar")) score += 70;
        if (aria.includes("pesquisar") || aria.includes("buscar")) score += 60;
        if (el.tagName === "BUTTON") score += 30;
        if (el.getAttribute("type") === "submit") score += 25;
        score += Math.min(30, Math.round((r.width * r.height) / 1000));
        return { el, score };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.score - a.score);
    const winner = scored[0]?.el as HTMLElement | undefined;
    if (!winner) return false;
    winner.click();
    return true;
  });
}

async function focusSearchButton(page: PageLike): Promise<boolean> {
  const candidates = await findSearchButtonCandidates(page);
  if (!candidates[0]) return false;
  return page.evaluate(() => {
    const clean = (v: unknown) =>
      String(v || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    const selector = [
      "button",
      "a",
      '[role="button"]',
      'input[type="submit"]',
      'input[type="button"]',
      "[tabindex]",
      '[class*="button"]',
      '[class*="btn"]',
    ].join(",");
    const el = Array.from(document.querySelectorAll(selector)).find((raw) => {
      const node = raw as HTMLElement;
      const text = clean(node instanceof HTMLInputElement ? node.value : node.textContent);
      const aria = clean(node.getAttribute("aria-label"));
      const title = clean(node.getAttribute("title"));
      const combined = `${text} ${aria} ${title}`;
      return combined.includes("pesquisar") || combined.includes("buscar");
    }) as HTMLElement | undefined;
    if (!el) return false;
    el.focus();
    return true;
  });
}

/**
 * DISPATCH → ACK (5s) → fallbacks. Não espera resultados aqui.
 */
async function dispatchSearchWithAck(
  page: PlaywrightSearchPage,
  onProgress?: CasaDosDadosProgress,
): Promise<{ method: "mouse" | "dom" | "enter"; ack: SearchProbe }> {
  const before = await withNodeTimeout(
    probeSearchState(page),
    8000,
    null as SearchProbe | null,
  );
  if (!before) {
    throw new LeadsScrapeError(
      "SEARCH_BUTTON_NOT_FOUND",
      "same-page",
      "Probe pré-clique não respondeu em 8s (CDP/DOM travado).",
    );
  }
  console.log(
    JSON.stringify({
      event: "SEARCH_PROBE",
      when: "before",
      probe: formatProbeShort(before),
      top: before.topCandidates.slice(0, 5),
      buttonDebug: before.buttonDebug,
      iframeSrcs: before.iframeSrcs,
    }),
  );

  if (!before.searchButtonFound || !before.searchButtonCandidate) {
    onProgress?.("SEARCH: botão Pesquisar não localizado — diagnóstico capturado");
    await withNodeTimeout(captureSearchDiagnostics(page), 5000, undefined);
    throw new LeadsScrapeError(
      "SEARCH_BUTTON_NOT_FOUND",
      "same-page",
      `CTA de pesquisa não encontrado no DOM. ${formatProbeShort(before)}`,
    );
  }

  const winner = before.searchButtonCandidate;
  onProgress?.(
    `SEARCH: snapshot — btn=true/${before.searchButtonCount} · #1 ${winner.tag} text="${winner.text.slice(0, 48)}" score=${winner.score}`,
  );

  onProgress?.("SEARCH: acionando Pesquisar via mouse…");
  if (await clickSearchByMouse(page, winner)) {
    onProgress?.("SEARCH: aguardando ACK (mouse) — até 5s (Node)…");
    const ack = await waitForSearchAck(page, before, 5000);
    if (ack) {
      console.log(JSON.stringify({ event: "SEARCH_ACK", method: "mouse", probe: formatProbeShort(ack) }));
      onProgress?.(`SEARCH: ACK recebido via mouse — ${formatProbeShort(ack)}`);
      return { method: "mouse", ack };
    }
    onProgress?.("SEARCH: mouse sem ACK após 5s");
  } else {
    onProgress?.("SEARCH: mouse indisponível / timeout");
  }

  onProgress?.("SEARCH: tentando clique DOM…");
  const domOk = await withNodeTimeout(clickSearchDom(page), 4000, false);
  if (domOk) {
    onProgress?.("SEARCH: aguardando ACK (DOM) — até 5s (Node)…");
    const ack = await waitForSearchAck(page, before, 5000);
    if (ack) {
      console.log(JSON.stringify({ event: "SEARCH_ACK", method: "dom", probe: formatProbeShort(ack) }));
      onProgress?.(`SEARCH: ACK recebido via DOM — ${formatProbeShort(ack)}`);
      return { method: "dom", ack };
    }
    onProgress?.("SEARCH: clique DOM sem ACK após 5s");
  }

  onProgress?.("SEARCH: tentando Enter…");
  await withNodeTimeout(focusSearchButton(page), 2000, false);
  await withNodeTimeout(
    page.keyboard.press("Enter").then(() => undefined),
    1500,
    undefined,
  );
  onProgress?.("SEARCH: aguardando ACK (Enter) — até 5s (Node)…");
  const ackEnter = await waitForSearchAck(page, before, 5000);
  if (ackEnter) {
    console.log(JSON.stringify({ event: "SEARCH_ACK", method: "enter", probe: formatProbeShort(ackEnter) }));
    onProgress?.(`SEARCH: ACK recebido via Enter — ${formatProbeShort(ackEnter)}`);
    return { method: "enter", ack: ackEnter };
  }

  const last =
    (await withNodeTimeout(probeSearchState(page), 3000, null as SearchProbe | null)) || before;
  console.log(
    JSON.stringify({
      event: "SEARCH_DISPATCH_FAILED",
      before: formatProbeShort(before),
      last: formatProbeShort(last),
      buttonDebug: last.buttonDebug,
    }),
  );
  throw new LeadsScrapeError(
    "SEARCH_DISPATCH_FAILED",
    "same-page",
    `CTA encontrado mas nenhuma estratégia mudou o estado. before=${formatProbeShort(before)} after=${formatProbeShort(last)}`,
  );
}

async function waitForSearchTransition(
  page: PageLike,
  timeoutMs: number,
  onProgress?: CasaDosDadosProgress,
  shouldAbort?: () => boolean,
): Promise<SearchTransition> {
  const started = Date.now();
  const deadline = started + Math.max(5_000, timeoutMs);
  let lastPulse = 0;
  let lastProbe: SearchProbe | undefined;

  while (Date.now() < deadline) {
    if (shouldAbort?.()) throw new Error("__MLC_JOB_ABORTED__");

    const alive = await rendererProbe(page, 2000);
    if (!alive) return { kind: "renderer-unresponsive" };

    // Probe leve + teto Node — evita probeSearchState completo a cada tick.
    const lite = await withNodeTimeout(probeSearchAckLite(page), 1500, null);
    if (lite) {
      if (lite.pagination || lite.cnpjNodes > 0) {
        onProgress?.(
          `SEARCH: resultados detectados — CNPJs=${lite.cnpjNodes}, paginação=${lite.pagination}`,
        );
        return { kind: "results", total: null };
      }
      lastProbe = {
        ...(lastProbe || {
          url: lite.url,
          readyState: "unknown",
          searchButtonFound: false,
          searchButtonDisabled: lite.searchButtonDisabled,
          searchButtonText: null,
          searchButtonCount: 0,
          searchButtonCandidate: null,
          topCandidates: [],
          pagination: lite.pagination,
          currentPage: null,
          cnpjNodes: lite.cnpjNodes,
          totalCandidates: [],
          loadingNodes: lite.loadingNodes,
          dialogs: lite.dialogs,
          iframeCount: 0,
          iframeSrcs: [],
          challengeNodes: 0,
          buttonDebug: null,
        }),
        url: lite.url,
        pagination: lite.pagination,
        cnpjNodes: lite.cnpjNodes,
        loadingNodes: lite.loadingNodes,
        dialogs: lite.dialogs,
        searchButtonDisabled: lite.searchButtonDisabled,
      };
    }

    const elapsed = Math.round((Date.now() - started) / 1000);
    const budget = Math.round(timeoutMs / 1000);
    if (elapsed - lastPulse >= 5) {
      lastPulse = elapsed;
      const loading = (lite?.loadingNodes || 0) > 0;
      onProgress?.(
        loading
          ? `SEARCH: portal ainda processando — ${elapsed}s/${budget}s`
          : `SEARCH: aguardando resultados — ${elapsed}s/${budget}s`,
      );
    }
    // Sleep Node — não page.waitForTimeout.
    await new Promise<void>((r) => setTimeout(r, 500));
  }

  const alive = await rendererProbe(page, 2000);
  if (!alive) return { kind: "renderer-unresponsive" };

  const finalLite = await withNodeTimeout(probeSearchAckLite(page), 2000, null);
  if (finalLite && (finalLite.pagination || finalLite.cnpjNodes > 0)) {
    return { kind: "results", total: null };
  }
  if (finalLite && finalLite.loadingNodes > 0) {
    const graceDeadline = Date.now() + 30_000;
    while (Date.now() < graceDeadline) {
      if (shouldAbort?.()) throw new Error("__MLC_JOB_ABORTED__");
      if (!(await rendererProbe(page, 2000))) return { kind: "renderer-unresponsive" };
      const st = await withNodeTimeout(probeSearchAckLite(page), 1500, null);
      if (st && (st.pagination || st.cnpjNodes > 0)) return { kind: "results", total: null };
      if (st && st.loadingNodes === 0) break;
      const g = Math.round((Date.now() - started) / 1000);
      onProgress?.(`SEARCH: grace loading — ${g}s`);
      await new Promise<void>((r) => setTimeout(r, 500));
    }
  }
  return { kind: "timeout-responsive", probe: lastProbe };
}

/** @deprecated use waitForSearchTransition — mantido para next-page short waits */
async function waitForPortalSearchResults(
  page: PageLike,
  timeoutMs = 12_000,
  onProgress?: CasaDosDadosProgress,
): Promise<void> {
  const result = await waitForSearchTransition(page, timeoutMs, onProgress);
  if (result.kind === "renderer-unresponsive") {
    throw new RendererUnresponsiveError("waitForPortalSearchResults");
  }
}

async function fillByLabel(page: PageLike, labels: string[], value: string) {
  if (!value) return;
  for (const label of labels) {
    const input = page
      .locator(
        `xpath=//label[contains(${xpathLower()}, '${label.toLowerCase()}')]/following::input[1]`,
      )
      .first();
    if ((await input.count()) > 0) {
      try {
        await input.click({ timeout: 4000 });
        await input.fill(value);
      } catch (error) {
        if (isChromiumTargetCrash(error)) throw error;
        await page
          .evaluate(
            ({ needle, val }: { needle: string; val: string }) => {
              const labs = Array.from(document.querySelectorAll("label"));
              const lab = labs.find((el) =>
                (el.textContent || "").toLowerCase().includes(needle),
              );
              const el = lab
                ? (lab.parentElement?.querySelector("input") as HTMLInputElement | null) ||
                  (lab.nextElementSibling as HTMLInputElement | null)
                : null;
              const inputEl =
                el && el.tagName === "INPUT"
                  ? el
                  : (document.querySelector(
                      `input[placeholder*="${needle}" i]`,
                    ) as HTMLInputElement | null);
              if (!inputEl) return false;
              inputEl.focus();
              const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
              proto?.set?.call(inputEl, val);
              inputEl.dispatchEvent(new Event("input", { bubbles: true }));
              inputEl.dispatchEvent(new Event("change", { bubbles: true }));
              return true;
            },
            { needle: label.toLowerCase(), val: value },
          )
          .catch(() => false);
      }
      return;
    }
  }
  const placeholder = page
    .locator(
      labels.map((label) => `input[placeholder*="${label}" i], input[name*="${label}" i]`).join(", "),
    )
    .first();
  if ((await placeholder.count()) > 0) {
    try {
      await placeholder.fill(value);
    } catch (error) {
      if (isChromiumTargetCrash(error)) throw error;
    }
  }
}

/**
 * CNAE no portal = modal multi-select OU autocomplete inline (UI muda com frequência).
 * Estratégias:
 * 1) Abrir modal/dropdown de Atividade Principal
 * 2) Digitar no input de busca (search no modal, ou text na página)
 * 3) Marcar checkbox/linha do código
 * 4) Fechar modal se existir (Fechar/Concluir/Aplicar)
 */
async function findCnaeSearchInput(page: PageLike, timeoutMs = 10000) {
  const candidates = [
    'input[type="search"][placeholder*="Código ou nome da atividade" i]',
    'input[type="search"][placeholder*="Codigo ou nome da atividade" i]',
    'input[type="search"][placeholder*="codigo ou nome da atividade" i]',
    'input[type="search"][placeholder*="atividade" i]',
    'input[type="search"][placeholder*="CNAE" i]',
    'input.input.is-info[placeholder*="atividade" i]',
    '[role="dialog"] input[type="search"]',
    '[role="dialog"] input[placeholder*="atividade" i]',
    '.modal input[type="search"]',
    '.modal-card input[type="search"]',
    '.o-modal input[type="search"]',
    '.dropdown-menu input[type="search"]',
    'xpath=//*[contains(., "selecionados") or contains(., "Fechar")]//input[@type="search"]',
    'xpath=//*[contains(@class,"modal") or contains(@class,"dialog") or @role="dialog"]//input[contains(@placeholder,"atividade") or @type="search"]',
    // Evitar input[type=text] da página (Oruga): fill força → "Target crashed" no Chromium Docker/Xvfb.
  ];
  const deadline = Date.now() + Math.max(1000, timeoutMs);
  while (Date.now() < deadline) {
    for (const sel of candidates) {
      const loc = page.locator(sel).last();
      if ((await loc.count()) === 0) continue;
      if (!(await loc.isVisible().catch(() => false))) continue;
      return loc;
    }
    await page.waitForTimeout(250);
  }
  for (const sel of candidates) {
    const loc = page.locator(sel).last();
    if ((await loc.count()) > 0) return loc;
  }
  return null;
}

async function tryOpenCnaePicker(page: PageLike) {
  const openTriggers = [
    'xpath=//label[contains(normalize-space(.), "Atividade Principal (CNAE)")]/following::*[self::input or self::button or self::div][1]',
    'xpath=//label[contains(., "Atividade Principal")]/following::input[1]',
    'xpath=//label[contains(., "Atividade Principal")]/following::button[1]',
    'xpath=//label[contains(., "Atividade Principal")]/following::div[contains(@class,"control") or contains(@class,"dropdown") or contains(@class,"autocomplete") or contains(@class,"select") or contains(@class,"taginput")][1]',
    'xpath=//*[contains(normalize-space(.), "Atividade Principal (CNAE)")]/following::input[1]',
    'label:has-text("Atividade Principal (CNAE)")',
    'label:has-text("Atividade principal (CNAE)")',
    'text=/Atividade Principal\\s*\\(CNAE\\)/i',
    'text=/Atividade principal\\s*\\(CNAE\\)/i',
    'input[placeholder*="Código ou nome da atividade" i]',
    'input[placeholder*="Codigo ou nome da atividade" i]',
    'input[placeholder*="atividade" i]',
  ];
  for (const sel of openTriggers) {
    const el = page.locator(sel).first();
    if ((await el.count()) === 0) continue;
    if (!(await el.isVisible().catch(() => false))) continue;
    await el.scrollIntoViewIfNeeded().catch(() => undefined);
    await el.click({ timeout: 8000, force: true }).catch(() => undefined);
    await page.waitForTimeout(500);
    const search = await findCnaeSearchInput(page, 2500);
    if (search) return true;
  }
  return false;
}

async function markCnaeOption(page: PageLike, code: string): Promise<boolean> {
  const rowById = page.locator(`input[type="checkbox"][id*="${code}"]`).first();
  const rowByLabel = page
    .locator(
      `xpath=//label[contains(normalize-space(.), '${code}')]//input[@type='checkbox'] | //li[contains(normalize-space(.), '${code}')]//input[@type='checkbox'] | //div[contains(@class,'checkbox') or contains(@class,'control')][contains(normalize-space(.), '${code}')]//input[@type='checkbox']`,
    )
    .first();

  for (const box of [rowById, rowByLabel]) {
    if ((await box.count()) === 0) continue;
    await box.scrollIntoViewIfNeeded().catch(() => undefined);
    const checked = await box.isChecked().catch(() => false);
    if (!checked) {
      await box.check({ force: true }).catch(async () => {
        await box.click({ force: true });
      });
    }
    return true;
  }

  const line = page.locator(`text=/^\\s*${code}\\b/`).first();
  if ((await line.count()) > 0) {
    await line.click({ timeout: 5000, force: true }).catch(() => undefined);
    return true;
  }

  const option = page
    .locator(
      `xpath=//*[self::li or self::div or self::button or self::a][contains(normalize-space(.), '${code}')][1]`,
    )
    .first();
  if ((await option.count()) > 0 && (await option.isVisible().catch(() => false))) {
    await option.click({ force: true }).catch(() => undefined);
    return true;
  }
  return false;
}

async function readCnaeSelectedCount(page: PageLike): Promise<number | null> {
  return page.evaluate(() => {
    const text = String(document.body?.innerText || "");
    const m = text.match(/(\d+)\s+selecionados?/i);
    return m ? Number(m[1]) : null;
  });
}

/**
 * CNAE via DOM nativo (Xvfb). Fases curtas + abortável — não fica minutos em
 * "selecionando CNAE…" sem avançar.
 */
async function selectAtividadePrincipalCnae(
  page: PageLike,
  rawCode: string,
  onProgress?: CasaDosDadosProgress,
  shouldAbort?: () => boolean,
) {
  const code = String(rawCode || "").replace(/\D/g, "");
  if (!code) return;
  const report = (phase: string) => {
    onProgress?.(`Pesquisando: CNAE ${code} — ${phase}`);
  };
  const aborted = () => Boolean(shouldAbort?.());

  await dismissBlockingPortalOverlays(page).catch(() => undefined);
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      /^Fechar$/i.test(String(b.textContent || "").trim()),
    ) as HTMLButtonElement | undefined;
    btn?.click();
  });
  await page.waitForTimeout(200);
  if (aborted()) throw new Error(`CNAE ${code}: abortado.`);

  report("abrindo modal…");
  await page.evaluate(() => {
    const visible = (el: Element) => {
      const h = el as HTMLElement;
      const s = window.getComputedStyle(h);
      return (
        s.display !== "none" &&
        s.visibility !== "hidden" &&
        (h.offsetParent !== null || s.position === "fixed")
      );
    };
    const labels = Array.from(document.querySelectorAll("label")).filter((el) => {
      const t = String(el.textContent || "").replace(/\s+/g, " ").trim();
      return t.length > 0 && t.length < 80 && /Atividade\s+Principal\s*\(CNAE\)/i.test(t);
    }) as HTMLLabelElement[];
    labels.find(visible)?.click();
    const textOpeners = Array.from(document.querySelectorAll("input")).filter((el) => {
      const i = el as HTMLInputElement;
      const ph = String(i.placeholder || "").toLowerCase();
      return visible(i) && i.type === "text" && /c[oó]digo ou nome da atividade|atividade/.test(ph);
    }) as HTMLInputElement[];
    textOpeners[0]?.click();
  });

  report("aguardando campo de busca…");
  let searchReady = false;
  for (let poll = 0; poll < 20; poll += 1) {
    if (aborted()) throw new Error(`CNAE ${code}: abortado.`);
    searchReady = await page.evaluate(() => {
      const visible = (el: Element) => {
        const h = el as HTMLElement;
        const s = window.getComputedStyle(h);
        return s.display !== "none" && s.visibility !== "hidden";
      };
      return (Array.from(document.querySelectorAll("input")) as HTMLInputElement[]).some((el) => {
        const ph = String(el.placeholder || "").toLowerCase();
        const inModal = Boolean(
          el.closest('[role="dialog"], .modal, .o-modal, .modal-card, .modal-content'),
        );
        return (
          visible(el) &&
          (el.type === "search" || /atividade|cnae|c[oó]digo/.test(ph)) &&
          (inModal || el.type === "search")
        );
      });
    });
    if (searchReady) break;
    // Re-clique leve a cada ~1s se o modal não abriu.
    if (poll > 0 && poll % 3 === 0) {
      await page.evaluate(() => {
        const lab = Array.from(document.querySelectorAll("label")).find((el) => {
          const t = String(el.textContent || "").replace(/\s+/g, " ").trim();
          return t.length > 0 && t.length < 80 && /Atividade\s+Principal\s*\(CNAE\)/i.test(t);
        }) as HTMLLabelElement | undefined;
        lab?.click();
      });
    }
    await page.waitForTimeout(300);
  }
  if (!searchReady) {
    throw new Error(`CNAE ${code}: modal de busca não abriu (search ausente).`);
  }

  report("digitando código…");
  const typed = await page.evaluate((cnae: string) => {
    const visible = (el: Element) => {
      const h = el as HTMLElement;
      const s = window.getComputedStyle(h);
      return s.display !== "none" && s.visibility !== "hidden";
    };
    const inputs = Array.from(document.querySelectorAll("input")) as HTMLInputElement[];
    const score = (el: HTMLInputElement) => {
      const ph = String(el.placeholder || "").toLowerCase();
      let s = 0;
      if (el.type === "search") s += 8;
      if (/atividade|cnae|c[oó]digo/.test(ph)) s += 5;
      if (el.closest('[role="dialog"], .modal, .o-modal, .modal-card, .modal-content')) s += 10;
      if (!visible(el)) s -= 20;
      if (el.type === "text" && !el.closest('[role="dialog"], .modal, .o-modal, .modal-card')) s -= 6;
      return s;
    };
    const ranked = inputs
      .map((el) => ({ el, s: score(el) }))
      .filter((x) => x.s >= 8)
      .sort((a, b) => b.s - a.s);
    const target = ranked[0]?.el;
    if (!target) return { ok: false as const };
    target.focus();
    const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    proto?.set?.call(target, "");
    target.dispatchEvent(new Event("input", { bubbles: true }));
    proto?.set?.call(target, cnae);
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
    target.dispatchEvent(
      new KeyboardEvent("keyup", { bubbles: true, key: cnae.slice(-1) || "0" }),
    );
    return { ok: true as const, value: String(target.value || "") };
  }, code);
  if (!typed?.ok || !String(typed.value || "").includes(code)) {
    throw new Error(`CNAE ${code}: não digitou no campo de busca.`);
  }

  report("marcando checkbox…");
  let marked = false;
  for (let poll = 0; poll < 25; poll += 1) {
    if (aborted()) throw new Error(`CNAE ${code}: abortado.`);
    marked = await page.evaluate((cnae: string) => {
      const boxes = Array.from(
        document.querySelectorAll('input[type="checkbox"]'),
      ) as HTMLInputElement[];
      const box = boxes.find(
        (b) =>
          String(b.id || "").startsWith(cnae) ||
          String(b.id || "").includes(`${cnae} `) ||
          String(b.id || "").includes(`${cnae}-`) ||
          String(b.closest("label")?.textContent || "").includes(cnae),
      );
      if (!box) return false;
      if (!box.checked) {
        box.click();
        if (!box.checked) {
          box.checked = true;
          box.dispatchEvent(new Event("change", { bubbles: true }));
          box.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
      return Boolean(box.checked);
    }, code);
    if (marked) break;
    await page.waitForTimeout(250);
  }
  if (!marked) {
    throw new Error(`CNAE ${code}: checkbox da atividade não apareceu após filtrar.`);
  }

  report("fechando modal…");
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      /^(Fechar|Concluir|Aplicar|OK)$/i.test(String(b.textContent || "").trim()),
    ) as HTMLButtonElement | undefined;
    btn?.click();
  });
  await page.waitForTimeout(300);
  onProgress?.(`Pesquisando: CNAE ${code} selecionado.`);
}

/**
 * Retorna true se selecionou. false = não trava a extração (demais filtros seguem).
 * Budget total curto no Xvfb (default ~50s em 2 tentativas).
 */
async function selectAtividadePrincipalCnaeWithTimeout(
  page: PageLike,
  rawCode: string,
  onProgress?: CasaDosDadosProgress,
  timeoutMs = 25000,
): Promise<boolean> {
  const code = String(rawCode || "").replace(/\D/g, "");
  if (!code) return true;
  const attempts = Math.max(
    1,
    Math.min(3, Math.round(Number(process.env.CASADOSDADOS_CNAE_RETRIES || 2) || 2)),
  );
  const perAttemptMs = Math.max(
    12000,
    Math.min(35000, Math.round(Number(timeoutMs) || 25000)),
  );
  let lastErr: Error | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let beat: ReturnType<typeof setInterval> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let aborted = false;
    const started = Date.now();
    beat = setInterval(() => {
      const sec = Math.round((Date.now() - started) / 1000);
      onProgress?.(
        `Pesquisando: selecionando CNAE ${code}… tentativa ${attempt}/${attempts} (${sec}s)`,
      );
    }, 3000);
    try {
      await Promise.race([
        selectAtividadePrincipalCnae(page, code, onProgress, () => aborted),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            aborted = true;
            reject(
              new Error(
                `CNAE ${code}: timeout ${Math.round(perAttemptMs / 1000)}s ao selecionar no portal.`,
              ),
            );
          }, perAttemptMs);
        }),
      ]);
      return true;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      onProgress?.(
        `Pesquisando: CNAE ${code} falhou (tentativa ${attempt}/${attempts}) — ${lastErr.message.slice(0, 100)}`,
      );
      await dismissBlockingPortalOverlays(page).catch(() => undefined);
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find((b) =>
          /^Fechar$/i.test(String(b.textContent || "").trim()),
        ) as HTMLButtonElement | undefined;
        btn?.click();
      });
      await page.waitForTimeout(400 + attempt * 200);
    } finally {
      aborted = true;
      if (beat) clearInterval(beat);
      if (timer) clearTimeout(timer);
    }
  }

  onProgress?.(
    `Pesquisando: CNAE ${code} não concluído (${lastErr?.message?.slice(0, 80) || "falha"}) — seguindo sem travar…`,
  );
  return false;
}

async function setCheckboxByLabel(page: PageLike, label: string, checked: boolean) {
  const needle = label.toLowerCase();
  // Só checkbox DENTRO do label — never preceding/following (pega opção de autocomplete CNAE).
  // Timeout curto: xpath no Xvfb não pode segurar a sessão 45s.
  const box = page
    .locator(`xpath=//label[contains(${xpathLower()}, '${needle}')]//input[@type='checkbox']`)
    .first();
  const n = await box.count().catch(() => 0);
  if (!n) return;
  const visible = await box.isVisible().catch(() => false);
  if (!visible) return;
  const isChecked = await box.isChecked().catch(() => false);
  if (checked && !isChecked) {
    await box.check({ force: true } as { force?: boolean }).catch(() => undefined);
  }
  if (!checked && isChecked) {
    await box.uncheck().catch(() => undefined);
  }
}

/**
 * Switches Oruga/Buefy: input[type=checkbox][role=switch] vem ANTES do label
 * (não dentro). Clique no .switch / label / input — evidência etapa 4b.
 * Sem fallback Playwright lento: se o evaluate não achar, segue (filtro opcional).
 */
async function setToggleByLabel(page: PageLike, label: string, enabled: boolean) {
  if (!enabled) return;
  const needle = label.toLowerCase().replace(/"/g, "");
  await Promise.race([
    page.evaluate(
      ({ needle, want }: { needle: string; want: boolean }) => {
        const labels = Array.from(document.querySelectorAll("label"));
        const lab = labels.find((el) => {
          const t = String(el.textContent || "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
          return t === needle || (t.includes(needle) && t.length < 90);
        });
        if (!lab) return false;
        const box =
          (lab.previousElementSibling &&
          (lab.previousElementSibling as HTMLInputElement).matches?.('input[type="checkbox"]')
            ? (lab.previousElementSibling as HTMLInputElement)
            : null) ||
          (lab.parentElement?.querySelector('input[type="checkbox"]') as HTMLInputElement | null) ||
          (lab.querySelector('input[type="checkbox"]') as HTMLInputElement | null);
        if (!box) return false;
        if (Boolean(box.checked) === want) return true;
        const control =
          (lab.closest(".switch") as HTMLElement | null) ||
          (lab.parentElement as HTMLElement | null);
        (control || lab).click();
        if (Boolean(box.checked) !== want) box.click();
        return true;
      },
      { needle, want: true },
    ),
    page.waitForTimeout(2500).then(() => false),
  ]).catch(() => false);
}

/** Liga vários switches numa única ida ao DOM — só labels ativos. */
async function enableTogglesFast(page: PageLike, labels: string[]) {
  const needles = labels
    .map((l) => String(l || "").toLowerCase().replace(/"/g, "").trim())
    .filter(Boolean);
  if (!needles.length) return;
  await Promise.race([
    page.evaluate((needlesIn: string[]) => {
      const labels = Array.from(document.querySelectorAll("label"));
      for (const needle of needlesIn) {
        const lab = labels.find((el) => {
          const t = String(el.textContent || "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
          return t === needle || (t.includes(needle) && t.length < 90);
        });
        if (!lab) continue;
        const box =
          (lab.previousElementSibling &&
          (lab.previousElementSibling as HTMLInputElement).matches?.('input[type="checkbox"]')
            ? (lab.previousElementSibling as HTMLInputElement)
            : null) ||
          (lab.parentElement?.querySelector('input[type="checkbox"]') as HTMLInputElement | null) ||
          (lab.querySelector('input[type="checkbox"]') as HTMLInputElement | null);
        if (!box) continue;
        if (box.checked) continue;
        const control =
          (lab.closest(".switch") as HTMLElement | null) ||
          (lab.parentElement as HTMLElement | null);
        (control || lab).click();
        if (!box.checked) {
          box.checked = true;
          box.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    }, needles),
    page.waitForTimeout(4000),
  ]).catch(() => undefined);
}

async function applyFilters(
  page: PageLike,
  filters: WabaLeadsCnpjFilters,
  onProgress?: CasaDosDadosProgress,
) {
  const step = (label: string) => {
    onProgress?.(`Pesquisando: ${label}`);
  };

  await dismissBlockingPortalOverlays(page);
  step("aplicando filtros (busca e situação)…");
  await fillByLabel(page, ["cnpj"], String(filters.cnpj || "").trim());
  await fillByLabel(page, ["busca textual"], String(filters.buscaTextual || "").trim());

  await setCheckboxByLabel(page, "razão social", filters.buscaEmRazaoSocial !== false);
  await setCheckboxByLabel(page, "nome fantasia", filters.buscaEmNomeFantasia !== false);
  await setCheckboxByLabel(page, "nome do sócio", filters.buscaEmNomeSocio !== false);

  if (filters.tipoPesquisa) {
    const select = page
      .locator(
        `xpath=//label[contains(., 'Tipo de Pesquisa')]/following::select[1] | //label[contains(., 'Tipo de Pesquisa')]/following::*[contains(@class,'select')][1]//input`,
      )
      .first();
    if ((await select.count().catch(() => 0)) > 0) {
      try {
        await select.selectOption(filters.tipoPesquisa);
      } catch {
        await select.fill(filters.tipoPesquisa).catch(() => undefined);
      }
    }
  }

  await fillByLabel(page, ["cnpj raiz", "somente os 8"], String(filters.cnpjRaiz || "").trim());

  const situacoes = Array.isArray(filters.situacaoCadastral) ? filters.situacaoCadastral : [];
  // Só liga as pedidas; não percorre uncheck de todas (xpath ×5 no Xvfb).
  for (const situacao of situacoes) {
    await setCheckboxByLabel(page, String(situacao).toLowerCase(), true);
  }

  const cnaeCode = String(filters.atividadePrincipalCnae || "").replace(/\D/g, "");
  step(
    cnaeCode
      ? `selecionando CNAE ${cnaeCode}…`
      : "aplicando filtros (CNAE, situação, celular)…",
  );
  if (cnaeCode) {
    await page.waitForTimeout(100 + Math.floor(Math.random() * 200));
  }
  const cnaeOk = await selectAtividadePrincipalCnaeWithTimeout(
    page,
    String(filters.atividadePrincipalCnae || "").trim(),
    onProgress,
    Math.max(
      20000,
      Math.min(
        35000,
        Math.round(Number(process.env.CASADOSDADOS_CNAE_TIMEOUT_MS || 25000) || 25000),
      ),
    ),
  );
  if (cnaeCode && !cnaeOk) {
    step(`CNAE ${cnaeCode} pulado após falha — demais filtros ativos seguem…`);
  } else if (cnaeCode && cnaeOk) {
    step(`CNAE ${cnaeCode} ok — aplicando só filtros ativos…`);
  }

  // Fecha residual do modal CNAE antes dos switches.
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      /^Fechar$/i.test(String(b.textContent || "").trim()),
    ) as HTMLButtonElement | undefined;
    btn?.click();
  });
  await page.waitForTimeout(150);

  // Apenas preenchimentos com valor (fillByLabel já no-op se vazio — mas evitamos step falso).
  const textJobs: Array<{ labels: string[]; value: string }> = [
    { labels: ["natureza jurídica", "código ou nome da natureza"], value: String(filters.naturezaJuridica || "").trim() },
    { labels: ["estado (uf)", "estado", "selecione o estado"], value: String(filters.estadoUf || "").trim() },
    { labels: ["município", "municipio", "selecione um município"], value: String(filters.municipio || "").trim() },
    { labels: ["bairro"], value: String(filters.bairro || "").trim() },
    { labels: ["cep"], value: String(filters.cep || "").trim() },
    { labels: ["ddd"], value: String(filters.ddd || "").trim() },
    { labels: ["telefone"], value: String(filters.telefone || "").trim() },
    { labels: ["data de abertura - a partir de", "a partir de"], value: String(filters.dataAberturaDe || "").trim() },
    { labels: ["data de abertura - até"], value: String(filters.dataAberturaAte || "").trim() },
    { labels: ["capital social - valor mínimo", "valor mínimo"], value: String(filters.capitalSocialMin || "").trim() },
    { labels: ["capital social - valor máximo", "valor máximo"], value: String(filters.capitalSocialMax || "").trim() },
    { labels: ["porte da empresa", "selecione o porte"], value: String(filters.porteEmpresa || "").trim() },
  ];
  const activeTexts = textJobs.filter((j) => j.value);
  if (activeTexts.length) {
    step(`preenchendo ${activeTexts.length} campo(s) de texto…`);
    for (const job of activeTexts) {
      await fillByLabel(page, job.labels, job.value);
    }
  }

  if (filters.empresasExcluidasMei) {
    await setToggleByLabel(page, "empresas excluídas do mei", true);
    await fillByLabel(page, ["excluídas do mei"], String(filters.excluidasMeiDe || "").trim());
  }
  if (filters.empresasExcluidasSimples) {
    await setToggleByLabel(page, "empresas excluídas do simples", true);
  }

  // Só switches true — false não toca o DOM.
  const activeSwitches: string[] = [];
  if (filters.incluirAtividadeSecundaria) activeSwitches.push("incluir atividade secundária");
  if (filters.somenteMei) activeSwitches.push("somente mei");
  if (filters.excluirMei) activeSwitches.push("excluir mei");
  if (filters.somenteMatriz) activeSwitches.push("somente matriz");
  if (filters.somenteFilial) activeSwitches.push("somente filial");
  if (filters.empresasDoSimples) activeSwitches.push("empresas do simples");
  if (filters.excluirEmpresasDoSimples) activeSwitches.push("excluir empresas do simples");
  if (filters.comContatoTelefone) activeSwitches.push("com contato de telefone");
  if (filters.somenteFixo) activeSwitches.push("somente fixo");
  if (filters.somenteCelular) activeSwitches.push("somente celular");
  if (filters.comEmail) activeSwitches.push("com e-mail");
  if (filters.excluirEmpresasVisualizadas) activeSwitches.push("excluir empresas visualizadas");
  if (filters.excluirEmailContab) {
    activeSwitches.push('excluir empresas que no e-mail contenham "contab"');
  }

  if (activeSwitches.length) {
    step(`ativando ${activeSwitches.length} switch(es): ${activeSwitches.slice(0, 3).join(", ")}${activeSwitches.length > 3 ? "…" : ""}`);
    await enableTogglesFast(page, activeSwitches);
  } else {
    step("sem switches extras — pronto para pesquisar…");
  }

  step("filtros aplicados — pronto para pesquisar…");
}

function parseResultTotalFromText(text: string): number | null {
  const patterns = [
    /pesquisa\s+retornou\s+([\d.\s]+)\s+empresas/i,
    /retornou\s+([\d.\s]+)\s+empresas/i,
    /([\d.]+)\s+empresas\s+encontradas/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const n = Number(String(m[1]).replace(/\./g, "").replace(/\s/g, ""));
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

/**
 * Headless Chromium puro é bloqueado pelo anti-bot do portal.
 * V02: janela visível (HEADLESS=0 ou default em v01/v02).
 * Produção Docker: Xvfb define DISPLAY → usamos headed virtual (igual V02).
 * Só força headless real com CASADOSDADOS_TRUE_HEADLESS=1 (diagnóstico).
 */
function resolveCasaDosDadosHeadless(): boolean {
  const trueHeadless = String(process.env.CASADOSDADOS_TRUE_HEADLESS ?? "")
    .trim()
    .toLowerCase();
  if (trueHeadless === "1" || trueHeadless === "true" || trueHeadless === "yes") {
    return true;
  }

  const hasDisplay = Boolean(String(process.env.DISPLAY || "").trim());
  if (hasDisplay) {
    // Com Xvfb (:99) ou monitor local — mesma condição do V02 que passa no portal.
    return false;
  }

  const raw = String(process.env.CASADOSDADOS_HEADLESS ?? "").trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "no") return false;
  const wabaEnv = String(process.env.WABA_ENV || "").trim().toLowerCase();
  return wabaEnv !== "v01" && wabaEnv !== "v02";
}

export async function scrapeCasaDosDadosLeads(
  filters: WabaLeadsCnpjFilters,
  onProgress?: CasaDosDadosProgress,
  options?: ScrapeCasaDosDadosOptions,
): Promise<ScrapeCasaDosDadosResult> {
  // Coleta somente via robô na tela do portal (sem API).
  // Opt-in raro: CASADOSDADOS_USE_API=1 + CASADOSDADOS_API_KEY
  if (String(process.env.CASADOSDADOS_USE_API || "").trim() === "1") {
    const { hasCasaDosDadosApiKey, fetchCasaDosDadosLeadsViaApi } = await import(
      "./waba-leads-cnpj-casadosdados-api.adapter"
    );
    if (hasCasaDosDadosApiKey()) {
      const leads = await fetchCasaDosDadosLeadsViaApi(filters, onProgress);
      return { leads, scrapeCompleted: true, doneReason: "api" };
    }
  }

  const maxAttempts = Math.max(
    1,
    Math.round(Number(process.env.CASADOSDADOS_SCRAPE_RETRIES || 8) || 8),
  );
  let resumeFrom = Math.max(1, Math.round(Number(options?.resumeFromPage || 1) || 1));
  let lastErr: unknown;
  let sessionStorageState: unknown = options?.storageState;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      if (attempt > 1) {
        onProgress?.(
          `RECOVER: Chromium caiu — tentativa ${attempt}/${maxAttempts} · próxima página ${resumeFrom}`,
        );
      } else if (resumeFrom > 1) {
        onProgress?.(`BOOT: retomando extração na página ${resumeFrom}…`);
      }
      return await scrapeCasaDosDadosLeadsOnce(filters, onProgress, {
        ...options,
        resumeFromPage: resumeFrom,
        storageState: sessionStorageState,
        onStorageState: async (state) => {
          sessionStorageState = state;
          await options?.onStorageState?.(state);
        },
        onPageCheckpoint: async (ckpt) => {
          resumeFrom = Math.max(1, ckpt.nextPage);
          await options?.onPageCheckpoint?.(ckpt);
        },
        shouldAbort: options?.shouldAbort,
      });
    } catch (error) {
      lastErr = error;
      const msg = error instanceof Error ? error.message : String(error);
      // Só reabre Chromium se Target crashed / disconnect / renderer morto.
      if (!requiresBrowserRecovery(error)) {
        throw error instanceof Error ? error : new Error(msg);
      }
      onProgress?.(
        `RECOVER: renderer/browser morto — checkpoint página ${resumeFrom} preservado…`,
      );
      if (attempt >= maxAttempts) break;
      await new Promise((r) => setTimeout(r, Math.min(8000, 1000 * attempt)));
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error(String(lastErr || "Falha na extração após retentativas de reconexão."));
}

/**
 * Uma sessão Playwright (LOGIN → FILTERS → SEARCH → COPY). Em HARD_FAILURE, o wrapper
 * reconecta a partir de `resumeFromPage` (reaplica filtros + SEARCH + jump).
 */
async function scrapeCasaDosDadosLeadsOnce(
  filters: WabaLeadsCnpjFilters,
  onProgress?: CasaDosDadosProgress,
  options?: ScrapeCasaDosDadosOptions,
): Promise<ScrapeCasaDosDadosResult> {
  // Cada chamada = 1 Chromium. Concorrência limitada no service (soft-cap 2 + stagger).
  const { email, password } = readCasaDosDadosCredentials();
  const playwright = await loadPlaywright();
  // 0 / ausente = sem teto: copia todas as páginas até o portal acabar.
  const maxPagesCap = Math.max(0, Math.round(Number(filters.maxPages ?? 0) || 0));

  const hasXvfb = Boolean(String(process.env.DISPLAY || "").trim());
  const headless = resolveCasaDosDadosHeadless();
  // Em produção (Xvfb) slowMo alto deixa a coleta “parada”; V02 era rápido com 0–15ms.
  const slowMoCap = hasXvfb ? 15 : 80;
  const slowMo = headless
    ? 0
    : Math.min(
        slowMoCap,
        Math.max(0, Math.round(Number(process.env.CASADOSDADOS_SLOWMO_MS || 0) || 0)),
      );

  let phase: ScrapePhase = "BOOT";
  let phaseStartedAt = Date.now();
  /** Heartbeat = tempo na fase; NÃO fingir progresso. */
  let sessionPhase = "BOOT…";
  const setPhase = (next: ScrapePhase, detail: string) => {
    phase = next;
    phaseStartedAt = Date.now();
    const msg = `${next}: ${detail}`;
    sessionPhase = msg;
    onProgress?.(msg);
    console.log(
      JSON.stringify({
        event: "LEADS_SCRAPE",
        phase: next,
        detail,
        ts: new Date().toISOString(),
      }),
    );
  };

  onProgress?.(
    headless
      ? "BOOT: iniciando Chromium (headless real)…"
      : String(process.env.DISPLAY || "").trim()
        ? "BOOT: abrindo Casa dos Dados (Xvfb)…"
        : "BOOT: abrindo janela do Casa dos Dados…",
  );
  let browser;
  try {
    browser = await playwright.chromium.launch({
      headless,
      slowMo,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        // Sem GPU física no Docker/Xvfb — mas NÃO desligar software rasterizer
        // (--disable-software-rasterizer + --disable-gpu mata o fallback e crasha o renderer).
        "--disable-gpu",
        "--disable-extensions",
        "--mute-audio",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        "--disable-background-timer-throttling",
        // Maximizar sob Xvfb costuma derrubar o renderer ("Target crashed").
        ...(headless || hasXvfb ? [] : ["--start-maximized"]),
      ],
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (/Executable doesn't exist|browserType\.launch/i.test(detail)) {
      throw new Error(
        "Chromium do Playwright ausente no servidor. No Docker: rode `npx playwright install --with-deps chromium` na imagem (ver Dockerfile) e faça Redeploy.",
      );
    }
    throw error;
  }

  const resumeFromPageLog = Math.max(1, Math.round(Number(options?.resumeFromPage || 1) || 1));
  browser.on("disconnected", () => {
    console.error(`[Leads PJ] BROWSER_DISCONNECTED page=${resumeFromPageLog}`);
  });

  /** Fecha Chromium só se shouldAbort (exclusão do usuário) — não por demora. */
  const abortWatch = setInterval(() => {
    if (!options?.shouldAbort?.()) return;
    console.error(`[Leads PJ] SCRAPE_ABORT_CLOSE page=${resumeFromPageLog}`);
    void browser.close().catch(() => undefined);
  }, 4000);

  /** Heartbeat = tempo na fase; NÃO fingir progresso. */
  const markPhase = (message: string) => {
    sessionPhase = message;
    phaseStartedAt = Date.now();
    onProgress?.(message);
  };
  const sessionKeepAlive = setInterval(() => {
    const elapsed = Math.max(0, Math.round((Date.now() - phaseStartedAt) / 1000));
    const base = String(sessionPhase || phase).replace(/\s*—\s*\d+s(?:\/\d+s)?\s*$/i, "").trim();
    onProgress?.(`${base} — ${elapsed}s`);
  }, 10_000);

  try {
    const contextOptions: Record<string, unknown> = {
      locale: "pt-BR",
      // Viewport fixo no Docker/Xvfb — null + maximizado crasha o Chromium.
      viewport: headless || hasXvfb ? { width: 1440, height: 900 } : null,
    };
    if (options?.storageState) {
      contextOptions.storageState = options.storageState;
    }
    const context = await browser.newContext(contextOptions);
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    page.on("crash", () => {
      console.error(`[Leads PJ] PAGE_CRASH page=${resumeFromPageLog}`);
    });
    if (!headless) {
      await page.bringToFront().catch(() => undefined);
    }

    setPhase("LOGIN", "abrindo portal…");
    await gotoWithRetry(page, PORTAL_LOGIN_URL, { waitUntil: "domcontentloaded" });
    await waitPastCloudflare(page, { onProgress, stage: "login" });

    const alreadyIn = await page
      .evaluate(() => /\/plataforma\b/i.test(location.pathname || ""))
      .catch(() => false);
    if (!alreadyIn) {
      setPhase("LOGIN", "autenticando…");
      await loginCasaDosDadosPortal(page, email, password);
      await waitPastCloudflare(page, { onProgress, stage: "pós-login" });
      setPhase("LOGIN", "autenticado");
    } else {
      setPhase("LOGIN", "sessão restaurada (storageState)");
    }

    try {
      const state = await context.storageState();
      await options?.onStorageState?.(state);
    } catch {
      /* ignore */
    }

    setPhase("FILTERS", "abrindo tela de pesquisa…");
    await gotoWithRetry(page, PORTAL_SEARCH_URL, { waitUntil: "domcontentloaded" });
    await waitPastCloudflare(page, { onProgress, stage: "pesquisa" });
    await page.waitForTimeout(1500);

    setPhase("FILTERS", "aplicando filtros (CNAE, situação, celular)…");
    await applyFilters(page as unknown as PageLike, filters, (msg) => {
      sessionPhase = `FILTERS: ${msg}`;
      phaseStartedAt = Date.now();
      onProgress?.(sessionPhase);
    });

    // Captura total da API (se houver). CNPJs vêm da tela — não pré-carregar do JSON.
    let interceptedTotal: number | null = null;
    page.on("response", async (res: any) => {
      try {
        const url = res.url();
        if (!/cnpj\/pesquisa|pesquisa/i.test(url)) return;
        const ct = String(res.headers()["content-type"] || "");
        if (!ct.includes("json")) return;
        const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        if (!json) return;
        if (typeof json.total === "number") interceptedTotal = json.total;
      } catch {
        /* ignore — fonte principal é o texto da tela */
      }
    });

    // NÃO usar locator.has-text("Fechar") nem page.waitForTimeout no race:
    // no Playwright a fila CDP é serial — locator/evaluate travado impede o timeout.
    // Só Escape com timeout do Node; depois segue para descoberta do CTA.
    setPhase("SEARCH", "dismiss modal CNAE (Escape)…");
    try {
      await Promise.race([
        page.keyboard.press("Escape").then(() => undefined),
        new Promise<void>((resolve) => {
          setTimeout(resolve, 800);
        }),
      ]);
      await new Promise((r) => setTimeout(r, 200));
    } catch {
      /* segue */
    }
    setPhase("SEARCH", "preparando CTA Pesquisar…");

    const searchTimeoutMs = Math.max(
      15_000,
      Math.round(Number(process.env.CASADOSDADOS_SEARCH_TIMEOUT_MS || 90_000) || 90_000),
    );

    const runSearchOnce = async (allowRedispatch: boolean): Promise<SearchTransition> => {
      // Probe LEVE com teto Node — NÃO chamar probeSearchState completo aqui
      // (findSearchButtonCandidates trava a fila CDP e o keepalive fica em "preparando CTA").
      setPhase("SEARCH", "checando estado pré-CTA…");
      const preLite = await withNodeTimeout(probeSearchAckLite(page), 3000, null);
      if (preLite && (preLite.pagination || preLite.cnpjNodes > 0)) {
        onProgress?.(
          `SEARCH: resultados já presentes — pag=${preLite.pagination} cnpj=${preLite.cnpjNodes}`,
        );
        return { kind: "results", total: null };
      }
      if (preLite && preLite.loadingNodes > 0 && !allowRedispatch) {
        setPhase("SEARCH", "loading ativo — aguardando sem redisparo…");
        return waitForSearchTransition(
          page as unknown as PageLike,
          searchTimeoutMs,
          (msg) => {
            sessionPhase = msg;
            onProgress?.(msg);
          },
          options?.shouldAbort,
        );
      }

      await dispatchSearchWithAck(page, (msg) => {
        sessionPhase = msg;
        phaseStartedAt = Date.now();
        onProgress?.(msg);
      });
      setPhase("SEARCH", "ACK ok — aguardando resultados…");
      return waitForSearchTransition(
        page as unknown as PageLike,
        searchTimeoutMs,
        (msg) => {
          sessionPhase = msg;
          onProgress?.(msg);
        },
        options?.shouldAbort,
      );
    };

    let searchResult = await runSearchOnce(true);
    if (searchResult.kind === "timeout-responsive") {
      const stuckProbe =
        searchResult.probe ||
        (await withNodeTimeout(probeSearchState(page), 3000, null as SearchProbe | null));
      // Retry same-Page só se portal idle (sem loading) e sem resultados.
      if (stuckProbe && stuckProbe.loadingNodes > 0) {
        throw new LeadsScrapeError(
          "SEARCH_TIMEOUT_RESPONSIVE",
          "same-page",
          `PORTAL_SEARCH_STUCK — loading ainda ativo após timeout. ${formatProbeShort(stuckProbe)}`,
        );
      }
      setPhase("SEARCH", "timeout responsivo — 1 retry controlado na mesma Page…");
      searchResult = await runSearchOnce(true);
    }
    if (searchResult.kind === "renderer-unresponsive") {
      throw new LeadsScrapeError(
        "RENDERER_UNRESPONSIVE",
        "new-browser",
        "Renderer não responde durante SEARCH",
      );
    }
    if (searchResult.kind === "blocked") {
      throw new LeadsScrapeError(
        "PORTAL_BLOCKED",
        "stop",
        "Cloudflare ou desafio de segurança na pesquisa.",
      );
    }
    if (searchResult.kind === "timeout-responsive") {
      const last =
        searchResult.probe ||
        (await withNodeTimeout(probeSearchState(page), 3000, null as SearchProbe | null));
      throw new LeadsScrapeError(
        "SEARCH_TIMEOUT_RESPONSIVE",
        "same-page",
        `Pesquisa excedeu timeout (renderer saudável). ${last ? formatProbeShort(last) : "sem-probe"}`,
      );
    }
    if (searchResult.kind === "empty") {
      setPhase("DONE", "pesquisa sem resultados");
      await context.close();
      return { leads: [], scrapeCompleted: true, doneReason: "SEARCH_EMPTY" };
    }

    // Sem locator("body").filter(hasText) — reavalia o DOM inteiro e derruba o renderer.
    const pageText = await readResultsSampleText(page, 12_000);
    const portalTotal =
      interceptedTotal ??
      searchResult.total ??
      parseResultTotalFromText(pageText);
    if (portalTotal != null) {
      setPhase(
        "COPY",
        `retornou ${portalTotal.toLocaleString("pt-BR")} empresas — iniciando cópia…`,
      );
    } else {
      setPhase("COPY", "lendo cards na tela (CNPJ + Razão Social)…");
    }

    const collected = new Map<string, WabaLeadsCnpjLead>();
    let doneReason = "UNKNOWN";
    let scrapeCompleted = false;
    // NÃO pré-carregar interceptedRows aqui: se a API já encher `collected`,
    // a página 1 fica com added=0 e o robô encerra a paginação sem ir à página 2
    // (Seguro 14: 20 CNPJs da pág.1 = já usados → pool vazio).

    const readScreenCards = async (): Promise<string[][]> => readScreenCardsLight(page);

    const firstCnpjOf = (rows: string[][]) => (rows[0] ? normalizeCnpjDigits(rows[0][0]) : "");

    const readCurrentPageNumber = async (): Promise<number> =>
      page.evaluate(() => {
        const active = document.querySelector(
          [
            'nav[data-oruga="pagination"] button[aria-current="page"]',
            'nav[data-oruga="pagination"] button.pagination-link.is-current',
            'nav[data-oruga="pagination"] button[aria-current="true"]',
          ].join(", "),
        );
        const n = Number(String(active?.textContent || "").trim());
        return Number.isFinite(n) && n > 0 ? n : 1;
      });

    const portalUiMaxPage = resolvePortalUiMaxPage();

    /** Lê página ativa Oruga (is-current / aria-current). */
    const waitUntilPage = async (expectedPage: number, timeoutMs: number): Promise<boolean> => {
      const deadline = Date.now() + Math.max(500, timeoutMs);
      while (Date.now() < deadline) {
        if (options?.shouldAbort?.()) return false;
        const cur = await readCurrentPageNumber();
        if (cur === expectedPage) return true;
        await page.waitForTimeout(200);
      }
      return false;
    };

    /**
     * Salto de página via DOM nativo (sem locator Playwright) — mais estável no Xvfb.
     * Oruga: botões aria-label "Página N." / texto N / input numérico se existir.
     */
    const jumpToPageDom = async (target: number): Promise<boolean> => {
      const clicked = await page
        .evaluate((t: number) => {
          const nav = document.querySelector('nav[data-oruga="pagination"]') as HTMLElement | null;
          if (!nav) return { ok: false, how: "no-nav" as const };

          const tryClick = (el: Element | null | undefined): boolean => {
            if (!el) return false;
            const b = el as HTMLButtonElement;
            if (b.disabled || b.classList.contains("is-disabled") || b.getAttribute("aria-disabled") === "true") {
              return false;
            }
            b.click();
            return true;
          };

          const buttons = Array.from(nav.querySelectorAll("button.pagination-link, button"));
          for (const b of buttons) {
            const label = String(b.getAttribute("aria-label") || "");
            const text = String(b.textContent || "").trim();
            if (
              label === `Página ${t}.` ||
              label === `Página ${t}` ||
              new RegExp(`Página\\s+${t}\\b`, "i").test(label) ||
              text === String(t)
            ) {
              if (tryClick(b)) return { ok: true, how: "button" as const };
            }
          }

          const input = nav.querySelector(
            'input[type="number"], input.input, input[class*="pagination"]',
          ) as HTMLInputElement | null;
          if (input) {
            input.focus();
            input.value = String(t);
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
            input.dispatchEvent(
              new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }),
            );
            input.dispatchEvent(
              new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }),
            );
            return { ok: true, how: "input" as const };
          }

          return { ok: false, how: "miss" as const };
        }, target)
        .catch(() => ({ ok: false, how: "err" as const }));

      if (!clicked.ok) return false;
      return waitUntilPage(target, 12_000);
    };

    /**
     * Avança 1 página: DOM click no next + confirmação por número OU 1º CNPJ.
     * Timeout duro por passo (não fica 60s+ parado).
     */
    const goToNextResultsPage = async (
      previousFirstCnpj: string,
      fromPage: number,
    ): Promise<boolean> => {
      const targetPage = fromPage + 1;
      markPhase(`Copiando: avançando paginação ${fromPage} → ${targetPage}…`);

      const clicked = await page
        .evaluate(() => {
          const nav = document.querySelector('nav[data-oruga="pagination"]');
          if (!nav) return false;
          const next =
            (nav.querySelector(
              "button.pagination-next:not([disabled]):not(.is-disabled)",
            ) as HTMLButtonElement | null) ||
            (nav.querySelector(
              'button[aria-label*="Pŕoxima"], button[aria-label*="Próxima"], button[aria-label*="proxima" i]',
            ) as HTMLButtonElement | null);
          if (!next) return false;
          if (
            next.disabled ||
            next.classList.contains("is-disabled") ||
            next.getAttribute("aria-disabled") === "true"
          ) {
            return false;
          }
          next.click();
          return true;
        })
        .catch(() => false);

      if (!clicked) {
        // Fallback Playwright selectors (curto).
        const sels = [
          'nav[data-oruga="pagination"] button.pagination-next:not([disabled]):not(.is-disabled)',
          "button.pagination-next.pagination-link:not([disabled]):not(.is-disabled)",
        ];
        let any = false;
        for (const sel of sels) {
          const btn = page.locator(sel).first();
          if ((await btn.count()) === 0) continue;
          if (!(await btn.isVisible().catch(() => false))) continue;
          await btn.click({ force: true, timeout: 4000 }).catch(() => null);
          any = true;
          break;
        }
        if (!any) return false;
      }

      const pageOk = await waitUntilPage(targetPage, 10_000);
      if (pageOk) {
        await waitForPortalSearchResults(page, 12_000, (msg) => {
          sessionPhase = msg;
          markPhase(msg);
        });
        return true;
      }

      if (previousFirstCnpj) {
        const deadline = Date.now() + 8_000;
        while (Date.now() < deadline) {
          const nextFirst = await readFirstVisibleCnpjDigits(page);
          if (nextFirst && nextFirst !== previousFirstCnpj) return true;
          await page.waitForTimeout(250);
        }
      }
      return false;
    };

    /**
     * Posiciona na página alvo. Se falhar, retorna false (caller reinicia da 1 — processo não para).
     */
    const goToResultsPage = async (targetPage: number): Promise<boolean> => {
      const target = Math.max(1, Math.round(targetPage || 1));
      if (target > portalUiMaxPage) return false;
      let current = await readCurrentPageNumber();
      if (current === target) return true;

      markPhase(`Copiando: salto DOM para página ${target} (UI em ${current})…`);
      if (await jumpToPageDom(target)) return true;

      // Clica no maior botão numérico visível ≤ target (aproxima sem 1→2→3… lento).
      for (let hop = 0; hop < 8; hop += 1) {
        current = await readCurrentPageNumber();
        if (current === target) return true;
        if (current > target) break;
        const best = await page
          .evaluate((t: number) => {
            const nav = document.querySelector('nav[data-oruga="pagination"]');
            if (!nav) return 0;
            let bestN = 0;
            for (const b of Array.from(nav.querySelectorAll("button.pagination-link"))) {
              const text = String(b.textContent || "").trim();
              const n = Number(text);
              if (!Number.isFinite(n) || n <= 0 || n > t) continue;
              const btn = b as HTMLButtonElement;
              if (btn.disabled || btn.classList.contains("is-disabled")) continue;
              if (n > bestN) bestN = n;
            }
            if (bestN <= 0) return 0;
            for (const b of Array.from(nav.querySelectorAll("button.pagination-link"))) {
              if (String(b.textContent || "").trim() === String(bestN)) {
                (b as HTMLButtonElement).click();
                return bestN;
              }
            }
            return 0;
          }, target)
          .catch(() => 0);
        if (best > 0) {
          markPhase(`Copiando: aproximando via botão ${best} (alvo ${target})…`);
          await waitUntilPage(best, 10_000);
          if (await jumpToPageDom(target)) return true;
          continue;
        }
        break;
      }

      // Último recurso: poucos "next" com teto baixo (não 25×60s).
      const maxSteps = Math.max(
        1,
        Math.min(
          12,
          Math.round(Number(process.env.CASADOSDADOS_MAX_SEQUENTIAL_RESUME_STEPS || 12) || 12),
        ),
      );
      let guard = 0;
      while ((current = await readCurrentPageNumber()) < target && guard < maxSteps) {
        if (options?.shouldAbort?.()) return false;
        guard += 1;
        markPhase(
          `Copiando: posicionando retomada — passo ${guard}/${maxSteps} (UI pág. ${current} → ${target})…`,
        );
        const prev = await readFirstVisibleCnpjDigits(page);
        const ok = await goToNextResultsPage(prev, current);
        if (!ok) {
          markPhase(
            `Copiando: paginação não avançou no passo ${guard} (UI ${current}) — abortando posicionamento.`,
          );
          return false;
        }
        if (await jumpToPageDom(target)) return true;
      }
      current = await readCurrentPageNumber();
      return current === target;
    };

    let pagesToFetch =
      maxPagesCap > 0 ? maxPagesCap : Number.MAX_SAFE_INTEGER;
    if (portalTotal != null) {
      const totalPagesAvailable = Math.max(1, Math.ceil(portalTotal / PORTAL_PAGE_SIZE));
      pagesToFetch =
        maxPagesCap > 0
          ? Math.min(maxPagesCap, totalPagesAvailable)
          : totalPagesAvailable;
      markPhase(
        `Portal: ${portalTotal.toLocaleString("pt-BR")} empresas · ${PORTAL_PAGE_SIZE}/página · ${totalPagesAvailable.toLocaleString("pt-BR")} página(s) — copiando ${maxPagesCap > 0 ? `até ${pagesToFetch}` : "todas"}…`,
      );
    } else if (maxPagesCap <= 0) {
      markPhase(
        `Copiando: total do portal não lido — avançando página a página até acabar (sem teto)…`,
      );
    }
    // UI Oruga não navega além de portalUiMaxPage — evita loop Chromium em 1001+.
    if (pagesToFetch > portalUiMaxPage) {
      markPhase(
        `Copiando: teto da UI do portal = página ${portalUiMaxPage} (além disso a paginação não avança).`,
      );
      pagesToFetch = portalUiMaxPage;
    }

    let startPage = Math.max(1, Math.round(Number(options?.resumeFromPage || 1) || 1));
    if (startPage > pagesToFetch) {
      markPhase(
        startPage > portalUiMaxPage
          ? `Copiando: checkpoint página ${startPage} além do teto da UI (${portalUiMaxPage}) — raspagem via portal encerrada; pool já arquivado será usado.`
          : `Copiando: checkpoint página ${startPage} além do total (${pagesToFetch}) — sessão sem páginas novas.`,
      );
      await context.close();
      return {
        leads: [],
        scrapeCompleted: true,
        doneReason: startPage > portalUiMaxPage ? "BEYOND_UI_MAX" : "BEYOND_TOTAL",
      };
    }
    if (startPage > 1) {
      markPhase(`COPY: posicionando na página ${startPage} (retomada)…`);
      const positioned = await goToResultsPage(startPage);
      if (!positioned) {
        // Garantia: não para o processo — copia desde a 1 (dedupe no pool).
        markPhase(
          `COPY: falha ao posicionar pág. ${startPage} no Xvfb — reiniciando da página 1…`,
        );
        startPage = 1;
        const backHome = await jumpToPageDom(1);
        if (!backHome) {
          const cur = await readCurrentPageNumber();
          if (cur !== 1) {
            markPhase(
              `COPY: UI na pág. ${cur}; seguindo daqui (checkpoint será atualizado).`,
            );
            startPage = cur;
          }
        }
      }
    }

    let emptyStreak = 0;

    for (let pageIndex = startPage; pageIndex <= pagesToFetch; pageIndex += 1) {
      if (options?.shouldAbort?.()) {
        throw new Error("__MLC_JOB_ABORTED__");
      }
      const totalLabel =
        portalTotal != null ? ` de ${portalTotal.toLocaleString("pt-BR")}` : "";
      setPhase(
        "COPY",
        `página ${pageIndex}/${pagesToFetch === Number.MAX_SAFE_INTEGER ? "?" : pagesToFetch}${totalLabel} · sessão ${collected.size.toLocaleString("pt-BR")} CNPJ(s)`,
      );

      let rows = await readScreenCards();
      // Página vazia: relê na MESMA sessão (não fecha Chromium / não refaz CNAE).
      if (rows.length === 0) {
        for (let reread = 1; reread <= 3; reread += 1) {
          markPhase(
            `COPY: página ${pageIndex} sem cards — relendo ${reread}/3 (mesma sessão)…`,
          );
          await page.waitForTimeout(reread === 1 ? 500 : 1000);
          rows = await readScreenCards();
          if (rows.length) break;
        }
      }

      const pageFirst = firstCnpjOf(rows);
      let added = 0;
      const pageLeads: WabaLeadsCnpjLead[] = [];
      for (const cells of rows) {
        const lead = mapRowCells(cells);
        if (!lead) continue;
        if (!collected.has(lead.cnpj)) {
          collected.set(lead.cnpj, lead);
          pageLeads.push(lead);
          added += 1;
        }
      }
      markPhase(
        `COPY: página ${pageIndex} arquivada — +${added} / ${rows.length} cards · pool sessão ${collected.size.toLocaleString("pt-BR")} · próxima ${pageIndex + 1}`,
      );

      const nextPage = pageIndex + 1;
      // Checkpoint ANTES do next (contrato: persistir página N antes de avançar).
      await options?.onPageCheckpoint?.({
        completedPage: pageIndex,
        nextPage,
        pageLeads,
        sessionCollected: [...collected.values()],
        portalTotal,
        pagesToFetch: pagesToFetch === Number.MAX_SAFE_INTEGER ? pageIndex : pagesToFetch,
      });

      if (pageIndex >= pagesToFetch) {
        doneReason = "MAX_PAGES";
        scrapeCompleted = true;
        break;
      }

      if (rows.length === 0) {
        emptyStreak += 1;
        if (pageIndex >= pagesToFetch || pageIndex >= portalUiMaxPage) {
          markPhase(`COPY: página ${pageIndex} sem cards — fim da paginação.`);
          doneReason = "EMPTY_AT_END";
          scrapeCompleted = true;
          break;
        }
        if (emptyStreak >= 3) {
          markPhase(
            `COPY: 3 páginas vazias seguidas (até pág. ${pageIndex}) — fim (${collected.size} CNPJs).`,
          );
          doneReason = "THREE_EMPTY_PAGES";
          scrapeCompleted = true;
          break;
        }
        markPhase(
          `COPY: página ${pageIndex} vazia — avançando para ${nextPage} (mesma Page)…`,
        );
      } else {
        emptyStreak = 0;
      }

      if (nextPage > portalUiMaxPage) {
        markPhase(
          `COPY: atingiu teto UI (página ${portalUiMaxPage}) — encerrando raspagem.`,
        );
        doneReason = "UI_MAX_PAGE";
        scrapeCompleted = true;
        break;
      }

      markPhase(`COPY: avançando ${pageIndex} → ${nextPage}…`);
      let advanced = await goToNextResultsPage(pageFirst, pageIndex);
      if (!advanced) {
        advanced = await jumpToPageDom(nextPage);
      }
      if (!advanced) {
        for (let retry = 1; retry <= 3; retry += 1) {
          markPhase(
            `COPY: retry paginação ${pageIndex}→${nextPage} (${retry}/3) — mesma sessão…`,
          );
          await page.waitForTimeout(600);
          advanced =
            (await goToNextResultsPage(pageFirst, pageIndex)) ||
            (await jumpToPageDom(nextPage));
          if (advanced) break;
        }
      }
      if (!advanced) {
        const stillOn = await readCurrentPageNumber();
        const alive = await rendererProbe(page, 3000);
        if (!alive) {
          throw new RendererUnresponsiveError(`COPY next ${pageIndex}→${nextPage}`);
        }
        // Soft: encerra com o já copiado — scrape incompleto (service mantém checkpoint).
        markPhase(
          `COPY: paginação stall em ${pageIndex} (UI ${stillOn}) — ${collected.size} CNPJs; sem reabrir portal.`,
        );
        doneReason = "PAGINATION_STALL";
        scrapeCompleted = false;
        break;
      }
    }

    if (!scrapeCompleted && doneReason === "UNKNOWN") {
      // Saiu do for sem marcar fim explícito — tratar como incompleto.
      doneReason = "INCOMPLETE";
      scrapeCompleted = false;
    }

    await context.close();
    // Retomada (startPage>1) que não leu nenhum card NÃO é sucesso — senão o service
    // limpa o checkpoint e enriquece só o pool parcial (incidente Corbans: 140 de ~8070).
    if (!collected.size) {
      if (startPage > 1) {
        throw new Error(
          `Retomada na página ${startPage} não leu CNPJ/Razão Social — reconectar mantendo checkpoint/pool.`,
        );
      }
      throw new Error(
        "Robô não leu CNPJ/Razão Social na tela. Confirme login, filtros e se os cards aparecem (formato: 00.000.000/0000-00 - NOME). Se Cloudflare bloquear, use CASADOSDADOS_HEADLESS=0.",
      );
    }
    setPhase(
      "DONE",
      `${collected.size.toLocaleString("pt-BR")} CNPJ(s) · reason=${doneReason} · completed=${scrapeCompleted}`,
    );
    return {
      leads: [...collected.values()],
      scrapeCompleted,
      doneReason,
    };
  } finally {
    clearInterval(abortWatch);
    clearInterval(sessionKeepAlive);
    await browser.close().catch(() => undefined);
  }
}
