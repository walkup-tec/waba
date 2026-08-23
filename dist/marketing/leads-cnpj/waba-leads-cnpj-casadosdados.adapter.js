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
 * CNAE só via DOM — sem Playwright locator loops (travavam 2+ min no Docker).
 * Evidência local: checkbox id = "6619302 - correspondentes…"; label longo do menu
 * NÃO deve ser clicado (antes batia em "Início Planos Mais…").
 *
 * Harden (produção paralela): waits mais longos no Xvfb, poll do search/checkbox,
 * sem Enter global (rouba foco entre jobs), retries in-place antes de derrubar o browser.
 */
async function selectAtividadePrincipalCnae(page, rawCode) {
    const code = String(rawCode || "").replace(/\D/g, "");
    if (!code)
        return;
    await dismissBlockingPortalOverlays(page).catch(() => undefined);
    // Fecha modal residual de tentativa anterior (paralelo/Xvfb).
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find((b) => /^Fechar$/i.test(String(b.textContent || "").trim()));
        btn?.click();
    });
    await page.waitForTimeout(300);
    // 1) Abrir: label curto OU input type=text da atividade (abre o modal)
    await page.evaluate(() => {
        const visible = (el) => {
            const h = el;
            const s = window.getComputedStyle(h);
            return s.display !== "none" && s.visibility !== "hidden" && (h.offsetParent !== null || s.position === "fixed");
        };
        const labels = Array.from(document.querySelectorAll("label")).filter((el) => {
            const t = String(el.textContent || "").replace(/\s+/g, " ").trim();
            return t.length > 0 && t.length < 80 && /Atividade\s+Principal\s*\(CNAE\)/i.test(t);
        });
        const lab = labels.find(visible);
        if (lab)
            lab.click();
        const textOpeners = Array.from(document.querySelectorAll("input")).filter((el) => {
            const i = el;
            const ph = String(i.placeholder || "").toLowerCase();
            return (visible(i) &&
                i.type === "text" &&
                /c[oó]digo ou nome da atividade|atividade/.test(ph));
        });
        textOpeners[0]?.click();
    });
    // 2) Esperar search do modal (Xvfb sob carga demora mais que 500ms)
    let typedOk = false;
    for (let attempt = 1; attempt <= 6; attempt += 1) {
        let searchReady = false;
        for (let poll = 0; poll < 12; poll += 1) {
            searchReady = await page.evaluate(() => {
                const visible = (el) => {
                    const h = el;
                    const s = window.getComputedStyle(h);
                    return s.display !== "none" && s.visibility !== "hidden";
                };
                const inputs = Array.from(document.querySelectorAll("input"));
                return inputs.some((el) => {
                    const ph = String(el.placeholder || "").toLowerCase();
                    const inModal = Boolean(el.closest('[role="dialog"], .modal, .o-modal, .modal-card, .modal-content'));
                    return (visible(el) &&
                        (el.type === "search" || /atividade|cnae|c[oó]digo/.test(ph)) &&
                        (inModal || el.type === "search"));
                });
            });
            if (searchReady)
                break;
            await page.waitForTimeout(350);
        }
        if (!searchReady) {
            await page.evaluate(() => {
                const i = Array.from(document.querySelectorAll("input")).find((el) => {
                    const ph = String(el.placeholder || "").toLowerCase();
                    return el.type === "text" && /atividade/.test(ph);
                });
                i?.click();
                const lab = Array.from(document.querySelectorAll("label")).find((el) => {
                    const t = String(el.textContent || "").replace(/\s+/g, " ").trim();
                    return t.length > 0 && t.length < 80 && /Atividade\s+Principal\s*\(CNAE\)/i.test(t);
                });
                lab?.click();
            });
            await page.waitForTimeout(400);
            continue;
        }
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
        if (typed?.ok && String(typed.value || "").includes(code)) {
            typedOk = true;
            break;
        }
        await page.waitForTimeout(350);
    }
    if (!typedOk) {
        throw new Error(`CNAE ${code}: modal de busca não abriu (search ausente).`);
    }
    // 3) Aguardar filtro + marcar checkbox (id começa com o código)
    let marked = false;
    const markDeadline = Date.now() + 12000;
    while (Date.now() < markDeadline) {
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
        await page.waitForTimeout(400);
    }
    if (!marked) {
        throw new Error(`CNAE ${code}: checkbox da atividade não apareceu após filtrar.`);
    }
    // 4) Fechar modal
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find((b) => /^(Fechar|Concluir|Aplicar|OK)$/i.test(String(b.textContent || "").trim()));
        btn?.click();
    });
    await page.waitForTimeout(400);
}
async function selectAtividadePrincipalCnaeWithTimeout(page, rawCode, onProgress, timeoutMs = 45000) {
    const code = String(rawCode || "").replace(/\D/g, "");
    if (!code)
        return;
    const attempts = Math.max(1, Math.min(4, Math.round(Number(process.env.CASADOSDADOS_CNAE_RETRIES || 3) || 3)));
    const perAttemptMs = Math.max(20000, Math.round(Number(timeoutMs) || 45000));
    let lastErr = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        let beat;
        let timer;
        const started = Date.now();
        beat = setInterval(() => {
            const sec = Math.round((Date.now() - started) / 1000);
            onProgress?.(attempt > 1
                ? `Pesquisando: selecionando CNAE ${code}… tentativa ${attempt}/${attempts} (${sec}s)`
                : `Pesquisando: selecionando CNAE ${code}… (${sec}s)`);
        }, 5000);
        try {
            await Promise.race([
                selectAtividadePrincipalCnae(page, code),
                new Promise((_, reject) => {
                    timer = setTimeout(() => reject(new Error(`CNAE ${code}: timeout ${Math.round(perAttemptMs / 1000)}s ao selecionar no portal.`)), perAttemptMs);
                }),
            ]);
            return;
        }
        catch (err) {
            lastErr = err instanceof Error ? err : new Error(String(err));
            onProgress?.(`Pesquisando: CNAE ${code} falhou (tentativa ${attempt}/${attempts}) — ${lastErr.message.slice(0, 100)}`);
            await dismissBlockingPortalOverlays(page).catch(() => undefined);
            await page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll("button")).find((b) => /^Fechar$/i.test(String(b.textContent || "").trim()));
                btn?.click();
            });
            await page.waitForTimeout(600 + attempt * 250);
        }
        finally {
            if (beat)
                clearInterval(beat);
            if (timer)
                clearTimeout(timer);
        }
    }
    throw lastErr || new Error(`CNAE ${code}: falha ao selecionar no portal.`);
}
async function setCheckboxByLabel(page, label, checked) {
    const needle = label.toLowerCase();
    // Só checkbox DENTRO do label — never preceding/following (pega opção de autocomplete CNAE).
    const box = page
        .locator(`xpath=//label[contains(${xpathLower()}, '${needle}')]//input[@type='checkbox']`)
        .first();
    if ((await box.count()) === 0)
        return;
    if (!(await box.isVisible().catch(() => false)))
        return;
    const isChecked = await box.isChecked().catch(() => false);
    if (checked && !isChecked)
        await box.check();
    if (!checked && isChecked)
        await box.uncheck();
}
/**
 * Switches Oruga/Buefy: input[type=checkbox][role=switch] vem ANTES do label
 * (não dentro). Clique no .switch / label / input — evidência etapa 4b.
 */
async function setToggleByLabel(page, label, enabled) {
    if (!enabled)
        return;
    await dismissBlockingPortalOverlays(page);
    const needle = label.toLowerCase().replace(/"/g, "");
    const ok = await page.evaluate(({ needle, want }) => {
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
        let box = (lab.previousElementSibling &&
            lab.previousElementSibling.matches?.('input[type="checkbox"]')
            ? lab.previousElementSibling
            : null) ||
            lab.parentElement?.querySelector('input[type="checkbox"]') ||
            lab.querySelector('input[type="checkbox"]');
        if (!box)
            return false;
        if (Boolean(box.checked) === want)
            return true;
        const control = lab.closest(".switch") || lab.parentElement;
        (control || lab).click();
        if (Boolean(box.checked) !== want)
            box.click();
        return Boolean(box.checked) === want || true;
    }, { needle, want: true });
    if (ok)
        return;
    // Fallback Playwright (casos raros)
    const lower = xpathLower();
    const textPath = `(//label|//span|//p|//strong|//div[contains(@class,'switch') or contains(@class,'control')])[contains(${lower}, '${needle}') and string-length(normalize-space(.)) < 90]`;
    const labelEl = page.locator(`xpath=${textPath}`).first();
    if ((await labelEl.count()) > 0 && (await labelEl.isVisible().catch(() => false))) {
        await labelEl.click({ timeout: 8000 }).catch(() => undefined);
    }
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
        if ((await select.count()) > 0) {
            try {
                await select.selectOption(filters.tipoPesquisa);
            }
            catch {
                await select.fill(filters.tipoPesquisa);
            }
        }
    }
    await fillByLabel(page, ["cnpj raiz", "somente os 8"], String(filters.cnpjRaiz || "").trim());
    const situacoes = Array.isArray(filters.situacaoCadastral) ? filters.situacaoCadastral : [];
    for (const situacao of ["Ativa", "Baixada", "Inapta", "Nula", "Suspensa"]) {
        await setCheckboxByLabel(page, situacao.toLowerCase(), situacoes.includes(situacao));
    }
    const cnaeCode = String(filters.atividadePrincipalCnae || "").replace(/\D/g, "");
    step(cnaeCode
        ? `selecionando CNAE ${cnaeCode}…`
        : "aplicando filtros (CNAE, situação, celular)…");
    // Jitter leve sob carga paralela (não serializa — só desfaz pico no mesmo ms).
    if (cnaeCode) {
        await page.waitForTimeout(200 + Math.floor(Math.random() * 800));
    }
    await selectAtividadePrincipalCnaeWithTimeout(page, String(filters.atividadePrincipalCnae || "").trim(), onProgress, Math.max(45000, Math.round(Number(process.env.CASADOSDADOS_CNAE_TIMEOUT_MS || 45000) || 45000)));
    if (filters.incluirAtividadeSecundaria) {
        await setToggleByLabel(page, "incluir atividade secundária", true);
    }
    step("aplicando filtros (natureza, UF, contatos)…");
    await fillByLabel(page, ["natureza jurídica", "código ou nome da natureza"], String(filters.naturezaJuridica || "").trim());
    await fillByLabel(page, ["estado (uf)", "estado", "selecione o estado"], String(filters.estadoUf || "").trim());
    await fillByLabel(page, ["município", "municipio", "selecione um município"], String(filters.municipio || "").trim());
    await fillByLabel(page, ["bairro"], String(filters.bairro || "").trim());
    await fillByLabel(page, ["cep"], String(filters.cep || "").trim());
    await fillByLabel(page, ["ddd"], String(filters.ddd || "").trim());
    await fillByLabel(page, ["telefone"], String(filters.telefone || "").trim());
    await fillByLabel(page, ["data de abertura - a partir de", "a partir de"], String(filters.dataAberturaDe || "").trim());
    await fillByLabel(page, ["data de abertura - até"], String(filters.dataAberturaAte || "").trim());
    await fillByLabel(page, ["capital social - valor mínimo", "valor mínimo"], String(filters.capitalSocialMin || "").trim());
    await fillByLabel(page, ["capital social - valor máximo", "valor máximo"], String(filters.capitalSocialMax || "").trim());
    if (filters.empresasExcluidasMei) {
        await setToggleByLabel(page, "empresas excluídas do mei", true);
        await fillByLabel(page, ["excluídas do mei"], String(filters.excluidasMeiDe || "").trim());
    }
    if (filters.empresasExcluidasSimples) {
        await setToggleByLabel(page, "empresas excluídas do simples", true);
    }
    await fillByLabel(page, ["porte da empresa", "selecione o porte"], String(filters.porteEmpresa || "").trim());
    await setToggleByLabel(page, "somente mei", Boolean(filters.somenteMei));
    await setToggleByLabel(page, "excluir mei", Boolean(filters.excluirMei));
    await setToggleByLabel(page, "somente matriz", Boolean(filters.somenteMatriz));
    await setToggleByLabel(page, "somente filial", Boolean(filters.somenteFilial));
    await setToggleByLabel(page, "empresas do simples", Boolean(filters.empresasDoSimples));
    await setToggleByLabel(page, "excluir empresas do simples", Boolean(filters.excluirEmpresasDoSimples));
    await setToggleByLabel(page, "com contato de telefone", Boolean(filters.comContatoTelefone));
    await setToggleByLabel(page, "somente fixo", Boolean(filters.somenteFixo));
    await setToggleByLabel(page, "somente celular", Boolean(filters.somenteCelular));
    await setToggleByLabel(page, "com e-mail", Boolean(filters.comEmail));
    await setToggleByLabel(page, "excluir empresas visualizadas", Boolean(filters.excluirEmpresasVisualizadas));
    await setToggleByLabel(page, 'excluir empresas que no e-mail contenham "contab"', Boolean(filters.excluirEmailContab));
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
            return fetchCasaDosDadosLeadsViaApi(filters, onProgress);
        }
    }
    const maxAttempts = Math.max(1, Math.round(Number(process.env.CASADOSDADOS_SCRAPE_RETRIES || 8) || 8));
    let resumeFrom = Math.max(1, Math.round(Number(options?.resumeFromPage || 1) || 1));
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            if (attempt > 1) {
                onProgress?.(`Abrindo Portal: reconectando (tentativa ${attempt}/${maxAttempts}) — retomando página ${resumeFrom}…`);
            }
            else if (resumeFrom > 1) {
                onProgress?.(`Abrindo Portal: retomando extração na página ${resumeFrom}…`);
            }
            return await scrapeCasaDosDadosLeadsOnce(filters, onProgress, {
                resumeFromPage: resumeFrom,
                onPageCheckpoint: async (ckpt) => {
                    resumeFrom = Math.max(1, ckpt.nextPage);
                    await options?.onPageCheckpoint?.(ckpt);
                },
            });
        }
        catch (error) {
            lastErr = error;
            const crashed = isChromiumTargetCrash(error);
            const msg = error instanceof Error ? error.message : String(error);
            onProgress?.(crashed
                ? `Copiando: Chromium interrompido — recuperando da página ${resumeFrom}…`
                : `Abrindo Portal: falha operacional — retomando página ${resumeFrom} (${msg.slice(0, 120)})…`);
            if (attempt >= maxAttempts)
                break;
            const delayMs = crashed
                ? Math.min(8000, 1000 * attempt)
                : Math.min(20000, 2000 * attempt);
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
    throw lastErr instanceof Error
        ? lastErr
        : new Error(String(lastErr || "Falha na extração após retentativas de reconexão."));
}
/**
 * Uma sessão Playwright (login → filtros → páginas). Em falha, o wrapper reconecta
 * a partir de `resumeFromPage` e o service já terá arquivado o pool via checkpoint.
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
    onProgress?.(headless
        ? "Abrindo Portal: iniciando navegador (headless real)…"
        : String(process.env.DISPLAY || "").trim()
            ? "Abrindo Portal: abrindo Casa dos Dados (janela virtual Xvfb, como V02)…"
            : "Abrindo Portal: abrindo janela do Casa dos Dados (visível)…");
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
    try {
        const context = await browser.newContext({
            locale: "pt-BR",
            // Viewport fixo no Docker/Xvfb — null + maximizado crasha o Chromium.
            viewport: headless || hasXvfb ? { width: 1440, height: 900 } : null,
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        });
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
        onProgress?.(headless
            ? "Abrindo Portal: autenticando no Casa dos Dados…"
            : "Abrindo Portal: janela aberta — autenticando no Casa dos Dados…");
        await gotoWithRetry(page, PORTAL_LOGIN_URL, { waitUntil: "domcontentloaded" });
        await waitPastCloudflare(page, { onProgress, stage: "login" });
        // Portal real: /entrar → input[name=email] + input[name=senha] + botão "Acessar"
        await loginCasaDosDadosPortal(page, email, password);
        await waitPastCloudflare(page, { onProgress, stage: "pós-login" });
        onProgress?.("Pesquisando: abrindo tela de pesquisa…");
        await gotoWithRetry(page, PORTAL_SEARCH_URL, { waitUntil: "domcontentloaded" });
        await waitPastCloudflare(page, { onProgress, stage: "pesquisa" });
        await page.waitForTimeout(1500);
        onProgress?.("Pesquisando: aplicando filtros (CNAE, situação, celular)…");
        await applyFilters(page, filters, onProgress);
        const searchBtn = page
            .locator('button:has-text("Pesquisar"), button:has-text("Buscar"), a:has-text("Pesquisar"), [role="button"]:has-text("Pesquisar")')
            .first();
        // Captura total da API (se houver). CNPJs vêm da tela — não pré-carregar do JSON
        // (senão página 1 dá added=0 e a paginação para).
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
        // Garante modal CNAE fechado antes de pesquisar.
        const fecharCnae = page.locator('button:has-text("Fechar")').first();
        if ((await fecharCnae.count()) > 0 && (await fecharCnae.isVisible().catch(() => false))) {
            await fecharCnae.click().catch(() => undefined);
            await page.waitForTimeout(300);
        }
        if ((await searchBtn.count()) > 0) {
            await searchBtn.scrollIntoViewIfNeeded?.().catch(() => undefined);
            await searchBtn.click({ timeout: 15000 });
            await page.waitForTimeout(3000);
        }
        else {
            onProgress?.("Botão Pesquisar não encontrado — tentando Enter…");
            await page.keyboard.press("Enter").catch(() => undefined);
            await page.waitForTimeout(3000);
        }
        await page
            .locator("body")
            .filter({ hasText: /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\s+-\s+|retornou\s+[\d.]+\s+empresas/i })
            .first()
            .waitFor({ timeout: 45000 })
            .catch(() => null);
        // Sem scrolls artificiais — 20 cards/página já estão no DOM; scroll redesenha e estressa o renderer.
        const pageText = await page.locator("body").innerText({ timeout: 15000 }).catch(() => "");
        const portalTotal = interceptedTotal ?? parseResultTotalFromText(pageText);
        if (portalTotal != null) {
            onProgress?.(`Pesquisando: retornou ${portalTotal.toLocaleString("pt-BR")} empresas. Iniciando cópia…`);
        }
        else {
            onProgress?.("Copiando: lendo cards na tela (CNPJ + Razão Social)…");
        }
        const collected = new Map();
        // NÃO pré-carregar interceptedRows aqui: se a API já encher `collected`,
        // a página 1 fica com added=0 e o robô encerra a paginação sem ir à página 2
        // (Seguro 14: 20 CNPJs da pág.1 = já usados → pool vazio).
        const readScreenCards = async () => {
            const bodyText = await page.locator("body").innerText({ timeout: 15000 });
            const re = /^(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\s+-\s+(.+)$/;
            const seen = new Set();
            const out = [];
            const lines = bodyText
                .split(/\n+/)
                .map((s) => s.trim())
                .filter(Boolean);
            for (const line of lines) {
                const m = line.match(re);
                if (!m || seen.has(m[1]))
                    continue;
                seen.add(m[1]);
                out.push([m[1], m[2]]);
            }
            return out;
        };
        const firstCnpjOf = (rows) => (rows[0] ? (0, waba_leads_cnpj_repository_1.normalizeCnpjDigits)(rows[0][0]) : "");
        const readCurrentPageNumber = async () => page.evaluate(() => {
            const active = document.querySelector('nav[data-oruga="pagination"] button.pagination-link.is-current, nav[data-oruga="pagination"] button[aria-current="true"]');
            const n = Number(String(active?.textContent || "").trim());
            return Number.isFinite(n) && n > 0 ? n : 1;
        });
        /**
         * Paginação real (Oruga/Bulma) — evidência probe:
         * <nav data-oruga="pagination">
         *   <button class="pagination-next" aria-label="Pŕoxima página"> (ícone, sem texto "Próxima")
         *   <button class="pagination-link" aria-label="Página 2.">2</button>
         * </nav>
         * 20 cards/página; UI só até botão "1000" (ver resolvePortalUiMaxPage).
         */
        const portalUiMaxPage = resolvePortalUiMaxPage();
        const goToNextResultsPage = async (previousFirstCnpj, fromPage) => {
            const targetPage = fromPage + 1;
            const nextCandidates = [
                'nav[data-oruga="pagination"] button.pagination-next:not([disabled]):not(.is-disabled)',
                "button.pagination-next.pagination-link:not([disabled]):not(.is-disabled)",
                `nav[data-oruga="pagination"] button.pagination-link[aria-label="Página ${targetPage}."]`,
                `nav[data-oruga="pagination"] button.pagination-link[aria-label*="Página ${targetPage}"]`,
                `nav[data-oruga="pagination"] ul.pagination-list >> button.pagination-link:text-is("${targetPage}")`,
            ];
            for (const sel of nextCandidates) {
                const btn = page.locator(sel).first();
                if ((await btn.count()) === 0)
                    continue;
                if (!(await btn.isVisible().catch(() => false)))
                    continue;
                const blocked = await btn
                    .evaluate((el) => {
                    const b = el;
                    return (Boolean(b.disabled) ||
                        b.classList.contains("is-disabled") ||
                        b.getAttribute("aria-disabled") === "true");
                })
                    .catch(() => false);
                if (blocked)
                    continue;
                await btn.scrollIntoViewIfNeeded().catch(() => null);
                await btn.click({ force: true, timeout: 8000 }).catch(() => null);
                // Prioridade: número da página ativa (aria-current / is-current). CNPJ = fallback leve.
                const changed = await page
                    .waitForFunction((expectedPage) => {
                    const active = document.querySelector('nav[data-oruga="pagination"] button.pagination-link.is-current,' +
                        'nav[data-oruga="pagination"] button[aria-current="true"],' +
                        'nav[data-oruga="pagination"] button[aria-current="page"]');
                    const n = Number(String(active?.textContent || "").trim());
                    return Number.isFinite(n) && n === expectedPage;
                }, targetPage, { timeout: 15000 })
                    .then(() => true)
                    .catch(() => false);
                if (!changed && previousFirstCnpj) {
                    const okByCnpj = await page
                        .waitForFunction((prev) => {
                        const re = /^(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\s+-\s+/m;
                        const text = String(document.body?.innerText || "");
                        const m = text.match(re);
                        if (!m)
                            return false;
                        return m[1].replace(/\D/g, "") !== prev;
                    }, previousFirstCnpj, { timeout: 8000 })
                        .then(() => true)
                        .catch(() => false);
                    if (okByCnpj)
                        return true;
                }
                else if (changed) {
                    await page
                        .locator("body")
                        .filter({ hasText: /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\s+-\s+/ })
                        .first()
                        .waitFor({ timeout: 10000 })
                        .catch(() => null);
                    return true;
                }
            }
            return false;
        };
        let pagesToFetch = maxPagesCap > 0 ? maxPagesCap : Number.MAX_SAFE_INTEGER;
        if (portalTotal != null) {
            const totalPagesAvailable = Math.max(1, Math.ceil(portalTotal / PORTAL_PAGE_SIZE));
            pagesToFetch =
                maxPagesCap > 0
                    ? Math.min(maxPagesCap, totalPagesAvailable)
                    : totalPagesAvailable;
            onProgress?.(`Portal: ${portalTotal.toLocaleString("pt-BR")} empresas · ${PORTAL_PAGE_SIZE}/página · ${totalPagesAvailable.toLocaleString("pt-BR")} página(s) — copiando ${maxPagesCap > 0 ? `até ${pagesToFetch}` : "todas"}…`);
        }
        else if (maxPagesCap <= 0) {
            onProgress?.(`Copiando: total do portal não lido — avançando página a página até acabar (sem teto)…`);
        }
        // UI Oruga não navega além de portalUiMaxPage — evita loop Chromium em 1001+.
        if (pagesToFetch > portalUiMaxPage) {
            onProgress?.(`Copiando: teto da UI do portal = página ${portalUiMaxPage} (além disso a paginação não avança).`);
            pagesToFetch = portalUiMaxPage;
        }
        const goToResultsPage = async (targetPage) => {
            const target = Math.max(1, Math.round(targetPage || 1));
            if (target > portalUiMaxPage)
                return false;
            let current = await readCurrentPageNumber();
            if (current === target)
                return true;
            const tryClickPage = async () => {
                const candidates = [
                    page.locator(`nav[data-oruga="pagination"] button.pagination-link[aria-label="Página ${target}."]`),
                    page.locator(`nav[data-oruga="pagination"]`).getByRole("button", {
                        name: String(target),
                        exact: true,
                    }),
                ];
                for (const loc of candidates) {
                    try {
                        if (!(await loc.count()) || !(await loc.first().isVisible()))
                            continue;
                        await loc.first().click({ force: true });
                        const changed = await page
                            .waitForFunction((expectedPage) => {
                            const curBtn = document.querySelector('nav[data-oruga="pagination"] button.pagination-link.is-current,' +
                                'nav[data-oruga="pagination"] button[aria-current="true"],' +
                                'nav[data-oruga="pagination"] button[aria-current="page"]');
                            const curNum = Number(String(curBtn?.textContent || "").trim());
                            return Number.isFinite(curNum) && curNum === expectedPage;
                        }, target, { timeout: 15000 })
                            .then(() => true)
                            .catch(() => false);
                        if (changed)
                            return true;
                    }
                    catch {
                        /* tenta próximo seletor */
                    }
                }
                return false;
            };
            if (await tryClickPage())
                return true;
            // Evita recovery destrutivo: clicar 1→2→…→300 numa sessão nova sobrecarrega o renderer.
            let guard = 0;
            const maxSteps = Math.max(1, Math.min(25, Math.round(Number(process.env.CASADOSDADOS_MAX_SEQUENTIAL_RESUME_STEPS || 25) || 25)));
            while ((current = await readCurrentPageNumber()) < target && guard < maxSteps) {
                guard += 1;
                const prevRows = await readScreenCards();
                const prev = firstCnpjOf(prevRows);
                const ok = await goToNextResultsPage(prev, current);
                if (!ok)
                    return false;
                if (await tryClickPage())
                    return true;
            }
            current = await readCurrentPageNumber();
            if (current === target)
                return true;
            throw new Error(`Retomada limitada: não posicionou na página ${target} em ${maxSteps} passos (UI em ${current}). Checkpoint/pool mantidos.`);
        };
        const startPage = Math.max(1, Math.round(Number(options?.resumeFromPage || 1) || 1));
        if (startPage > pagesToFetch) {
            onProgress?.(startPage > portalUiMaxPage
                ? `Copiando: checkpoint página ${startPage} além do teto da UI (${portalUiMaxPage}) — raspagem via portal encerrada; pool já arquivado será usado.`
                : `Copiando: checkpoint página ${startPage} além do total (${pagesToFetch}) — sessão sem páginas novas.`);
            await context.close();
            return [];
        }
        if (startPage > 1) {
            onProgress?.(`Copiando: posicionando na página ${startPage} (retomada)…`);
            const positioned = await goToResultsPage(startPage);
            if (!positioned) {
                throw new Error(`Não foi possível posicionar na página ${startPage} para retomar a extração.`);
            }
        }
        for (let pageIndex = startPage; pageIndex <= pagesToFetch; pageIndex += 1) {
            const totalLabel = portalTotal != null ? ` de ${portalTotal.toLocaleString("pt-BR")}` : "";
            onProgress?.(`Copiando: página ${pageIndex}/${pagesToFetch === Number.MAX_SAFE_INTEGER ? "?" : pagesToFetch}${totalLabel} (${collected.size.toLocaleString("pt-BR")} CNPJs nesta sessão)…`);
            const rows = await readScreenCards();
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
            onProgress?.(`Copiando: página ${pageIndex} +${added} novos / ${rows.length} cards (sessão ${collected.size.toLocaleString("pt-BR")}).`);
            const nextPage = pageIndex + 1;
            await options?.onPageCheckpoint?.({
                completedPage: pageIndex,
                nextPage,
                pageLeads,
                sessionCollected: [...collected.values()],
                portalTotal,
                pagesToFetch: pagesToFetch === Number.MAX_SAFE_INTEGER ? pageIndex : pagesToFetch,
            });
            if (pageIndex >= pagesToFetch)
                break;
            if (rows.length === 0) {
                onProgress?.(`Copiando: página ${pageIndex} sem cards — encerrando paginação.`);
                break;
            }
            // NÃO encerrar por added===0: página pode repetir CNPJs já em `collected` desta
            // sessão e ainda haver conteúdo novo nas páginas seguintes.
            if (nextPage > portalUiMaxPage) {
                onProgress?.(`Copiando: atingiu o teto da UI (página ${portalUiMaxPage}) — encerrando raspagem do portal.`);
                break;
            }
            onProgress?.(`Copiando: avançando para a página ${pageIndex + 1}…`);
            const advanced = await goToNextResultsPage(pageFirst, pageIndex);
            if (!advanced) {
                const stillOn = await readCurrentPageNumber();
                // No teto da UI: next costuma falhar — encerra limpo (não reconecta em loop).
                if (pageIndex >= portalUiMaxPage || stillOn >= portalUiMaxPage) {
                    onProgress?.(`Copiando: paginação parou na página ${stillOn} (teto UI ${portalUiMaxPage}) — encerrando sem reconectar.`);
                    break;
                }
                // Lança para o wrapper reconectar e retomar em nextPage (já checkpointado).
                throw new Error(`Paginação interrompida após página ${pageIndex} (UI em ${stillOn}; não avançou para ${pageIndex + 1}).`);
            }
        }
        await context.close();
        if (!collected.size && startPage <= 1) {
            throw new Error("Robô não leu CNPJ/Razão Social na tela. Confirme login, filtros e se os cards aparecem (formato: 00.000.000/0000-00 - NOME). Se Cloudflare bloquear, use CASADOSDADOS_HEADLESS=0.");
        }
        if (portalTotal != null) {
            onProgress?.(`Coletados ${collected.size.toLocaleString("pt-BR")} nesta sessão (portal ~${portalTotal.toLocaleString("pt-BR")}), página a página.`);
        }
        else {
            onProgress?.(`Coletados ${collected.size.toLocaleString("pt-BR")} CNPJ(s) + Razão Social nesta sessão (página a página).`);
        }
        return [...collected.values()];
    }
    finally {
        await browser.close().catch(() => undefined);
    }
}
