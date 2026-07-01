"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runEvoIntegrationProbe = runEvoIntegrationProbe;
const evo_http_client_1 = require("../evo-http.client");
const evo_connection_state_service_1 = require("../instances/evo-connection-state.service");
const evo_instance_phone_service_1 = require("../instances/evo-instance-phone.service");
const EVO_API_BASE = String(process.env.EVO_API_URL || "http://walkup-evo-walkup-api:8080").replace(/\/$/, "");
const EVO_API_KEY = String(process.env.EVO_API_KEY || "429683C4C977415CAAFCCE10F7D57E11");
const EVO_INSTANCES_URL = String(process.env.EVO_INSTANCES_URL || "").trim() ||
    `${EVO_API_BASE}/instance/fetchInstances`;
const EVO_SEND_TEXT_V1 = process.env.EVO_SEND_TEXT_V1 === "1" || process.env.EVO_SEND_TEXT_V1 === "true";
function parseEvoInstancesList(raw) {
    if (Array.isArray(raw))
        return raw;
    if (raw && typeof raw === "object") {
        const record = raw;
        if (Array.isArray(record.response))
            return record.response;
        if (Array.isArray(record.data))
            return record.data;
    }
    return raw ? [raw] : [];
}
function buildSendTextBody(numero, text) {
    return EVO_SEND_TEXT_V1
        ? { number: numero, textMessage: { text } }
        : { number: numero, text, textMessage: { text } };
}
function isSendAccepted(json, body) {
    const rawBody = String(body || "").trim();
    if (rawBody.toLowerCase().includes('"error"'))
        return false;
    if (!json || typeof json !== "object")
        return true;
    const root = json;
    if (root.error)
        return false;
    return true;
}
async function findProbeMarker(destInstance, marker, fromDigits) {
    const enc = encodeURIComponent(destInstance);
    const jid = `${String(fromDigits).replace(/\D/g, "")}@s.whatsapp.net`;
    const url = `${EVO_API_BASE}/chat/findMessages/${enc}`;
    const bodies = [
        { where: { key: { remoteJid: jid } }, limit: 30 },
        { limit: 40 },
        {},
    ];
    for (const body of bodies) {
        const result = await (0, evo_http_client_1.evoHttpRequest)(url, "POST", {
            apiKey: EVO_API_KEY,
            body,
            timeoutMs: 15000,
            retries: 1,
        });
        if (!result.ok)
            continue;
        const hay = JSON.stringify(result.json ?? result.body ?? "").toLowerCase();
        if (hay.includes(marker.toLowerCase()))
            return true;
    }
    return false;
}
async function runEvoIntegrationProbe() {
    const listResult = await (0, evo_http_client_1.evoHttpRequest)(EVO_INSTANCES_URL, "GET", {
        apiKey: EVO_API_KEY,
        timeoutMs: 15000,
        retries: 1,
    });
    const instances = listResult.ok ? parseEvoInstancesList(listResult.json) : [];
    const snapshots = instances.length ? await (0, evo_connection_state_service_1.resolveEvoLiveConnectionSnapshots)(instances) : [];
    const fetchOpenCount = snapshots.filter((row) => row.fetchStatus.includes("open")).length;
    const liveOpen = snapshots.filter((row) => row.trulyOpen);
    const mismatchDetail = (0, evo_connection_state_service_1.describeEvoConnectionMismatch)(snapshots);
    const base = {
        ok: false,
        evoApiBase: EVO_API_BASE,
        fetchOpenCount,
        liveOpenCount: liveOpen.length,
        snapshots,
        mismatchDetail,
        sendTest: null,
        receiveTest: null,
    };
    if (!listResult.ok) {
        return {
            ...base,
            mismatchDetail: `fetchInstances falhou HTTP ${listResult.status}: ${String(listResult.body || listResult.error || "").slice(0, 200)}`,
        };
    }
    if (liveOpen.length < 2) {
        return {
            ...base,
            mismatchDetail: mismatchDetail ||
                `Apenas ${liveOpen.length} instância(s) com connectionState=open (fetchInstances open=${fetchOpenCount}). Reconecte QR ou reinicie Evolution.`,
        };
    }
    const fromSnap = liveOpen[0];
    const toSnap = liveOpen[1];
    const fromRow = instances
        .map((item) => (0, evo_instance_phone_service_1.extractPhoneFromEvoListItem)(item))
        .find((row) => row?.instanceName === fromSnap.instanceName);
    const toRow = instances
        .map((item) => (0, evo_instance_phone_service_1.extractPhoneFromEvoListItem)(item))
        .find((row) => row?.instanceName === toSnap.instanceName);
    const toNumber = String(toRow?.phone || "").trim();
    if (!toNumber) {
        return {
            ...base,
            mismatchDetail: `Instância destino ${toSnap.instanceName} sem número (ownerJid).`,
        };
    }
    const marker = `evoprobe${Date.now().toString(36).slice(-5)}`;
    const text = `WABA integration probe ${marker}`;
    const sendUrl = `${EVO_API_BASE}/message/sendText/${encodeURIComponent(fromSnap.instanceName)}`;
    const started = Date.now();
    const sendResult = await (0, evo_http_client_1.evoHttpRequest)(sendUrl, "POST", {
        apiKey: EVO_API_KEY,
        body: buildSendTextBody(toNumber, text),
        timeoutMs: (0, evo_http_client_1.defaultEvoSendTextTimeoutMs)(),
        retries: 2,
    });
    const accepted = sendResult.ok && isSendAccepted(sendResult.json, sendResult.body);
    const sendTest = {
        from: fromSnap.instanceName,
        to: toSnap.instanceName,
        toNumber,
        status: sendResult.status,
        accepted,
        detail: String(sendResult.error || sendResult.body || "").slice(0, 400),
        durationMs: Date.now() - started,
    };
    if (!accepted) {
        return {
            ...base,
            sendTest,
            mismatchDetail: `sendText ${fromSnap.instanceName} → ${toNumber} falhou (HTTP ${sendResult.status}). ${sendTest.detail}`,
        };
    }
    await new Promise((r) => setTimeout(r, 5000));
    const fromDigits = String(fromRow?.phone || "").trim();
    const found = fromDigits
        ? await findProbeMarker(toSnap.instanceName, marker, fromDigits)
        : false;
    return {
        ...base,
        ok: found,
        sendTest,
        receiveTest: {
            destInstance: toSnap.instanceName,
            ok: found,
            detail: found
                ? "Mensagem encontrada via findMessages no destino."
                : "sendText OK mas mensagem não apareceu no destino (findMessages).",
        },
        mismatchDetail: found ? "" : "Envio HTTP OK porém recepção não confirmada.",
    };
}
