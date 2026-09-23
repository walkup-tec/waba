"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAdsPowerApiBase = resolveAdsPowerApiBase;
exports.resolveAdsPowerApiToken = resolveAdsPowerApiToken;
exports.resolveAdsPowerIngestToken = resolveAdsPowerIngestToken;
exports.probeAdsPowerBridge = probeAdsPowerBridge;
exports.listAdsPowerRemoteProfiles = listAdsPowerRemoteProfiles;
exports.startAdsPowerProfile = startAdsPowerProfile;
function resolveAdsPowerApiBase() {
    return String(process.env.ADSPOWER_API_BASE || "http://local.adspower.net:50325")
        .trim()
        .replace(/\/+$/, "");
}
function resolveAdsPowerApiToken() {
    return String(process.env.ADSPOWER_API_TOKEN || "").trim();
}
function resolveAdsPowerIngestToken() {
    return String(process.env.ADSPOWER_INGEST_TOKEN || "").trim();
}
function authHeaders() {
    const token = resolveAdsPowerApiToken();
    const headers = { Accept: "application/json" };
    if (token)
        headers.Authorization = `Bearer ${token}`;
    return headers;
}
async function adsPowerGet(pathname, search, timeoutMs = 8000) {
    const base = resolveAdsPowerApiBase();
    const url = new URL(pathname, `${base}/`);
    for (const [key, value] of Object.entries(search)) {
        if (value)
            url.searchParams.set(key, value);
    }
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
        const res = await fetch(url, { headers: authHeaders(), signal: ac.signal });
        const json = (await res.json().catch(() => ({})));
        return {
            ok: res.ok && Number(json.code) === 0,
            code: Number(json.code ?? (res.ok ? -1 : res.status)),
            msg: String(json.msg || res.statusText || ""),
            data: json.data,
        };
    }
    catch (error) {
        return {
            ok: false,
            code: -1,
            msg: error instanceof Error ? error.message : String(error || "offline"),
            data: null,
        };
    }
    finally {
        clearTimeout(timer);
    }
}
async function probeAdsPowerBridge() {
    const ingestToken = resolveAdsPowerIngestToken();
    const apiToken = resolveAdsPowerApiToken();
    const baseUrl = resolveAdsPowerApiBase();
    /** EasyPanel só tem ingest: não pingar local.adspower.net (fetch failed na nuvem). */
    if (ingestToken && !apiToken) {
        return {
            configured: true,
            reachable: false,
            mode: "ingest",
            baseUrl,
            detail: "Perfis chegam do PC com AdsPower. Atualize a lista depois de rodar o script no computador.",
        };
    }
    const ping = await adsPowerGet("/api/v1/user/list", { page: "1", page_size: "1" }, 800);
    if (ping.ok) {
        return {
            configured: true,
            reachable: true,
            mode: "local-api",
            baseUrl,
            detail: "Local API do AdsPower respondeu neste servidor.",
        };
    }
    if (ingestToken) {
        return {
            configured: true,
            reachable: false,
            mode: "ingest",
            baseUrl,
            detail: "AdsPower roda no PC do operador. Atualize a lista depois de rodar o script no computador.",
        };
    }
    return {
        configured: false,
        reachable: false,
        mode: "offline",
        baseUrl,
        detail: "Configure ADSPOWER_INGEST_TOKEN (nuvem) ou ADSPOWER_API_BASE/ADSPOWER_API_TOKEN (mesmo PC do AdsPower).",
    };
}
async function listAdsPowerRemoteProfiles() {
    const rows = [];
    for (let page = 1; page <= 50; page += 1) {
        const ping = await adsPowerGet("/api/v1/user/list", { page: String(page), page_size: "100" });
        if (!ping.ok) {
            throw new Error(ping.msg || "Local API do AdsPower indisponível.");
        }
        const data = ping.data;
        const batch = Array.isArray(data?.list) ? data.list : [];
        rows.push(...batch);
        if (batch.length < 100)
            break;
    }
    return rows;
}
async function startAdsPowerProfile(userId) {
    const id = String(userId || "").trim();
    if (!id)
        throw new Error("Informe o perfil AdsPower.");
    const ping = await adsPowerGet("/api/v1/browser/start", {
        user_id: id,
        open_tabs: "1",
        ip_tab: "0",
    }, 20000);
    if (!ping.ok) {
        throw new Error(ping.msg || "Não foi possível abrir o perfil no AdsPower.");
    }
    const data = ping.data;
    return { debugPort: data?.debug_port ? String(data.debug_port) : null };
}
