/**
 * Browser runtime Leads PJ.
 * - Modo paralelo (default): 1 Chromium dedicado por job (`CASADOSDADOS_BROWSER_SERVER=0`).
 * - Modo legado: launchServer + connect singleton (`CASADOSDADOS_BROWSER_SERVER=1`) — só seguro com 1 job.
 *
 * Docs: https://playwright.dev/docs/api/class-browsertype#browser-type-launch-server
 *       https://playwright.dev/docs/docker
 */
import fs from "fs";
import path from "path";
import { resolveDataDir } from "../../data-path";

type PlaywrightModule = typeof import("playwright");
type Browser = import("playwright").Browser;
type BrowserServer = import("playwright").BrowserServer;

const STORAGE_FILE = "leads-cnpj-casadosdados-storage.json";

let pwMod: PlaywrightModule | null = null;
let server: BrowserServer | null = null;
let browser: Browser | null = null;
let launchArgs: string[] = [];
let launchHeadless = true;
let launchSlowMo = 0;
let starting: Promise<Browser> | null = null;

/** Dedicated browsers launched for parallel jobs (closed by the job). */
const dedicatedBrowsers = new WeakSet<Browser>();

async function loadPlaywright(): Promise<PlaywrightModule> {
  if (pwMod) return pwMod;
  pwMod = await import("playwright");
  return pwMod;
}

/**
 * Browser compartilhado só com CASADOSDADOS_BROWSER_SERVER=1.
 * Default = dedicado (N jobs em paralelo, cada um com seu Chromium).
 */
export function isDedicatedBrowserMode(): boolean {
  return String(process.env.CASADOSDADOS_BROWSER_SERVER || "0").trim() !== "1";
}

export function isDedicatedJobBrowser(b: Browser | null | undefined): boolean {
  return Boolean(b && dedicatedBrowsers.has(b));
}

export function resolveCasaDosDadosStoragePath(): string {
  return path.join(resolveDataDir(), STORAGE_FILE);
}

export function loadCasaDosDadosStorageState(): unknown | null {
  try {
    const filePath = resolveCasaDosDadosStoragePath();
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCasaDosDadosStorageState(state: unknown): void {
  try {
    const dir = resolveDataDir();
    fs.mkdirSync(dir, { recursive: true });
    const filePath = resolveCasaDosDadosStoragePath();
    const tmp = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state), "utf8");
    fs.renameSync(tmp, filePath);
  } catch (error) {
    console.warn(
      "[Leads PJ] falha ao gravar storageState:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export function buildChromiumLaunchArgs(opts: {
  headless: boolean;
  hasXvfb: boolean;
}): string[] {
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

function wireBrowser(b: Browser, label: string) {
  b.on("disconnected", () => {
    console.error(`[Leads PJ] BROWSER_DISCONNECTED (${label})`);
    if (browser === b) browser = null;
  });
}

/**
 * Obtém Browser para um job de raspagem.
 * - Dedicado (default): novo `chromium.launch()` por chamada — paralelo seguro.
 * - Compartilhado (`CASADOSDADOS_BROWSER_SERVER=1`): launchServer + connect singleton.
 */
export async function acquireSharedBrowser(opts: {
  headless: boolean;
  slowMo: number;
  hasXvfb: boolean;
}): Promise<Browser> {
  const pw = await loadPlaywright();
  launchHeadless = opts.headless;
  launchSlowMo = opts.slowMo;
  launchArgs = buildChromiumLaunchArgs(opts);

  if (isDedicatedBrowserMode()) {
    const dedicated = await pw.chromium.launch({
      headless: launchHeadless,
      slowMo: launchSlowMo,
      args: launchArgs,
    });
    dedicatedBrowsers.add(dedicated);
    dedicated.on("disconnected", () => {
      console.error("[Leads PJ] BROWSER_DISCONNECTED (dedicated)");
    });
    console.log(
      JSON.stringify({
        event: "LEADS_BROWSER_DEDICATED",
        headless: launchHeadless,
        useDevShm: String(process.env.CASADOSDADOS_USE_DEV_SHM || "") === "1",
        ts: new Date().toISOString(),
      }),
    );
    return dedicated;
  }

  if (browser && browser.isConnected()) return browser;

  if (starting) return starting;

  starting = (async () => {
    const useServer = true;

    if (useServer) {
      try {
        if (server) {
          try {
            await server.close();
          } catch {
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
        console.log(
          JSON.stringify({
            event: "LEADS_BROWSER_SERVER",
            endpoint: endpoint.replace(/:[^:@/]+@/, ":***@"),
            headless: launchHeadless,
            useDevShm: String(process.env.CASADOSDADOS_USE_DEV_SHM || "") === "1",
            ts: new Date().toISOString(),
          }),
        );
        return browser;
      } catch (error) {
        console.warn(
          "[Leads PJ] launchServer falhou — fallback launch():",
          error instanceof Error ? error.message : String(error),
        );
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
  } finally {
    starting = null;
  }
}

/**
 * Fecha Chromium do job: dedicado sempre; compartilhado só em hard recovery.
 */
export async function releaseJobBrowser(
  jobBrowser: Browser | null | undefined,
  reason: string,
): Promise<void> {
  if (!jobBrowser) return;
  if (isDedicatedJobBrowser(jobBrowser)) {
    console.warn(`[Leads PJ] releaseJobBrowser(dedicated): ${reason}`);
    try {
      await jobBrowser.close();
    } catch {
      /* ignore */
    }
    return;
  }
  await releaseSharedBrowser(reason);
}

/** Fecha o browser compartilhado (hard recovery / abort usuário / shutdown). */
export async function releaseSharedBrowser(reason: string): Promise<void> {
  console.warn(`[Leads PJ] releaseSharedBrowser: ${reason}`);
  const b = browser;
  browser = null;
  if (b) {
    try {
      await b.close();
    } catch {
      /* ignore */
    }
  }
  const s = server;
  server = null;
  if (s) {
    try {
      await s.close();
    } catch {
      /* ignore */
    }
  }
}

export function isSharedBrowserConnected(): boolean {
  try {
    return Boolean(browser && browser.isConnected());
  } catch {
    return false;
  }
}

export async function shutdownLeadsCnpjBrowserRuntime(): Promise<void> {
  await releaseSharedBrowser("process-shutdown");
}

/** Telemetria leve por página (sem deps extras). */
export function logScrapePageTelemetry(info: {
  page: number;
  sessionCnpjs: number;
  browserConnected: boolean;
}): void {
  const every = Math.max(1, Math.round(Number(process.env.CASADOSDADOS_TELEMETRY_EVERY || 10) || 10));
  if (info.page % every !== 0 && info.page !== 1) return;
  const mem = process.memoryUsage();
  let shm = "n/a";
  try {
    // Node 18.15+ / 20: fs.statfsSync
    const statfs = (fs as typeof fs & {
      statfsSync?: (p: string) => { bavail: number; blocks: number; bsize: number };
    }).statfsSync;
    if (typeof statfs === "function") {
      const st = statfs("/dev/shm");
      const availMb = Math.round((Number(st.bavail) * Number(st.bsize)) / (1024 * 1024));
      const totalMb = Math.round((Number(st.blocks) * Number(st.bsize)) / (1024 * 1024));
      shm = `${availMb}/${totalMb}MB`;
    }
  } catch {
    shm = "n/a";
  }
  console.log(
    JSON.stringify({
      event: "LEADS_SCRAPE_TELEMETRY",
      page: info.page,
      sessionCnpjs: info.sessionCnpjs,
      browserConnected: info.browserConnected,
      nodeRssMb: Math.round(mem.rss / (1024 * 1024)),
      nodeHeapMb: Math.round(mem.heapUsed / (1024 * 1024)),
      shm,
      ts: new Date().toISOString(),
    }),
  );
}
