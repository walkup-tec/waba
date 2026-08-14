"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichViaReceitaWs = enrichViaReceitaWs;
exports.leadLooksEnriched = leadLooksEnriched;
exports.formatReceitaWsLegend = formatReceitaWsLegend;
exports.enrichLeadsCnpjList = enrichLeadsCnpjList;
const waba_leads_cnpj_repository_1 = require("./waba-leads-cnpj.repository");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function pickString(...values) {
    for (const value of values) {
        const text = String(value ?? "").trim();
        if (text)
            return text;
    }
    return "";
}
function mapReceitaPayload(payload, fallbackCnpj) {
    const logradouro = pickString(payload.logradouro);
    const numero = pickString(payload.numero);
    return {
        cnpj: (0, waba_leads_cnpj_repository_1.normalizeCnpjDigits)(payload.cnpj || fallbackCnpj),
        nome: pickString(payload.nome, payload.fantasia),
        telefone: pickString(payload.telefone),
        email: pickString(payload.email),
        situacao: pickString(payload.situacao),
        dataAbertura: pickString(payload.abertura),
        cidade: pickString(payload.municipio),
        estado: pickString(payload.uf),
        endereco: [logradouro, numero].filter(Boolean).join(", "),
    };
}
function receitaWsMinGapMs() {
    return Math.max(1000, Math.round(Number(process.env.RECEITAWS_DELAY_MS || 30000) || 30000));
}
/** Espaçamento global entre chamadas ReceitaWS (evita 429 com refresh + enrich em paralelo). */
let lastReceitaWsAt = 0;
let receitaWsTail = Promise.resolve();
async function withReceitaWsPace(fn) {
    let release;
    const gate = new Promise((resolve) => {
        release = resolve;
    });
    const previous = receitaWsTail;
    receitaWsTail = previous.then(() => gate, () => gate);
    await previous.catch(() => undefined);
    try {
        const gap = receitaWsMinGapMs();
        const wait = Math.max(0, lastReceitaWsAt + gap - Date.now());
        if (wait > 0)
            await sleep(wait);
        lastReceitaWsAt = Date.now();
        return await fn();
    }
    finally {
        release();
    }
}
async function enrichViaReceitaWs(cnpj, apiKey) {
    const digits = (0, waba_leads_cnpj_repository_1.normalizeCnpjDigits)(cnpj);
    if (digits.length !== 14) {
        return {
            cnpj: digits,
            nome: "",
            telefone: "",
            email: "",
            situacao: "CNPJ inválido",
            dataAbertura: "",
            cidade: "",
            estado: "",
            endereco: "",
        };
    }
    const headers = { Accept: "application/json" };
    if (apiKey)
        headers.Authorization = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
    return withReceitaWsPace(async () => {
        const maxAttempts = 4;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 45000);
            try {
                const response = await fetch(`https://www.receitaws.com.br/v1/cnpj/${digits}`, {
                    method: "GET",
                    headers,
                    signal: controller.signal,
                });
                const payload = (await response.json().catch(() => ({})));
                if (response.status === 429) {
                    if (attempt >= maxAttempts)
                        throw new Error("ReceitaWS HTTP 429");
                    lastReceitaWsAt = Date.now();
                    await sleep(receitaWsMinGapMs() * attempt);
                    lastReceitaWsAt = Date.now();
                    continue;
                }
                if (!response.ok)
                    throw new Error(`ReceitaWS HTTP ${response.status}`);
                if (String(payload.status || "").toLowerCase() === "error") {
                    const msg = String(payload.message || "Falha na consulta ReceitaWS.");
                    if (/too many requests/i.test(msg) && attempt < maxAttempts) {
                        lastReceitaWsAt = Date.now();
                        await sleep(receitaWsMinGapMs() * attempt);
                        lastReceitaWsAt = Date.now();
                        continue;
                    }
                    throw new Error(msg);
                }
                return mapReceitaPayload(payload, digits);
            }
            finally {
                clearTimeout(timer);
            }
        }
        throw new Error("ReceitaWS indisponível após retentativas.");
    });
}
async function enrichViaN8nWebhook(listId, leads, webhookUrl) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
                listId,
                cnpjs: leads.map((lead) => lead.cnpj).filter(Boolean),
                leads,
            }),
            signal: controller.signal,
        });
        if (!response.ok)
            throw new Error(`Webhook N8n HTTP ${response.status}`);
        const payload = (await response.json().catch(() => null));
        const rows = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.leads)
                ? payload.leads
                : null;
        if (!rows)
            return null;
        return rows.map((row) => {
            const item = (row && typeof row === "object" ? row : {});
            return {
                cnpj: (0, waba_leads_cnpj_repository_1.normalizeCnpjDigits)(item.cnpj || item.CNPJ),
                nome: pickString(item.nome, item.Nome, item["Nome (Razão Social)"]),
                telefone: pickString(item.telefone, item.Telefone),
                email: pickString(item.email, item.Email, item["E-mail"]),
                situacao: pickString(item.situacao, item.Situação, item.Situacao),
                dataAbertura: pickString(item.dataAbertura, item["Data Abertura"], item["Data de Abertura"]),
                cidade: pickString(item.cidade, item.Cidade, item.municipio),
                estado: pickString(item.estado, item.Estado, item.uf),
                endereco: pickString(item.endereco, item.Endereço, item.Endereco),
            };
        });
    }
    finally {
        clearTimeout(timer);
    }
}
/** Heurística: lead já passou pela ReceitaWS (fecha lote parcial do dia). */
function leadLooksEnriched(lead) {
    if (lead.enriched)
        return true;
    if (String(lead.dataAbertura || "").trim())
        return true;
    if (String(lead.email || "").trim())
        return true;
    if (String(lead.telefone || "").trim())
        return true;
    const sit = String(lead.situacao || "").trim();
    if (sit && /^(ativa|baixada|inapta|nula|suspensa|falha)/i.test(sit))
        return true;
    return false;
}
function formatMmSs(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
/** Legenda padrão: ReceitaWS 248/1758 - Próximo em 00:35 */
function formatReceitaWsLegend(done, total, suffix) {
    const safeDone = Math.max(0, Math.min(done, total));
    const safeTotal = Math.max(0, total);
    return `ReceitaWS ${safeDone}/${safeTotal} - ${suffix}`;
}
async function sleepWithCountdown(ms, onTick) {
    const end = Date.now() + Math.max(0, ms);
    for (;;) {
        const left = Math.max(0, end - Date.now());
        onTick(left);
        if (left <= 0)
            return;
        await sleep(Math.min(1000, left));
    }
}
/** Uma consulta ReceitaWS por vez no processo (evita dois lotes resetando sensação de progresso). */
let enrichTail = Promise.resolve();
async function withEnrichLock(fn) {
    let release;
    const gate = new Promise((resolve) => {
        release = resolve;
    });
    const previous = enrichTail;
    enrichTail = previous.then(() => gate, () => gate);
    await previous.catch(() => undefined);
    try {
        return await fn();
    }
    finally {
        release();
    }
}
async function enrichLeadsCnpjList(listId, leads, onProgress, onCheckpoint, shouldAbort) {
    const total = Array.isArray(leads) ? leads.length : 0;
    const already = (leads || []).filter((lead) => leadLooksEnriched(lead)).length;
    let waitingLock = true;
    const pulse = setInterval(() => {
        if (!waitingLock)
            return;
        if (shouldAbort?.())
            return;
        onProgress?.(formatReceitaWsLegend(already, total, "Na fila (aguardando outra lista)…"));
    }, 2000);
    onProgress?.(formatReceitaWsLegend(already, total, "Na fila (aguardando outra lista)…"));
    try {
        if (shouldAbort?.()) {
            throw new Error("__MLC_JOB_ABORTED__");
        }
        return await withEnrichLock(async () => {
            waitingLock = false;
            clearInterval(pulse);
            if (shouldAbort?.()) {
                throw new Error("__MLC_JOB_ABORTED__");
            }
            return enrichLeadsCnpjListUnlocked(listId, leads, onProgress, onCheckpoint, shouldAbort);
        });
    }
    finally {
        waitingLock = false;
        clearInterval(pulse);
    }
}
async function enrichLeadsCnpjListUnlocked(listId, leads, onProgress, onCheckpoint, shouldAbort) {
    const assertAlive = () => {
        if (shouldAbort?.())
            throw new Error("__MLC_JOB_ABORTED__");
    };
    assertAlive();
    const webhookUrl = String(process.env.N8N_LEADS_CNPJ_WEBHOOK_URL || "").trim();
    if (webhookUrl) {
        onProgress?.("Enriquecendo via webhook N8n…");
        try {
            const fromWebhook = await enrichViaN8nWebhook(listId, leads, webhookUrl);
            assertAlive();
            if (fromWebhook?.length) {
                const done = fromWebhook.map((lead) => ({ ...lead, enriched: true }));
                onCheckpoint?.(done, done.length);
                return done;
            }
            onProgress?.("Webhook N8n sem leads no retorno; usando ReceitaWS local.");
        }
        catch (error) {
            if (error instanceof Error && error.message === "__MLC_JOB_ABORTED__")
                throw error;
            const message = error instanceof Error ? error.message : "falha no webhook";
            onProgress?.(`Webhook N8n indisponível (${message}); usando ReceitaWS local.`);
        }
    }
    const apiKey = String(process.env.RECEITAWS_API_KEY || "").trim();
    // N8n template: Wait1 amount=30 (segundos) antes de cada consulta ReceitaWS ≈ 2/min.
    const delayMs = Math.max(1000, Math.round(Number(process.env.RECEITAWS_DELAY_MS || 30000) || 30000));
    const out = leads.map((lead) => ({
        ...lead,
        enriched: leadLooksEnriched(lead),
    }));
    const total = out.length;
    const countDone = () => out.filter((l) => l.enriched).length;
    let done = countDone();
    if (done > 0 && done < total) {
        onProgress?.(formatReceitaWsLegend(done, total, "retomando…"));
    }
    else if (done === 0) {
        onProgress?.(formatReceitaWsLegend(0, total, "iniciando…"));
    }
    for (let index = 0; index < out.length; index += 1) {
        assertAlive();
        const current = out[index];
        if (current.enriched) {
            continue;
        }
        done = countDone();
        onProgress?.(formatReceitaWsLegend(done, total, "consultando…"));
        try {
            const next = await enrichViaReceitaWs(current.cnpj, apiKey);
            assertAlive();
            out[index] = {
                ...current,
                ...next,
                cnpj: next.cnpj || current.cnpj,
                nome: next.nome || current.nome,
                telefone: next.telefone || current.telefone,
                email: next.email || current.email,
                situacao: next.situacao || current.situacao,
                dataAbertura: next.dataAbertura || current.dataAbertura,
                cidade: next.cidade || current.cidade,
                estado: next.estado || current.estado,
                endereco: next.endereco || current.endereco,
                enriched: true,
            };
        }
        catch (error) {
            if (error instanceof Error && error.message === "__MLC_JOB_ABORTED__")
                throw error;
            out[index] = {
                ...current,
                situacao: current.situacao || "Falha no enriquecimento",
                enriched: true,
            };
        }
        done = countDone();
        onCheckpoint?.(out.map((lead) => ({ ...lead })), done);
        const hasPending = out.slice(index + 1).some((lead) => !lead.enriched);
        if (hasPending) {
            await sleepWithCountdown(delayMs, (leftMs) => {
                if (shouldAbort?.())
                    throw new Error("__MLC_JOB_ABORTED__");
                onProgress?.(formatReceitaWsLegend(done, total, `Próximo em ${formatMmSs(leftMs)}`));
            });
        }
        else {
            onProgress?.(formatReceitaWsLegend(done, total, "concluído"));
        }
    }
    return out;
}
