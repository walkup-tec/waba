import { defaultEvoSendTextTimeoutMs, evoHttpRequest } from "../evo-http.client";
import {
  describeEvoConnectionMismatch,
  fetchEvoInstanceLiveState,
  isEvoLiveStateOpen,
  resolveEvoLiveConnectionSnapshots,
  type EvoLiveConnectionSnapshot,
} from "../instances/evo-connection-state.service";
import { extractPhoneFromEvoListItem } from "../instances/evo-instance-phone.service";

const EVO_API_BASE = String(process.env.EVO_API_URL || "http://walkup-evo-walkup-api:8080").replace(
  /\/$/,
  "",
);
const EVO_API_KEY = String(process.env.EVO_API_KEY || "429683C4C977415CAAFCCE10F7D57E11");
const EVO_INSTANCES_URL =
  String(process.env.EVO_INSTANCES_URL || "").trim() ||
  `${EVO_API_BASE}/instance/fetchInstances`;
const EVO_SEND_TEXT_V1 =
  process.env.EVO_SEND_TEXT_V1 === "1" || process.env.EVO_SEND_TEXT_V1 === "true";

export type EvoIntegrationProbeResult = {
  ok: boolean;
  evoApiBase: string;
  fetchOpenCount: number;
  liveOpenCount: number;
  snapshots: EvoLiveConnectionSnapshot[];
  mismatchDetail: string;
  sendTest: null | {
    from: string;
    to: string;
    toNumber: string;
    status: number;
    accepted: boolean;
    detail: string;
    durationMs: number;
  };
  receiveTest: null | {
    destInstance: string;
    ok: boolean;
    detail: string;
  };
};

function parseEvoInstancesList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if (Array.isArray(record.response)) return record.response;
    if (Array.isArray(record.data)) return record.data;
  }
  return raw ? [raw] : [];
}

function buildSendTextBody(numero: string, text: string): Record<string, unknown> {
  return EVO_SEND_TEXT_V1
    ? { number: numero, textMessage: { text } }
    : { number: numero, text, textMessage: { text } };
}

function isSendAccepted(json: unknown, body: string): boolean {
  const rawBody = String(body || "").trim();
  if (rawBody.toLowerCase().includes('"error"')) return false;
  if (!json || typeof json !== "object") return true;
  const root = json as Record<string, unknown>;
  if (root.error) return false;
  return true;
}

async function findProbeMarker(
  destInstance: string,
  marker: string,
  fromDigits: string,
): Promise<boolean> {
  const enc = encodeURIComponent(destInstance);
  const jid = `${String(fromDigits).replace(/\D/g, "")}@s.whatsapp.net`;
  const url = `${EVO_API_BASE}/chat/findMessages/${enc}`;
  const bodies: Record<string, unknown>[] = [
    { where: { key: { remoteJid: jid } }, limit: 30 },
    { limit: 40 },
    {},
  ];
  for (const body of bodies) {
    const result = await evoHttpRequest(url, "POST", {
      apiKey: EVO_API_KEY,
      body,
      timeoutMs: 15_000,
      retries: 1,
    });
    if (!result.ok) continue;
    const hay = JSON.stringify(result.json ?? result.body ?? "").toLowerCase();
    if (hay.includes(marker.toLowerCase())) return true;
  }
  return false;
}

export async function runEvoIntegrationProbe(): Promise<EvoIntegrationProbeResult> {
  const listResult = await evoHttpRequest(EVO_INSTANCES_URL, "GET", {
    apiKey: EVO_API_KEY,
    timeoutMs: 15_000,
    retries: 1,
  });

  const instances = listResult.ok ? parseEvoInstancesList(listResult.json) : [];
  const snapshots = instances.length ? await resolveEvoLiveConnectionSnapshots(instances) : [];
  const fetchOpenCount = snapshots.filter((row) => row.fetchStatus.includes("open")).length;
  const liveOpen = snapshots.filter((row) => row.trulyOpen);
  const mismatchDetail = describeEvoConnectionMismatch(snapshots);

  const base: EvoIntegrationProbeResult = {
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
      mismatchDetail:
        mismatchDetail ||
        `Apenas ${liveOpen.length} instância(s) com connectionState=open (fetchInstances open=${fetchOpenCount}). Reconecte QR ou reinicie Evolution.`,
    };
  }

  const fromSnap = liveOpen[0];
  const toSnap = liveOpen[1];
  const fromRow = instances
    .map((item) => extractPhoneFromEvoListItem(item))
    .find((row) => row?.instanceName === fromSnap.instanceName);
  const toRow = instances
    .map((item) => extractPhoneFromEvoListItem(item))
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
  const sendResult = await evoHttpRequest(sendUrl, "POST", {
    apiKey: EVO_API_KEY,
    body: buildSendTextBody(toNumber, text),
    timeoutMs: defaultEvoSendTextTimeoutMs(),
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
