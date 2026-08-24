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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCasaDosDadosStoragePath = resolveCasaDosDadosStoragePath;
exports.loadCasaDosDadosStorageState = loadCasaDosDadosStorageState;
exports.saveCasaDosDadosStorageState = saveCasaDosDadosStorageState;
exports.buildChromiumLaunchArgs = buildChromiumLaunchArgs;
exports.acquireSharedBrowser = acquireSharedBrowser;
exports.releaseSharedBrowser = releaseSharedBrowser;
exports.shutdownLeadsCnpjBrowserRuntime = shutdownLeadsCnpjBrowserRuntime;
exports.logScrapePageTelemetry = logScrapePageTelemetry;
/**
 * Browser runtime Leads PJ — Fase C (Playwright Server + connect).
 * O Chromium sobrevive ao fim do job (só fecha context/page).
 * Relaunch só em disconnect / kill explícito / shutdown do processo.
 *
 * Docs: https://playwright.dev/docs/api/class-browsertype#browser-type-launch-server
 *       https://playwright.dev/docs/docker
 */
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const data_path_1 = require("../../data-path");
const STORAGE_FILE = "leads-cnpj-casadosdados-storage.json";
let pwMod = null;
let server = null;
let browser = null;
let launchArgs = [];
let launchHeadless = true;
let launchSlowMo = 0;
let starting = null;
async function loadPlaywright() {
    if (pwMod)
        return pwMod;
    pwMod = await Promise.resolve().then(() => __importStar(require("playwright")));
    return pwMod;
}
function resolveCasaDosDadosStoragePath() {
    return path_1.default.join((0, data_path_1.resolveDataDir)(), STORAGE_FILE);
}
function loadCasaDosDadosStorageState() {
    try {
        const filePath = resolveCasaDosDadosStoragePath();
        if (!fs_1.default.existsSync(filePath))
            return null;
        const raw = fs_1.default.readFileSync(filePath, "utf8");
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : null;
    }
    catch {
        return null;
    }
}
function saveCasaDosDadosStorageState(state) {
    try {
        const dir = (0, data_path_1.resolveDataDir)();
        fs_1.default.mkdirSync(dir, { recursive: true });
        const filePath = resolveCasaDosDadosStoragePath();
        const tmp = `${filePath}.${process.pid}.tmp`;
        fs_1.default.writeFileSync(tmp, JSON.stringify(state), "utf8");
        fs_1.default.renameSync(tmp, filePath);
    }
    catch (error) {
        console.warn("[Leads PJ] falha ao gravar storageState:", error instanceof Error ? error.message : String(error));
    }
}
function buildChromiumLaunchArgs(opts) {
    const useRealShm = String(process.env.CASADOSDADOS_USE_DEV_SHM || "").trim() === "1";
    const args = [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        // Com shm grande (Fase B), preferir /dev/shm real — Playwright doc ainda recomenda IPC/shm.
        ...(useRealShm ? [] : ["--disable-dev-shm-usage"]),
        "--disable-gpu",
        "--disable-extensions",
        "--mute-audio",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        "--disable-background-timer-throttling",
        ...(opts.headless || opts.hasXvfb ? [] : ["--start-maximized"]),
    ];
    return args;
}
function wireBrowser(b, label) {
    b.on("disconnected", () => {
        console.error(`[Leads PJ] BROWSER_DISCONNECTED (${label})`);
        if (browser === b)
            browser = null;
    });
}
/**
 * Obtém Browser compartilhado via launchServer + connect (protocolo Playwright).
 * Env: CASADOSDADOS_BROWSER_SERVER=0 força launch() clássico (legado).
 */
async function acquireSharedBrowser(opts) {
    if (browser && browser.isConnected())
        return browser;
    if (starting)
        return starting;
    starting = (async () => {
        const pw = await loadPlaywright();
        launchHeadless = opts.headless;
        launchSlowMo = opts.slowMo;
        launchArgs = buildChromiumLaunchArgs(opts);
        const useServer = String(process.env.CASADOSDADOS_BROWSER_SERVER || "1").trim() !== "0";
        if (useServer) {
            try {
                if (server) {
                    try {
                        await server.close();
                    }
                    catch {
                        /* ignore */
                    }
                    server = null;
                }
                server = await pw.chromium.launchServer({
                    headless: launchHeadless,
                    args: launchArgs,
                });
                const endpoint = server.wsEndpoint();
                browser = await pw.chromium.connect(endpoint);
                wireBrowser(browser, "server");
                console.log(JSON.stringify({
                    event: "LEADS_BROWSER_SERVER",
                    endpoint: endpoint.replace(/:[^:@/]+@/, ":***@"),
                    headless: launchHeadless,
                    useDevShm: String(process.env.CASADOSDADOS_USE_DEV_SHM || "") === "1",
                    ts: new Date().toISOString(),
                }));
                return browser;
            }
            catch (error) {
                console.warn("[Leads PJ] launchServer falhou — fallback launch():", error instanceof Error ? error.message : String(error));
                server = null;
            }
        }
        browser = await pw.chromium.launch({
            headless: launchHeadless,
            slowMo: launchSlowMo,
            args: launchArgs,
        });
        wireBrowser(browser, "launch");
        return browser;
    })();
    try {
        return await starting;
    }
    finally {
        starting = null;
    }
}
/** Fecha o browser compartilhado (hard recovery / abort usuário / shutdown). */
async function releaseSharedBrowser(reason) {
    console.warn(`[Leads PJ] releaseSharedBrowser: ${reason}`);
    const b = browser;
    browser = null;
    if (b) {
        try {
            await b.close();
        }
        catch {
            /* ignore */
        }
    }
    const s = server;
    server = null;
    if (s) {
        try {
            await s.close();
        }
        catch {
            /* ignore */
        }
    }
}
async function shutdownLeadsCnpjBrowserRuntime() {
    await releaseSharedBrowser("process-shutdown");
}
/** Telemetria leve por página (sem deps extras). */
function logScrapePageTelemetry(info) {
    const every = Math.max(1, Math.round(Number(process.env.CASADOSDADOS_TELEMETRY_EVERY || 10) || 10));
    if (info.page % every !== 0 && info.page !== 1)
        return;
    const mem = process.memoryUsage();
    let shm = "n/a";
    try {
        // Node 18.15+ / 20: fs.statfsSync
        const statfs = fs_1.default.statfsSync;
        if (typeof statfs === "function") {
            const st = statfs("/dev/shm");
            const availMb = Math.round((Number(st.bavail) * Number(st.bsize)) / (1024 * 1024));
            const totalMb = Math.round((Number(st.blocks) * Number(st.bsize)) / (1024 * 1024));
            shm = `${availMb}/${totalMb}MB`;
        }
    }
    catch {
        shm = "n/a";
    }
    console.log(JSON.stringify({
        event: "LEADS_SCRAPE_TELEMETRY",
        page: info.page,
        sessionCnpjs: info.sessionCnpjs,
        browserConnected: info.browserConnected,
        nodeRssMb: Math.round(mem.rss / (1024 * 1024)),
        nodeHeapMb: Math.round(mem.heapUsed / (1024 * 1024)),
        shm,
        ts: new Date().toISOString(),
    }));
}
