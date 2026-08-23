"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RendererUnresponsiveError = void 0;
exports.readCasaDosDadosCredentials = readCasaDosDadosCredentials;
exports.assertCasaDosDadosCredentials = assertCasaDosDadosCredentials;
exports.resolvePortalUiMaxPage = resolvePortalUiMaxPage;
exports.scrapeCasaDosDadosLeads = scrapeCasaDosDadosLeads;
const waba_leads_cnpj_repository_1 = require("./waba-leads-cnpj.repository");
const PORTAL_LOGIN_URL = process.env.CASADOSDADOS_LOGIN_URL || "https://portal.casadosdados.com.br/entrar";
const PORTAL_SEARCH_URL = process.env.CASADOSDADOS_SEARCH_URL ||
    "https://portal.casadosdados.com.br/plataforma/pesquisa";
async function isCloudflareInterstitial(page) {
    const title = await page.title().catch(() => "");
    if (/um momento|just a moment/i.test(title))
        return true;
    const url = typeof page.url === "function" ? String(page.url() || "") : "";
    if (/__cf_chl|cf-challenge|cdn-cgi\/challenge/i.test(url))
        return true;
    const hint = await page
        .evaluate(() => {
        const text = String(document.body?.innerText || "").slice(0, 800).toLowerCase();
        return (text.includes("cloudflare") ||
            text.includes("verificação de segurança") ||
            text.includes("checking your browser") ||
            text.includes("just a moment"));
    })
        .catch(() => false);
    return Boolean(hint);
}
/**
 * Anti-bot do portal (título "Um momento…" / "Just a moment…").
 * Em headless costuma NÃO limpar; com janela (V02) ou Xvfb+headed limpa em <2s.
 */
async function waitPastCloudflare(page, options) {
    const timeoutMs = Math.max(5000, Math.round(Number(options?.timeoutMs ?? (Number(process.env.CASADOSDADOS_CF_WAIT_MS || 90000) || 90000))));
    const stage = options?.stage || "portal";
    if (!(await isCloudflareInterstitial(page)))
        return;
    options?.onProgress?.(`Abrindo Portal: verificação anti-bot em andamento (${stage}) — aguardando liberação…`);
    const cleared = await page
        .waitForFunction(() => !/um momento|just a moment/i.test(document.title), {
        timeout: timeoutMs,
    })
        .then(() => true)
        .catch(() => false);
    await page.waitForTimeout(800);
    if (cleared && !(await isCloudflareInterstitial(page)))
        return;
    const title = await page.title().catch(() => "");
    const url = typeof page.url === "function" ? page.url() : "";
    throw new Error(`Portal Casa dos Dados bloqueou o robô (anti-bot / "Um momento…"). ` +
        `No V02 funciona com janela visível; no Docker use Xvfb + Chromium headed (entrypoint). ` +
        `stage=${stage}; title=${title || "(vazio)"}; url=${String(url).slice(0, 160)}`);
}
/**
 * Evita "Navigation … is interrupted by another navigation" (ex.: pós-login
 * ainda indo para /plataforma enquanto o robô chama goto /pesquisa).
 */
async function gotoWithRetry(
// eslint-disable-next-line @typescript-eslint/no-explicit-any
page, url, options) {
    const waitUntil = options?.waitUntil || "domcontentloaded";
    const timeout = options?.timeout || 60000;
    let lastError;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
        try {
            await page.goto(url, { waitUntil, timeout });
            return;
        }
        catch (error) {
            lastError = error;
            const msg = error instanceof Error ? error.message : String(error);
            if (!/interrupted by another navigation/i.test(msg))
                throw error;
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
page, email, password) {
    if (!email || !password) {
        throw new Error(`Login Casa dos Dados: credencial vazia no processo (emailLen=${email.length}, passwordLen=${password.length}).`);
    }
    const emailInput = page.locator('input[name="email"]').first();
    const passwordInput = page.locator('input[name="senha"]').first();
    const accessBtn = page.locator('button:has-text("Acessar")').first();
    await emailInput.waitFor({ state: "visible", timeout: 30000 });
    await passwordInput.waitFor({ state: "visible", timeout: 15000 });
    await accessBtn.waitFor({ state: "visible", timeout: 10000 });
    const readLoginState = async () => page.evaluate(() => {
        const emailEl = document.querySelector('input[name="email"]');
        const senhaEl = document.querySelector('input[name="senha"]');
        const btn = Array.from(document.querySelectorAll("button")).find((b) => /acessar/i.test(b.textContent || ""));
        return {
            emailLen: emailEl ? String(emailEl.value || "").length : -1,
            senhaLen: senhaEl ? String(senhaEl.value || "").length : -1,
            btnDisabled: btn ? btn.disabled : null,
            url: location.href,
        };
    });
    const fillBoth = async (mode) => {
        await emailInput.click({ clickCount: 3 });
        await emailInput.fill("");
        if (mode === "fill")
            await emailInput.fill(email);
        else
            await emailInput.pressSequentially(email, { delay: 15 });
        await emailInput.dispatchEvent("input").catch(() => undefined);
        await emailInput.dispatchEvent("change").catch(() => undefined);
        await passwordInput.click({ clickCount: 3 });
        await passwordInput.fill("");
        if (mode === "fill")
            await passwordInput.fill(password);
        else
            await passwordInput.pressSequentially(password, { delay: 15 });
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
            const btn = Array.from(document.querySelectorAll("button")).find((b) => /acessar/i.test(b.textContent || ""));
            return Boolean(btn && !btn.disabled);
        }, { timeout: 8000 })
            .catch(() => null);
        state = await readLoginState();
    }
    if (state.btnDisabled !== false) {
        throw new Error(`Login Casa dos Dados: botão Acessar continua disabled (emailLen=${state.emailLen}, senhaLen=${state.senhaLen}, url=${state.url}). O portal só habilita com e-mail e senha aceitos no formulário — não é falha de clique.`);
    }
    await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => null),
        accessBtn.click({ timeout: 15000 }),
    ]);
    // Pós-login o portal costuma ir para /plataforma (redirect). Espera sair de /entrar.
    await page
        .waitForURL((url) => !/\/entrar\/?$/i.test(url.pathname), { timeout: 45000 })
        .catch(() => null);
    await page.waitForLoadState("domcontentloaded").catch(() => null);
    await page.waitForTimeout(400);
    const afterUrl = String(page.url?.() || "");
    if (/\/entrar\/?$/i.test(new URL(afterUrl || "https://portal.casadosdados.com.br/entrar").pathname)) {
        const tip = await page
            .evaluate(() => String(document.body?.innerText || "").replace(/\s+/g, " ").slice(0, 220))
            .catch(() => "");
        throw new Error(`Login Casa dos Dados: ainda em /entrar após Acessar (url=${afterUrl}). ` +
            `Confira CASADOSDADOS_EMAIL/PASSWORD no ambiente. Detalhe: ${tip || "(sem texto)"}`);
    }
}
class RendererUnresponsiveError extends Error {
    constructor(stage) {
        super(`Renderer não responde durante ${stage}`);
        this.code = "RENDERER_UNRESPONSIVE";
        this.name = "RendererUnresponsiveError";
    }
}
exports.RendererUnresponsiveError = RendererUnresponsiveError;
function readCasaDosDadosCredentials() {
    const email = String(process.env.CASADOSDADOS_EMAIL || "").trim();
    const password = String(process.env.CASADOSDADOS_PASSWORD || "").trim();
    if (!email || !password) {
        throw new Error("Credenciais do Casa dos Dados ausentes. Configure CASADOSDADOS_EMAIL e CASADOSDADOS_PASSWORD no .env.v02 e reinicie o V02.");
    }
    return { email, password };
}
/** Valida credenciais antes de criar a lista (falha rápida na UI). */
function assertCasaDosDadosCredentials() {
    readCasaDosDadosCredentials();
}
async function loadPlaywright() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require("playwright");
    }
    catch {
        throw new Error("Playwright não instalado. Execute: npm i playwright && npx playwright install chromium");
    }
}
function cellText(value) {
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
function resolvePortalUiMaxPage() {
    const raw = Math.round(Number(process.env.CASADOSDADOS_UI_MAX_PAGE || 1000) || 1000);
    return Math.max(1, Number.isFinite(raw) ? raw : 1000);
}
/**
 * Formato do card: "94.361.474/0001-02 - LCT - CORRETORA DE SEGUROS LTDA"
 * Coleta apenas CNPJ + Razão Social (enriquecimento preenche o restante).
 */
function parsePortalLeadText(text) {
    const raw = cellText(text);
    if (!raw)
        return null;
    const formatted = raw.match(/^(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\s*[-–—]\s*(.+)$/i);
    if (formatted) {
        const cnpj = (0, waba_leads_cnpj_repository_1.normalizeCnpjDigits)(formatted[1]);
        if (cnpj.length !== 14)
            return null;
        const lead = (0, waba_leads_cnpj_repository_1.emptyLeadFromCnpj)(cnpj);
        lead.nome = cellText(formatted[2].replace(/\s*\b(Ativa|Baixada|Inapta|Nula|Suspensa)\b.*$/i, ""));
        return lead;
    }
    const digits = raw.replace(/\D/g, "").match(/\d{14}/);
    if (!digits)
        return null;
    const cnpj = digits[0];
    const lead = (0, waba_leads_cnpj_repository_1.emptyLeadFromCnpj)(cnpj);
    const after = raw.replace(/^\D*\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\s*[-–—]?\s*/i, "");
    lead.nome = cellText(after.replace(/\s*\b(Ativa|Baixada|Inapta|Nula|Suspensa)\b.*$/i, ""));
    return lead;
}
function mapRowCells(cells) {
    if (!cells.length)
        return null;
    const fromJoined = parsePortalLeadText(cells.join(" "));
    if (fromJoined)
        return fromJoined;
    if (cells.length >= 2) {
        const cnpj = (0, waba_leads_cnpj_repository_1.normalizeCnpjDigits)(cells[0]);
        if (cnpj.length === 14) {
            const lead = (0, waba_leads_cnpj_repository_1.emptyLeadFromCnpj)(cnpj);
            lead.nome = cellText(cells[1]);
            return lead;
        }
    }
    return parsePortalLeadText(cells[0] || "");
}
const XPATH_FOLD = "ABCDEFGHIJKLMNOPQRSTUVWXYZÁÀÂÃÉÊÍÓÔÕÚÇ','abcdefghijklmnopqrstuvwxyzáàâãéêíóôõúç";
function xpathLower(expr = ".") {
    return `translate(normalize-space(${expr}), '${XPATH_FOLD}')`;
}
/** Fecha modal "Inserir CNPJ em lote" se estiver aberto (bloqueia cliques nos filtros). */
async function dismissBlockingPortalOverlays(page) {
    const batchModal = page
        .locator('xpath=//textarea[contains(@placeholder,"Um CNPJ por linha") or contains(@placeholder,"CNPJ por linha")]')
        .first();
    if ((await batchModal.count()) > 0 && (await batchModal.isVisible().catch(() => false))) {
        await page.keyboard.press("Escape").catch(() => undefined);
        await page.waitForTimeout(300);
        const closeBtn = page
            .locator('button:has-text("Cancelar"), button:has-text("Fechar"), .modal-close, button.delete')
            .first();
        if ((await closeBtn.count()) > 0 && (await closeBtn.isVisible().catch(() => false))) {
            await closeBtn.click({ force: true }).catch(() => undefined);
            await page.waitForTimeout(200);
        }
    }
}
function isChromiumTargetCrash(error) {
    const msg = error instanceof Error ? error.message : String(error || "");
    return /Target crashed|has been closed|browser has been closed|Target page, context or browser has been closed/i.test(msg);
}
function requiresBrowserRecovery(error) {
    if (error instanceof RendererUnresponsiveError)
        return true;
    const anyErr = error;
    if (anyErr?.code === "RENDERER_UNRESPONSIVE")
        return true;
    return isChromiumTargetCrash(error);
}
/** Texto da área de resultados (evita serializar document.body inteiro via CDP). */
async function readResultsSampleText(page, maxChars = 12000) {
    return page.evaluate((limit) => {
        const root = document.querySelector("main") ||
            document.querySelector(".section, .container, #app") ||
            document.body;
        return String(root?.innerText || "").slice(0, Math.max(1000, limit));
    }, maxChars);
}
/** Cards CNPJ na tela — evaluate leve, sem scroll artificial. */
async function readScreenCardsLight(page) {
    return page.evaluate(() => {
        const re = /^(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\s+-\s+(.+)$/;
        const seen = new Set();
        const out = [];
        const root = document.querySelector("main") ||
            document.querySelector(".section, .container, #app") ||
            document.body;
        const lines = String(root?.innerText || "")
            .split(/\n+/)
            .map((s) => s.trim())
            .filter(Boolean);
        // Cards ficam no miolo; evita varrer menus/rodapé enormes.
        const slice = lines.length > 400 ? lines.slice(0, 400) : lines;
        for (const line of slice) {
            const m = line.match(re);
            if (!m || seen.has(m[1]))
                continue;
            seen.add(m[1]);
            out.push([m[1], m[2]]);
            if (out.length >= 40)
                break;
        }
        return out;
    });
}
async function readFirstVisibleCnpjDigits(page) {
    const rows = await readScreenCardsLight(page);
    const raw = rows[0]?.[0] || "";
    return (0, waba_leads_cnpj_repository_1.normalizeCnpjDigits)(raw);
}
async function rendererProbe(page, timeoutMs = 3000) {
    return Promise.race([
        page
            .evaluate(() => ({
            href: location.href,
            title: document.title,
            readyState: document.readyState,
        }))
            .then(() => true)
            .catch(() => false),
        new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs)),
    ]);
}
async function readSearchState(page) {
    return page.evaluate(() => {
        const pagination = document.querySelector('nav[data-oruga="pagination"]');
        const active = pagination?.querySelector('button[aria-current="page"], button.pagination-link.is-current, button[aria-current="true"]');
        const pageNum = Number(String(active?.textContent || "").trim());
        const buttons = Array.from(document.querySelectorAll("button"));
        const searching = buttons.some((b) => {
            const text = String(b.textContent || "").toLowerCase();
            return text.includes("pesquisando") || text.includes("carregando");
        });
        const root = document.querySelector("main") ||
            document.querySelector(".section, .container, #app") ||
            document.body;
        const sample = String(root?.innerText || "").slice(0, 6000);
        const cnpjRe = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\s+-\s+/;
        const totalMatch = sample.match(/retornou\s+([\d.\s]+)\s+empresas/i);
        let totalHint = null;
        if (totalMatch) {
            const n = Number(String(totalMatch[1]).replace(/\./g, "").replace(/\s/g, ""));
            if (Number.isFinite(n))
                totalHint = n;
        }
        const emptyHint = /nenhum resultado|0\s+empresas|não\s+encontr|nao\s+encontr/i.test(sample) && !cnpjRe.test(sample);
        const blocked = /cloudflare|just a moment|verificação de segurança|checking your browser/i.test(sample) ||
            /um momento/i.test(document.title || "");
        return {
            hasPagination: Boolean(pagination),
            currentPage: Number.isFinite(pageNum) && pageNum > 0 ? pageNum : null,
            searching,
            hasCnpj: cnpjRe.test(sample),
            totalHint,
            emptyHint,
            blocked,
        };
    });
}
async function findSearchButtonPoint(page) {
    return page.evaluate(() => {
        const visible = (el) => {
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return (r.width > 0 &&
                r.height > 0 &&
                s.display !== "none" &&
                s.visibility !== "hidden");
        };
        const candidates = Array.from(document.querySelectorAll("button, a, [role='button']"));
        const button = candidates.find((el) => {
            const text = String(el.textContent || "")
                .replace(/\s+/g, " ")
                .trim()
                .toLowerCase();
            return visible(el) && (text === "pesquisar" || text === "buscar");
        });
        if (!button)
            return null;
        const r = button.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
}
/**
 * Dispara SEARCH sem locator.click (evita actionability/auto-wait que trava no Xvfb).
 * AÇÃO ≠ CONFIRMAÇÃO — o caller deve chamar waitForSearchTransition em seguida.
 */
async function dispatchSearchClick(page, onProgress) {
    const point = await findSearchButtonPoint(page);
    if (!point) {
        onProgress?.("SEARCH: botão não encontrado — tentando Enter…");
        await page.keyboard.press("Enter").catch(() => undefined);
        return;
    }
    onProgress?.(`SEARCH: disparando pesquisa em (${Math.round(point.x)}, ${Math.round(point.y)})…`);
    if (page.mouse?.click) {
        await page.mouse.click(point.x, point.y);
        return;
    }
    // Fallback raro: clique DOM sem locator Playwright.
    await page.evaluate(() => {
        const visible = (el) => {
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
        };
        const candidates = Array.from(document.querySelectorAll("button, a, [role='button']"));
        const button = candidates.find((el) => {
            const text = String(el.textContent || "")
                .replace(/\s+/g, " ")
                .trim()
                .toLowerCase();
            return visible(el) && (text === "pesquisar" || text === "buscar");
        });
        button?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    });
}
async function waitForSearchTransition(page, timeoutMs, onProgress, shouldAbort) {
    const started = Date.now();
    const deadline = started + Math.max(5000, timeoutMs);
    let lastPulse = 0;
    while (Date.now() < deadline) {
        if (shouldAbort?.())
            throw new Error("__MLC_JOB_ABORTED__");
        const alive = await rendererProbe(page, 3000);
        if (!alive)
            return { kind: "renderer-unresponsive" };
        const state = await readSearchState(page).catch(() => null);
        if (!state) {
            const stillAlive = await rendererProbe(page, 3000);
            if (!stillAlive)
                return { kind: "renderer-unresponsive" };
            await page.waitForTimeout(400);
            continue;
        }
        if (state.blocked)
            return { kind: "blocked" };
        if (state.hasPagination || state.hasCnpj || (state.totalHint != null && state.totalHint > 0)) {
            return { kind: "results", total: state.totalHint };
        }
        if (state.emptyHint && !state.searching)
            return { kind: "empty" };
        const elapsed = Math.round((Date.now() - started) / 1000);
        const budget = Math.round(timeoutMs / 1000);
        if (elapsed - lastPulse >= 5) {
            lastPulse = elapsed;
            onProgress?.(state.searching
                ? `SEARCH: portal ainda processando — ${elapsed}s/${budget}s`
                : `SEARCH: aguardando resposta do portal — ${elapsed}s/${budget}s`);
        }
        await page.waitForTimeout(500);
    }
    const alive = await rendererProbe(page, 3000);
    if (!alive)
        return { kind: "renderer-unresponsive" };
    const finalState = await readSearchState(page).catch(() => null);
    if (finalState?.hasPagination || finalState?.hasCnpj) {
        return { kind: "results", total: finalState.totalHint };
    }
    if (finalState?.searching) {
        // Grace: mais 30s se ainda há loading.
        const graceDeadline = Date.now() + 30000;
        while (Date.now() < graceDeadline) {
            if (shouldAbort?.())
                throw new Error("__MLC_JOB_ABORTED__");
            if (!(await rendererProbe(page, 3000)))
                return { kind: "renderer-unresponsive" };
            const st = await readSearchState(page).catch(() => null);
            if (st?.hasPagination || st?.hasCnpj)
                return { kind: "results", total: st.totalHint };
            if (st && !st.searching)
                break;
            const g = Math.round((Date.now() - started) / 1000);
            onProgress?.(`SEARCH: grace loading — ${g}s`);
            await page.waitForTimeout(500);
        }
    }
    return { kind: "timeout-responsive" };
}
/** @deprecated use waitForSearchTransition — mantido para next-page short waits */
async function waitForPortalSearchResults(page, timeoutMs = 12000, onProgress) {
    const result = await waitForSearchTransition(page, timeoutMs, onProgress);
    if (result.kind === "renderer-unresponsive") {
        throw new RendererUnresponsiveError("waitForPortalSearchResults");
    }
}
async function fillByLabel(page, labels, value) {
    if (!value)
        return;
    for (const label of labels) {
        const input = page
            .locator(`xpath=//label[contains(${xpathLower()}, '${label.toLowerCase()}')]/following::input[1]`)
            .first();
        if ((await input.count()) > 0) {
            try {
                await input.click({ timeout: 4000 });
                await input.fill(value);
            }
            catch (error) {
                if (isChromiumTargetCrash(error))
                    throw error;
                await page
                    .evaluate(({ needle, val }) => {
                    const labs = Array.from(document.querySelectorAll("label"));
                    const lab = labs.find((el) => (el.textContent || "").toLowerCase().includes(needle));
                    const el = lab
                        ? lab.parentElement?.querySelector("input") ||
                            lab.nextElementSibling
                        : null;
                    const inputEl = el && el.tagName === "INPUT"
                        ? el
                        : document.querySelector(`input[placeholder*="${needle}" i]`);
                    if (!inputEl)
                        return false;
                    inputEl.focus();
                    const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
                    proto?.set?.call(inputEl, val);
                    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
                    inputEl.dispatchEvent(new Event("change", { bubbles: true }));
                    return true;
                }, { needle: label.toLowerCase(), val: value })
                    .catch(() => false);
            }
            return;
        }
    }
    const placeholder = page
        .locator(labels.map((label) => `input[placeholder*="${label}" i], input[name*="${label}" i]`).join(", "))
        .first();
    if ((await placeholder.count()) > 0) {
        try {
            await placeholder.fill(value);
        }
        catch (error) {
            if (isChromiumTargetCrash(error))
                throw error;
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
async function findCnaeSearchInput(page, timeoutMs = 10000) {
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
            if ((await loc.count()) === 0)
                continue;
            if (!(await loc.isVisible().catch(() => false)))
                continue;
            return loc;
        }
        await page.waitForTimeout(250);
    }
    for (const sel of candidates) {
        const loc = page.locator(sel).last();
        if ((await loc.count()) > 0)
            return loc;
    }
    return null;
}
async function tryOpenCnaePicker(page) {
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
        if ((await el.count()) === 0)
            continue;
        if (!(await el.isVisible().catch(() => false)))
            continue;
        await el.scrollIntoViewIfNeeded().catch(() => undefined);
        await el.click({ timeout: 8000, force: true }).catch(() => undefined);
        await page.waitForTimeout(500);
        const search = await findCnaeSearchInput(page, 2500);
        if (search)
            return true;
    }
    return false;
}
async function markCnaeOption(page, code) {
    const rowById = page.locator(`input[type="checkbox"][id*="${code}"]`).first();
    const rowByLabel = page
        .locator(`xpath=//label[contains(normalize-space(.), '${code}')]//input[@type='checkbox'] | //li[contains(normalize-space(.), '${code}')]//input[@type='checkbox'] | //div[contains(@class,'checkbox') or contains(@class,'control')][contains(normalize-space(.), '${code}')]//input[@type='checkbox']`)
        .first();
    for (const box of [rowById, rowByLabel]) {
        if ((await box.count()) === 0)
            continue;
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
        .locator(`xpath=//*[self::li or self::div or self::button or self::a][contains(normalize-space(.), '${code}')][1]`)
        .first();
    if ((await option.count()) > 0 && (await option.isVisible().catch(() => false))) {
        await option.click({ force: true }).catch(() => undefined);
        return true;
    }
    return false;
}
async function readCnaeSelectedCount(page) {
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
async function selectAtividadePrincipalCnae(page, rawCode, onProgress, shouldAbort) {
    const code = String(rawCode || "").replace(/\D/g, "");
    if (!code)
        return;
    const report = (phase) => {
        onProgress?.(`Pesquisando: CNAE ${code} — ${phase}`);
    };
    const aborted = () => Boolean(shouldAbort?.());
    await dismissBlockingPortalOverlays(page).catch(() => undefined);
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find((b) => /^Fechar$/i.test(String(b.textContent || "").trim()));
        btn?.click();
    });
    await page.waitForTimeout(200);
    if (aborted())
        throw new Error(`CNAE ${code}: abortado.`);
    report("abrindo modal…");
    await page.evaluate(() => {
        const visible = (el) => {
            const h = el;
            const s = window.getComputedStyle(h);
            return (s.display !== "none" &&
                s.visibility !== "hidden" &&
                (h.offsetParent !== null || s.position === "fixed"));
        };
        const labels = Array.from(document.querySelectorAll("label")).filter((el) => {
            const t = String(el.textContent || "").replace(/\s+/g, " ").trim();
            return t.length > 0 && t.length < 80 && /Atividade\s+Principal\s*\(CNAE\)/i.test(t);
        });
        labels.find(visible)?.click();
        const textOpeners = Array.from(document.querySelectorAll("input")).filter((el) => {
            const i = el;
            const ph = String(i.placeholder || "").toLowerCase();
            return visible(i) && i.type === "text" && /c[oó]digo ou nome da atividade|atividade/.test(ph);
        });
        textOpeners[0]?.click();
    });
    report("aguardando campo de busca…");
    let searchReady = false;
    for (let poll = 0; poll < 20; poll += 1) {
        if (aborted())
            throw new Error(`CNAE ${code}: abortado.`);
        searchReady = await page.evaluate(() => {
            const visible = (el) => {
                const h = el;
                const s = window.getComputedStyle(h);
                return s.display !== "none" && s.visibility !== "hidden";
            };
            return Array.from(document.querySelectorAll("input")).some((el) => {
                const ph = String(el.placeholder || "").toLowerCase();
                const inModal = Boolean(el.closest('[role="dialog"], .modal, .o-modal, .modal-card, .modal-content'));
                return (visible(el) &&
                    (el.type === "search" || /atividade|cnae|c[oó]digo/.test(ph)) &&
                    (inModal || el.type === "search"));
            });
        });
        if (searchReady)
            break;
        // Re-clique leve a cada ~1s se o modal não abriu.
        if (poll > 0 && poll % 3 === 0) {
            await page.evaluate(() => {
                const lab = Array.from(document.querySelectorAll("label")).find((el) => {
                    const t = String(el.textContent || "").replace(/\s+/g, " ").trim();
                    return t.length > 0 && t.length < 80 && /Atividade\s+Principal\s*\(CNAE\)/i.test(t);
                });
                lab?.click();
            });
        }
        await page.waitForTimeout(300);
    }
    if (!searchReady) {
        throw new Error(`CNAE ${code}: modal de busca não abriu (search ausente).`);
    }
    report("digitando código…");
    const typed = await page.evaluate((cnae) => {
        const visible = (el) => {
            const h = el;
            const s = window.getComputedStyle(h);
            return s.display !== "none" && s.visibility !== "hidden";
        };
        const inputs = Array.from(document.querySelectorAll("input"));
        const score = (el) => {
            const ph = String(el.placeholder || "").toLowerCase();
            let s = 0;
            if (el.type === "search")
                s += 8;
            if (/atividade|cnae|c[oó]digo/.test(ph))
                s += 5;
            if (el.closest('[role="dialog"], .modal, .o-modal, .modal-card, .modal-content'))
                s += 10;
            if (!visible(el))
                s -= 20;
            if (el.type === "text" && !el.closest('[role="dialog"], .modal, .o-modal, .modal-card'))
                s -= 6;
            return s;
        };
        const ranked = inputs
            .map((el) => ({ el, s: score(el) }))
            .filter((x) => x.s >= 8)
            .sort((a, b) => b.s - a.s);
        const target = ranked[0]?.el;
        if (!target)
            return { ok: false };
        target.focus();
        const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
        proto?.set?.call(target, "");
        target.dispatchEvent(new Event("input", { bubbles: true }));
        proto?.set?.call(target, cnae);
        target.dispatchEvent(new Event("input", { bubbles: true }));
        target.dispatchEvent(new Event("change", { bubbles: true }));
        target.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: cnae.slice(-1) || "0" }));
        return { ok: true, value: String(target.value || "") };
    }, code);
    if (!typed?.ok || !String(typed.value || "").includes(code)) {
        throw new Error(`CNAE ${code}: não digitou no campo de busca.`);
    }
    report("marcando checkbox…");
    let marked = false;
    for (let poll = 0; poll < 25; poll += 1) {
        if (aborted())
            throw new Error(`CNAE ${code}: abortado.`);
        marked = await page.evaluate((cnae) => {
            const boxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
            const box = boxes.find((b) => String(b.id || "").startsWith(cnae) ||
                String(b.id || "").includes(`${cnae} `) ||
                String(b.id || "").includes(`${cnae}-`) ||
                String(b.closest("label")?.textContent || "").includes(cnae));
            if (!box)
                return false;
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
        if (marked)
            break;
        await page.waitForTimeout(250);
    }
    if (!marked) {
        throw new Error(`CNAE ${code}: checkbox da atividade não apareceu após filtrar.`);
    }
    report("fechando modal…");
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find((b) => /^(Fechar|Concluir|Aplicar|OK)$/i.test(String(b.textContent || "").trim()));
        btn?.click();
    });
    await page.waitForTimeout(300);
    onProgress?.(`Pesquisando: CNAE ${code} selecionado.`);
}
/**
 * Retorna true se selecionou. false = não trava a extração (demais filtros seguem).
 * Budget total curto no Xvfb (default ~50s em 2 tentativas).
 */
async function selectAtividadePrincipalCnaeWithTimeout(page, rawCode, onProgress, timeoutMs = 25000) {
    const code = String(rawCode || "").replace(/\D/g, "");
    if (!code)
        return true;
    const attempts = Math.max(1, Math.min(3, Math.round(Number(process.env.CASADOSDADOS_CNAE_RETRIES || 2) || 2)));
    const perAttemptMs = Math.max(12000, Math.min(35000, Math.round(Number(timeoutMs) || 25000)));
    let lastErr = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        let beat;
        let timer;
        let aborted = false;
        const started = Date.now();
        beat = setInterval(() => {
            const sec = Math.round((Date.now() - started) / 1000);
            onProgress?.(`Pesquisando: selecionando CNAE ${code}… tentativa ${attempt}/${attempts} (${sec}s)`);
        }, 3000);
        try {
            await Promise.race([
                selectAtividadePrincipalCnae(page, code, onProgress, () => aborted),
                new Promise((_, reject) => {
                    timer = setTimeout(() => {
                        aborted = true;
                        reject(new Error(`CNAE ${code}: timeout ${Math.round(perAttemptMs / 1000)}s ao selecionar no portal.`));
                    }, perAttemptMs);
                }),
            ]);
            return true;
        }
        catch (err) {
            lastErr = err instanceof Error ? err : new Error(String(err));
            onProgress?.(`Pesquisando: CNAE ${code} falhou (tentativa ${attempt}/${attempts}) — ${lastErr.message.slice(0, 100)}`);
            await dismissBlockingPortalOverlays(page).catch(() => undefined);
            await page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll("button")).find((b) => /^Fechar$/i.test(String(b.textContent || "").trim()));
                btn?.click();
            });
            await page.waitForTimeout(400 + attempt * 200);
        }
        finally {
            aborted = true;
            if (beat)
                clearInterval(beat);
            if (timer)
                clearTimeout(timer);
        }
    }
    onProgress?.(`Pesquisando: CNAE ${code} não concluído (${lastErr?.message?.slice(0, 80) || "falha"}) — seguindo sem travar…`);
    return false;
}
async function setCheckboxByLabel(page, label, checked) {
    const needle = label.toLowerCase();
    // Só checkbox DENTRO do label — never preceding/following (pega opção de autocomplete CNAE).
    // Timeout curto: xpath no Xvfb não pode segurar a sessão 45s.
    const box = page
        .locator(`xpath=//label[contains(${xpathLower()}, '${needle}')]//input[@type='checkbox']`)
        .first();
    const n = await box.count().catch(() => 0);
    if (!n)
        return;
    const visible = await box.isVisible().catch(() => false);
    if (!visible)
        return;
    const isChecked = await box.isChecked().catch(() => false);
    if (checked && !isChecked) {
        await box.check({ force: true }).catch(() => undefined);
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
async function setToggleByLabel(page, label, enabled) {
    if (!enabled)
        return;
    const needle = label.toLowerCase().replace(/"/g, "");
    await Promise.race([
        page.evaluate(({ needle, want }) => {
            const labels = Array.from(document.querySelectorAll("label"));
            const lab = labels.find((el) => {
                const t = String(el.textContent || "")
                    .replace(/\s+/g, " ")
                    .trim()
                    .toLowerCase();
                return t === needle || (t.includes(needle) && t.length < 90);
            });
            if (!lab)
                return false;
            const box = (lab.previousElementSibling &&
                lab.previousElementSibling.matches?.('input[type="checkbox"]')
                ? lab.previousElementSibling
                : null) ||
                lab.parentElement?.querySelector('input[type="checkbox"]') ||
                lab.querySelector('input[type="checkbox"]');
            if (!box)
                return false;
            if (Boolean(box.checked) === want)
                return true;
            const control = lab.closest(".switch") ||
                lab.parentElement;
            (control || lab).click();
            if (Boolean(box.checked) !== want)
                box.click();
            return true;
        }, { needle, want: true }),
        page.waitForTimeout(2500).then(() => false),
    ]).catch(() => false);
}
/** Liga vários switches numa única ida ao DOM — só labels ativos. */
async function enableTogglesFast(page, labels) {
    const needles = labels
        .map((l) => String(l || "").toLowerCase().replace(/"/g, "").trim())
        .filter(Boolean);
    if (!needles.length)
        return;
    await Promise.race([
        page.evaluate((needlesIn) => {
            const labels = Array.from(document.querySelectorAll("label"));
            for (const needle of needlesIn) {
                const lab = labels.find((el) => {
                    const t = String(el.textContent || "")
                        .replace(/\s+/g, " ")
                        .trim()
                        .toLowerCase();
                    return t === needle || (t.includes(needle) && t.length < 90);
                });
                if (!lab)
                    continue;
                const box = (lab.previousElementSibling &&
                    lab.previousElementSibling.matches?.('input[type="checkbox"]')
                    ? lab.previousElementSibling
                    : null) ||
                    lab.parentElement?.querySelector('input[type="checkbox"]') ||
                    lab.querySelector('input[type="checkbox"]');
                if (!box)
                    continue;
                if (box.checked)
                    continue;
                const control = lab.closest(".switch") ||
                    lab.parentElement;
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
async function applyFilters(page, filters, onProgress) {
    const step = (label) => {
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
            .locator(`xpath=//label[contains(., 'Tipo de Pesquisa')]/following::select[1] | //label[contains(., 'Tipo de Pesquisa')]/following::*[contains(@class,'select')][1]//input`)
            .first();
        if ((await select.count().catch(() => 0)) > 0) {
            try {
                await select.selectOption(filters.tipoPesquisa);
            }
            catch {
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
    step(cnaeCode
        ? `selecionando CNAE ${cnaeCode}…`
        : "aplicando filtros (CNAE, situação, celular)…");
    if (cnaeCode) {
        await page.waitForTimeout(100 + Math.floor(Math.random() * 200));
    }
    const cnaeOk = await selectAtividadePrincipalCnaeWithTimeout(page, String(filters.atividadePrincipalCnae || "").trim(), onProgress, Math.max(20000, Math.min(35000, Math.round(Number(process.env.CASADOSDADOS_CNAE_TIMEOUT_MS || 25000) || 25000))));
    if (cnaeCode && !cnaeOk) {
        step(`CNAE ${cnaeCode} pulado após falha — demais filtros ativos seguem…`);
    }
    else if (cnaeCode && cnaeOk) {
        step(`CNAE ${cnaeCode} ok — aplicando só filtros ativos…`);
    }
    // Fecha residual do modal CNAE antes dos switches.
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find((b) => /^Fechar$/i.test(String(b.textContent || "").trim()));
        btn?.click();
    });
    await page.waitForTimeout(150);
    // Apenas preenchimentos com valor (fillByLabel já no-op se vazio — mas evitamos step falso).
    const textJobs = [
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
    const activeSwitches = [];
    if (filters.incluirAtividadeSecundaria)
        activeSwitches.push("incluir atividade secundária");
    if (filters.somenteMei)
        activeSwitches.push("somente mei");
    if (filters.excluirMei)
        activeSwitches.push("excluir mei");
    if (filters.somenteMatriz)
        activeSwitches.push("somente matriz");
    if (filters.somenteFilial)
        activeSwitches.push("somente filial");
    if (filters.empresasDoSimples)
        activeSwitches.push("empresas do simples");
    if (filters.excluirEmpresasDoSimples)
        activeSwitches.push("excluir empresas do simples");
    if (filters.comContatoTelefone)
        activeSwitches.push("com contato de telefone");
    if (filters.somenteFixo)
        activeSwitches.push("somente fixo");
    if (filters.somenteCelular)
        activeSwitches.push("somente celular");
    if (filters.comEmail)
        activeSwitches.push("com e-mail");
    if (filters.excluirEmpresasVisualizadas)
        activeSwitches.push("excluir empresas visualizadas");
    if (filters.excluirEmailContab) {
        activeSwitches.push('excluir empresas que no e-mail contenham "contab"');
    }
    if (activeSwitches.length) {
        step(`ativando ${activeSwitches.length} switch(es): ${activeSwitches.slice(0, 3).join(", ")}${activeSwitches.length > 3 ? "…" : ""}`);
        await enableTogglesFast(page, activeSwitches);
    }
    else {
        step("sem switches extras — pronto para pesquisar…");
    }
    step("filtros aplicados — pronto para pesquisar…");
}
function parseResultTotalFromText(text) {
    const patterns = [
        /pesquisa\s+retornou\s+([\d.\s]+)\s+empresas/i,
        /retornou\s+([\d.\s]+)\s+empresas/i,
        /([\d.]+)\s+empresas\s+encontradas/i,
    ];
    for (const re of patterns) {
        const m = text.match(re);
        if (!m)
            continue;
        const n = Number(String(m[1]).replace(/\./g, "").replace(/\s/g, ""));
        if (Number.isFinite(n) && n >= 0)
            return n;
    }
    return null;
}
/**
 * Headless Chromium puro é bloqueado pelo anti-bot do portal.
 * V02: janela visível (HEADLESS=0 ou default em v01/v02).
 * Produção Docker: Xvfb define DISPLAY → usamos headed virtual (igual V02).
 * Só força headless real com CASADOSDADOS_TRUE_HEADLESS=1 (diagnóstico).
 */
function resolveCasaDosDadosHeadless() {
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
    if (raw === "1" || raw === "true" || raw === "yes")
        return true;
    if (raw === "0" || raw === "false" || raw === "no")
        return false;
    const wabaEnv = String(process.env.WABA_ENV || "").trim().toLowerCase();
    return wabaEnv !== "v01" && wabaEnv !== "v02";
}
async function scrapeCasaDosDadosLeads(filters, onProgress, options) {
    // Coleta somente via robô na tela do portal (sem API).
    // Opt-in raro: CASADOSDADOS_USE_API=1 + CASADOSDADOS_API_KEY
    if (String(process.env.CASADOSDADOS_USE_API || "").trim() === "1") {
        const { hasCasaDosDadosApiKey, fetchCasaDosDadosLeadsViaApi } = await Promise.resolve().then(() => __importStar(require("./waba-leads-cnpj-casadosdados-api.adapter")));
        if (hasCasaDosDadosApiKey()) {
            const leads = await fetchCasaDosDadosLeadsViaApi(filters, onProgress);
            return { leads, scrapeCompleted: true, doneReason: "api" };
        }
    }
    const maxAttempts = Math.max(1, Math.round(Number(process.env.CASADOSDADOS_SCRAPE_RETRIES || 8) || 8));
    let resumeFrom = Math.max(1, Math.round(Number(options?.resumeFromPage || 1) || 1));
    let lastErr;
    let sessionStorageState = options?.storageState;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            if (attempt > 1) {
                onProgress?.(`RECOVER: Chromium caiu — tentativa ${attempt}/${maxAttempts} · próxima página ${resumeFrom}`);
            }
            else if (resumeFrom > 1) {
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
        }
        catch (error) {
            lastErr = error;
            const msg = error instanceof Error ? error.message : String(error);
            // Só reabre Chromium se Target crashed / disconnect / renderer morto.
            if (!requiresBrowserRecovery(error)) {
                throw error instanceof Error ? error : new Error(msg);
            }
            onProgress?.(`RECOVER: renderer/browser morto — checkpoint página ${resumeFrom} preservado…`);
            if (attempt >= maxAttempts)
                break;
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
async function scrapeCasaDosDadosLeadsOnce(filters, onProgress, options) {
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
        : Math.min(slowMoCap, Math.max(0, Math.round(Number(process.env.CASADOSDADOS_SLOWMO_MS || 0) || 0)));
    let phase = "BOOT";
    let phaseStartedAt = Date.now();
    /** Heartbeat = tempo na fase; NÃO fingir progresso. */
    let sessionPhase = "BOOT…";
    const setPhase = (next, detail) => {
        phase = next;
        phaseStartedAt = Date.now();
        const msg = `${next}: ${detail}`;
        sessionPhase = msg;
        onProgress?.(msg);
        console.log(JSON.stringify({
            event: "LEADS_SCRAPE",
            phase: next,
            detail,
            ts: new Date().toISOString(),
        }));
    };
    onProgress?.(headless
        ? "BOOT: iniciando Chromium (headless real)…"
        : String(process.env.DISPLAY || "").trim()
            ? "BOOT: abrindo Casa dos Dados (Xvfb)…"
            : "BOOT: abrindo janela do Casa dos Dados…");
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
    }
    catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        if (/Executable doesn't exist|browserType\.launch/i.test(detail)) {
            throw new Error("Chromium do Playwright ausente no servidor. No Docker: rode `npx playwright install --with-deps chromium` na imagem (ver Dockerfile) e faça Redeploy.");
        }
        throw error;
    }
    const resumeFromPageLog = Math.max(1, Math.round(Number(options?.resumeFromPage || 1) || 1));
    browser.on("disconnected", () => {
        console.error(`[Leads PJ] BROWSER_DISCONNECTED page=${resumeFromPageLog}`);
    });
    /** Fecha Chromium só se shouldAbort (exclusão do usuário) — não por demora. */
    const abortWatch = setInterval(() => {
        if (!options?.shouldAbort?.())
            return;
        console.error(`[Leads PJ] SCRAPE_ABORT_CLOSE page=${resumeFromPageLog}`);
        void browser.close().catch(() => undefined);
    }, 4000);
    /** Heartbeat = tempo na fase; NÃO fingir progresso. */
    const markPhase = (message) => {
        sessionPhase = message;
        phaseStartedAt = Date.now();
        onProgress?.(message);
    };
    const sessionKeepAlive = setInterval(() => {
        const elapsed = Math.max(0, Math.round((Date.now() - phaseStartedAt) / 1000));
        const base = String(sessionPhase || phase).replace(/\s*—\s*\d+s(?:\/\d+s)?\s*$/i, "").trim();
        onProgress?.(`${base} — ${elapsed}s`);
    }, 10000);
    try {
        const contextOptions = {
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
        }
        else {
            setPhase("LOGIN", "sessão restaurada (storageState)");
        }
        try {
            const state = await context.storageState();
            await options?.onStorageState?.(state);
        }
        catch {
            /* ignore */
        }
        setPhase("FILTERS", "abrindo tela de pesquisa…");
        await gotoWithRetry(page, PORTAL_SEARCH_URL, { waitUntil: "domcontentloaded" });
        await waitPastCloudflare(page, { onProgress, stage: "pesquisa" });
        await page.waitForTimeout(1500);
        setPhase("FILTERS", "aplicando filtros (CNAE, situação, celular)…");
        await applyFilters(page, filters, (msg) => {
            sessionPhase = `FILTERS: ${msg}`;
            phaseStartedAt = Date.now();
            onProgress?.(sessionPhase);
        });
        // Captura total da API (se houver). CNPJs vêm da tela — não pré-carregar do JSON.
        let interceptedTotal = null;
        page.on("response", async (res) => {
            try {
                const url = res.url();
                if (!/cnpj\/pesquisa|pesquisa/i.test(url))
                    return;
                const ct = String(res.headers()["content-type"] || "");
                if (!ct.includes("json"))
                    return;
                const json = (await res.json().catch(() => null));
                if (!json)
                    return;
                if (typeof json.total === "number")
                    interceptedTotal = json.total;
            }
            catch {
                /* ignore — fonte principal é o texto da tela */
            }
        });
        // Garante modal CNAE fechado antes de pesquisar (timeout curto — não travar a sessão).
        setPhase("SEARCH", "fechando modal CNAE (se aberto)…");
        try {
            await Promise.race([
                (async () => {
                    const fecharCnae = page.locator('button:has-text("Fechar")').first();
                    if ((await fecharCnae.count()) > 0 && (await fecharCnae.isVisible().catch(() => false))) {
                        await fecharCnae.click().catch(() => undefined);
                        await page.waitForTimeout(300);
                    }
                })(),
                page.waitForTimeout(4000),
            ]);
        }
        catch {
            /* segue para Pesquisar */
        }
        const searchTimeoutMs = Math.max(15000, Math.round(Number(process.env.CASADOSDADOS_SEARCH_TIMEOUT_MS || 90000) || 90000));
        const runSearchOnce = async () => {
            setPhase("SEARCH", "disparando pesquisa (mouse click)…");
            await dispatchSearchClick(page, (msg) => {
                sessionPhase = msg;
                phaseStartedAt = Date.now();
                onProgress?.(msg);
            });
            setPhase("SEARCH", "clique enviado; aguardando resposta do portal…");
            return waitForSearchTransition(page, searchTimeoutMs, (msg) => {
                sessionPhase = msg;
                onProgress?.(msg);
            }, options?.shouldAbort);
        };
        let searchResult = await runSearchOnce();
        if (searchResult.kind === "timeout-responsive") {
            setPhase("SEARCH", "timeout com renderer saudável — 1 retry na mesma Page…");
            searchResult = await runSearchOnce();
        }
        if (searchResult.kind === "renderer-unresponsive") {
            throw new RendererUnresponsiveError("SEARCH");
        }
        if (searchResult.kind === "blocked") {
            throw new Error("PORTAL_BLOCKED — Cloudflare ou desafio de segurança na pesquisa.");
        }
        if (searchResult.kind === "timeout-responsive") {
            throw new Error("SEARCH_TIMEOUT_RESPONSIVE — portal não retornou resultados em 90s+grace; Chromium vivo (sem recovery).");
        }
        if (searchResult.kind === "empty") {
            setPhase("DONE", "pesquisa sem resultados");
            await context.close();
            return { leads: [], scrapeCompleted: true, doneReason: "SEARCH_EMPTY" };
        }
        // Sem locator("body").filter(hasText) — reavalia o DOM inteiro e derruba o renderer.
        const pageText = await readResultsSampleText(page, 12000);
        const portalTotal = interceptedTotal ??
            searchResult.total ??
            parseResultTotalFromText(pageText);
        if (portalTotal != null) {
            setPhase("COPY", `retornou ${portalTotal.toLocaleString("pt-BR")} empresas — iniciando cópia…`);
        }
        else {
            setPhase("COPY", "lendo cards na tela (CNPJ + Razão Social)…");
        }
        const collected = new Map();
        let doneReason = "UNKNOWN";
        let scrapeCompleted = false;
        // NÃO pré-carregar interceptedRows aqui: se a API já encher `collected`,
        // a página 1 fica com added=0 e o robô encerra a paginação sem ir à página 2
        // (Seguro 14: 20 CNPJs da pág.1 = já usados → pool vazio).
        const readScreenCards = async () => readScreenCardsLight(page);
        const firstCnpjOf = (rows) => (rows[0] ? (0, waba_leads_cnpj_repository_1.normalizeCnpjDigits)(rows[0][0]) : "");
        const readCurrentPageNumber = async () => page.evaluate(() => {
            const active = document.querySelector([
                'nav[data-oruga="pagination"] button[aria-current="page"]',
                'nav[data-oruga="pagination"] button.pagination-link.is-current',
                'nav[data-oruga="pagination"] button[aria-current="true"]',
            ].join(", "));
            const n = Number(String(active?.textContent || "").trim());
            return Number.isFinite(n) && n > 0 ? n : 1;
        });
        const portalUiMaxPage = resolvePortalUiMaxPage();
        /** Lê página ativa Oruga (is-current / aria-current). */
        const waitUntilPage = async (expectedPage, timeoutMs) => {
            const deadline = Date.now() + Math.max(500, timeoutMs);
            while (Date.now() < deadline) {
                if (options?.shouldAbort?.())
                    return false;
                const cur = await readCurrentPageNumber();
                if (cur === expectedPage)
                    return true;
                await page.waitForTimeout(200);
            }
            return false;
        };
        /**
         * Salto de página via DOM nativo (sem locator Playwright) — mais estável no Xvfb.
         * Oruga: botões aria-label "Página N." / texto N / input numérico se existir.
         */
        const jumpToPageDom = async (target) => {
            const clicked = await page
                .evaluate((t) => {
                const nav = document.querySelector('nav[data-oruga="pagination"]');
                if (!nav)
                    return { ok: false, how: "no-nav" };
                const tryClick = (el) => {
                    if (!el)
                        return false;
                    const b = el;
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
                    if (label === `Página ${t}.` ||
                        label === `Página ${t}` ||
                        new RegExp(`Página\\s+${t}\\b`, "i").test(label) ||
                        text === String(t)) {
                        if (tryClick(b))
                            return { ok: true, how: "button" };
                    }
                }
                const input = nav.querySelector('input[type="number"], input.input, input[class*="pagination"]');
                if (input) {
                    input.focus();
                    input.value = String(t);
                    input.dispatchEvent(new Event("input", { bubbles: true }));
                    input.dispatchEvent(new Event("change", { bubbles: true }));
                    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
                    input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
                    return { ok: true, how: "input" };
                }
                return { ok: false, how: "miss" };
            }, target)
                .catch(() => ({ ok: false, how: "err" }));
            if (!clicked.ok)
                return false;
            return waitUntilPage(target, 12000);
        };
        /**
         * Avança 1 página: DOM click no next + confirmação por número OU 1º CNPJ.
         * Timeout duro por passo (não fica 60s+ parado).
         */
        const goToNextResultsPage = async (previousFirstCnpj, fromPage) => {
            const targetPage = fromPage + 1;
            markPhase(`Copiando: avançando paginação ${fromPage} → ${targetPage}…`);
            const clicked = await page
                .evaluate(() => {
                const nav = document.querySelector('nav[data-oruga="pagination"]');
                if (!nav)
                    return false;
                const next = nav.querySelector("button.pagination-next:not([disabled]):not(.is-disabled)") ||
                    nav.querySelector('button[aria-label*="Pŕoxima"], button[aria-label*="Próxima"], button[aria-label*="proxima" i]');
                if (!next)
                    return false;
                if (next.disabled ||
                    next.classList.contains("is-disabled") ||
                    next.getAttribute("aria-disabled") === "true") {
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
                    if ((await btn.count()) === 0)
                        continue;
                    if (!(await btn.isVisible().catch(() => false)))
                        continue;
                    await btn.click({ force: true, timeout: 4000 }).catch(() => null);
                    any = true;
                    break;
                }
                if (!any)
                    return false;
            }
            const pageOk = await waitUntilPage(targetPage, 10000);
            if (pageOk) {
                await waitForPortalSearchResults(page, 12000, (msg) => {
                    sessionPhase = msg;
                    markPhase(msg);
                });
                return true;
            }
            if (previousFirstCnpj) {
                const deadline = Date.now() + 8000;
                while (Date.now() < deadline) {
                    const nextFirst = await readFirstVisibleCnpjDigits(page);
                    if (nextFirst && nextFirst !== previousFirstCnpj)
                        return true;
                    await page.waitForTimeout(250);
                }
            }
            return false;
        };
        /**
         * Posiciona na página alvo. Se falhar, retorna false (caller reinicia da 1 — processo não para).
         */
        const goToResultsPage = async (targetPage) => {
            const target = Math.max(1, Math.round(targetPage || 1));
            if (target > portalUiMaxPage)
                return false;
            let current = await readCurrentPageNumber();
            if (current === target)
                return true;
            markPhase(`Copiando: salto DOM para página ${target} (UI em ${current})…`);
            if (await jumpToPageDom(target))
                return true;
            // Clica no maior botão numérico visível ≤ target (aproxima sem 1→2→3… lento).
            for (let hop = 0; hop < 8; hop += 1) {
                current = await readCurrentPageNumber();
                if (current === target)
                    return true;
                if (current > target)
                    break;
                const best = await page
                    .evaluate((t) => {
                    const nav = document.querySelector('nav[data-oruga="pagination"]');
                    if (!nav)
                        return 0;
                    let bestN = 0;
                    for (const b of Array.from(nav.querySelectorAll("button.pagination-link"))) {
                        const text = String(b.textContent || "").trim();
                        const n = Number(text);
                        if (!Number.isFinite(n) || n <= 0 || n > t)
                            continue;
                        const btn = b;
                        if (btn.disabled || btn.classList.contains("is-disabled"))
                            continue;
                        if (n > bestN)
                            bestN = n;
                    }
                    if (bestN <= 0)
                        return 0;
                    for (const b of Array.from(nav.querySelectorAll("button.pagination-link"))) {
                        if (String(b.textContent || "").trim() === String(bestN)) {
                            b.click();
                            return bestN;
                        }
                    }
                    return 0;
                }, target)
                    .catch(() => 0);
                if (best > 0) {
                    markPhase(`Copiando: aproximando via botão ${best} (alvo ${target})…`);
                    await waitUntilPage(best, 10000);
                    if (await jumpToPageDom(target))
                        return true;
                    continue;
                }
                break;
            }
            // Último recurso: poucos "next" com teto baixo (não 25×60s).
            const maxSteps = Math.max(1, Math.min(12, Math.round(Number(process.env.CASADOSDADOS_MAX_SEQUENTIAL_RESUME_STEPS || 12) || 12)));
            let guard = 0;
            while ((current = await readCurrentPageNumber()) < target && guard < maxSteps) {
                if (options?.shouldAbort?.())
                    return false;
                guard += 1;
                markPhase(`Copiando: posicionando retomada — passo ${guard}/${maxSteps} (UI pág. ${current} → ${target})…`);
                const prev = await readFirstVisibleCnpjDigits(page);
                const ok = await goToNextResultsPage(prev, current);
                if (!ok) {
                    markPhase(`Copiando: paginação não avançou no passo ${guard} (UI ${current}) — abortando posicionamento.`);
                    return false;
                }
                if (await jumpToPageDom(target))
                    return true;
            }
            current = await readCurrentPageNumber();
            return current === target;
        };
        let pagesToFetch = maxPagesCap > 0 ? maxPagesCap : Number.MAX_SAFE_INTEGER;
        if (portalTotal != null) {
            const totalPagesAvailable = Math.max(1, Math.ceil(portalTotal / PORTAL_PAGE_SIZE));
            pagesToFetch =
                maxPagesCap > 0
                    ? Math.min(maxPagesCap, totalPagesAvailable)
                    : totalPagesAvailable;
            markPhase(`Portal: ${portalTotal.toLocaleString("pt-BR")} empresas · ${PORTAL_PAGE_SIZE}/página · ${totalPagesAvailable.toLocaleString("pt-BR")} página(s) — copiando ${maxPagesCap > 0 ? `até ${pagesToFetch}` : "todas"}…`);
        }
        else if (maxPagesCap <= 0) {
            markPhase(`Copiando: total do portal não lido — avançando página a página até acabar (sem teto)…`);
        }
        // UI Oruga não navega além de portalUiMaxPage — evita loop Chromium em 1001+.
        if (pagesToFetch > portalUiMaxPage) {
            markPhase(`Copiando: teto da UI do portal = página ${portalUiMaxPage} (além disso a paginação não avança).`);
            pagesToFetch = portalUiMaxPage;
        }
        let startPage = Math.max(1, Math.round(Number(options?.resumeFromPage || 1) || 1));
        if (startPage > pagesToFetch) {
            markPhase(startPage > portalUiMaxPage
                ? `Copiando: checkpoint página ${startPage} além do teto da UI (${portalUiMaxPage}) — raspagem via portal encerrada; pool já arquivado será usado.`
                : `Copiando: checkpoint página ${startPage} além do total (${pagesToFetch}) — sessão sem páginas novas.`);
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
                markPhase(`COPY: falha ao posicionar pág. ${startPage} no Xvfb — reiniciando da página 1…`);
                startPage = 1;
                const backHome = await jumpToPageDom(1);
                if (!backHome) {
                    const cur = await readCurrentPageNumber();
                    if (cur !== 1) {
                        markPhase(`COPY: UI na pág. ${cur}; seguindo daqui (checkpoint será atualizado).`);
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
            const totalLabel = portalTotal != null ? ` de ${portalTotal.toLocaleString("pt-BR")}` : "";
            setPhase("COPY", `página ${pageIndex}/${pagesToFetch === Number.MAX_SAFE_INTEGER ? "?" : pagesToFetch}${totalLabel} · sessão ${collected.size.toLocaleString("pt-BR")} CNPJ(s)`);
            let rows = await readScreenCards();
            // Página vazia: relê na MESMA sessão (não fecha Chromium / não refaz CNAE).
            if (rows.length === 0) {
                for (let reread = 1; reread <= 3; reread += 1) {
                    markPhase(`COPY: página ${pageIndex} sem cards — relendo ${reread}/3 (mesma sessão)…`);
                    await page.waitForTimeout(reread === 1 ? 500 : 1000);
                    rows = await readScreenCards();
                    if (rows.length)
                        break;
                }
            }
            const pageFirst = firstCnpjOf(rows);
            let added = 0;
            const pageLeads = [];
            for (const cells of rows) {
                const lead = mapRowCells(cells);
                if (!lead)
                    continue;
                if (!collected.has(lead.cnpj)) {
                    collected.set(lead.cnpj, lead);
                    pageLeads.push(lead);
                    added += 1;
                }
            }
            markPhase(`COPY: página ${pageIndex} arquivada — +${added} / ${rows.length} cards · pool sessão ${collected.size.toLocaleString("pt-BR")} · próxima ${pageIndex + 1}`);
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
                    markPhase(`COPY: 3 páginas vazias seguidas (até pág. ${pageIndex}) — fim (${collected.size} CNPJs).`);
                    doneReason = "THREE_EMPTY_PAGES";
                    scrapeCompleted = true;
                    break;
                }
                markPhase(`COPY: página ${pageIndex} vazia — avançando para ${nextPage} (mesma Page)…`);
            }
            else {
                emptyStreak = 0;
            }
            if (nextPage > portalUiMaxPage) {
                markPhase(`COPY: atingiu teto UI (página ${portalUiMaxPage}) — encerrando raspagem.`);
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
                    markPhase(`COPY: retry paginação ${pageIndex}→${nextPage} (${retry}/3) — mesma sessão…`);
                    await page.waitForTimeout(600);
                    advanced =
                        (await goToNextResultsPage(pageFirst, pageIndex)) ||
                            (await jumpToPageDom(nextPage));
                    if (advanced)
                        break;
                }
            }
            if (!advanced) {
                const stillOn = await readCurrentPageNumber();
                const alive = await rendererProbe(page, 3000);
                if (!alive) {
                    throw new RendererUnresponsiveError(`COPY next ${pageIndex}→${nextPage}`);
                }
                // Soft: encerra com o já copiado — scrape incompleto (service mantém checkpoint).
                markPhase(`COPY: paginação stall em ${pageIndex} (UI ${stillOn}) — ${collected.size} CNPJs; sem reabrir portal.`);
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
                throw new Error(`Retomada na página ${startPage} não leu CNPJ/Razão Social — reconectar mantendo checkpoint/pool.`);
            }
            throw new Error("Robô não leu CNPJ/Razão Social na tela. Confirme login, filtros e se os cards aparecem (formato: 00.000.000/0000-00 - NOME). Se Cloudflare bloquear, use CASADOSDADOS_HEADLESS=0.");
        }
        setPhase("DONE", `${collected.size.toLocaleString("pt-BR")} CNPJ(s) · reason=${doneReason} · completed=${scrapeCompleted}`);
        return {
            leads: [...collected.values()],
            scrapeCompleted,
            doneReason,
        };
    }
    finally {
        clearInterval(abortWatch);
        clearInterval(sessionKeepAlive);
        await browser.close().catch(() => undefined);
    }
}
