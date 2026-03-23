process.env.TZ = process.env.TZ || "America/Sao_Paulo";
import express from "express";
import path from "path";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

// Supabase (criado sob demanda para evitar travamentos quando faltar config)
let supabaseClient: ReturnType<typeof createClient> | null = null;
function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseClient;
}

function normalizeInstanceUsageRow(row: any): InstanceUsageConfig {
  return {
    useAquecedor: row?.use_aquecedor !== false,
    useDisparador: row?.use_disparador !== false,
    updatedAt: String(row?.updated_at || new Date().toISOString()),
  };
}

async function loadInstanceUsageMap(): Promise<Map<string, InstanceUsageConfig>> {
  const result = new Map<string, InstanceUsageConfig>();
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await (supabase
        .from("instancias_uso_config" as any)
        .select("instance_name, use_aquecedor, use_disparador, updated_at")
        .limit(2000)) as any;
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const key = String(row?.instance_name || "").trim();
          if (!key) continue;
          result.set(key, normalizeInstanceUsageRow(row));
        }
      }
    } catch {
      // fallback em memória
    }
  }
  for (const [k, v] of instanceUsageMemory.entries()) {
    if (!result.has(k)) result.set(k, v);
  }
  return result;
}

async function persistInstanceUsage(
  items: Array<{ instanceName: string; useAquecedor: boolean; useDisparador: boolean }>
) {
  const now = new Date().toISOString();
  for (const item of items) {
    const key = String(item.instanceName || "").trim();
    if (!key) continue;
    instanceUsageMemory.set(key, {
      useAquecedor: item.useAquecedor !== false,
      useDisparador: item.useDisparador !== false,
      updatedAt: now,
    });
  }
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    const rows = items
      .map((item) => ({
        instance_name: String(item.instanceName || "").trim(),
        use_aquecedor: item.useAquecedor !== false,
        use_disparador: item.useDisparador !== false,
        updated_at: now,
      }))
      .filter((r) => r.instance_name);
    if (!rows.length) return;
    await (supabase.from("instancias_uso_config" as any) as any).upsert(rows, {
      onConflict: "instance_name",
    });
  } catch {
    // fallback em memória
  }
}

function parseDisparosConfig(input: any): DisparosConfig {
  const readInt = (value: any, min: number, max: number, fallback: number) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const v = Math.floor(n);
    if (v < min || v > max) return fallback;
    return v;
  };
  const workingDays = Array.isArray(input?.workingDays)
    ? input.workingDays
        .map((d: any) => String(d || "").toLowerCase().trim())
        .filter((d: string) => DAY_CODES.includes(d as any))
    : DISPAROS_DEFAULTS.workingDays;
  const provider = String(input?.shortenerProvider || DISPAROS_DEFAULTS.shortenerProvider).toLowerCase();
  const safeProvider: DisparosConfig["shortenerProvider"] =
    provider === "isgd" || provider === "tinyurl"
      ? (provider as DisparosConfig["shortenerProvider"])
      : "isgd";
  const mode = String(input?.messageMode || DISPAROS_DEFAULTS.messageMode).toLowerCase();
  const safeMode: DisparosConfig["messageMode"] = mode === "database" ? "database" : "ai";
  const delayMin = readInt(input?.delayMinSeconds, 10, 3600, DISPAROS_DEFAULTS.delayMinSeconds);
  const delayMax = readInt(input?.delayMaxSeconds, 10, 3600, DISPAROS_DEFAULTS.delayMaxSeconds);
  const safeDelayMin = Math.min(delayMin, delayMax);
  const safeDelayMax = Math.max(delayMin, delayMax);

  // Regra segura de lock:
  // - TTL não é controlado pelo usuário.
  // - Baseado no maior delay configurado, com margem de segurança.
  // - Limites fixos para evitar lock curto/demorado demais.
  const ttlBase = safeDelayMax * 3;
  const safeLockTtl = Math.max(180, Math.min(1800, ttlBase));
  return {
    lockTtlSeconds: safeLockTtl,
    delayMinSeconds: safeDelayMin,
    delayMaxSeconds: safeDelayMax,
    maxPerHourPerInstance: readInt(
      input?.maxPerHourPerInstance,
      1,
      10000,
      DISPAROS_DEFAULTS.maxPerHourPerInstance
    ),
    maxPerDayPerInstance: readInt(
      input?.maxPerDayPerInstance,
      1,
      200000,
      DISPAROS_DEFAULTS.maxPerDayPerInstance
    ),
    workingDays: workingDays.length ? Array.from(new Set(workingDays)) : [...DISPAROS_DEFAULTS.workingDays],
    startHour: readInt(input?.startHour, 0, 23, DISPAROS_DEFAULTS.startHour),
    endHour: readInt(input?.endHour, 1, 24, DISPAROS_DEFAULTS.endHour),
    messageMode: safeMode,
    aiBriefing: String(input?.aiBriefing || "").slice(0, 8000),
    aiTone: String(input?.aiTone || DISPAROS_DEFAULTS.aiTone).slice(0, 120),
    aiCta: String(input?.aiCta || DISPAROS_DEFAULTS.aiCta).slice(0, 240),
    aiAudience: String(input?.aiAudience || DISPAROS_DEFAULTS.aiAudience).slice(0, 240),
    shortenerProvider: safeProvider,
    shortenerDomain: String(input?.shortenerDomain || "").slice(0, 120),
    whatsappTargetNumber: normalizeWhatsAppNumber(String(input?.whatsappTargetNumber || "")),
  };
}

async function loadDisparosConfigFromDb(): Promise<DisparosConfig> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ...DISPAROS_DEFAULTS };
  try {
    const { data, error } = await (supabase
      .from("disparos_config" as any)
      .select("custom_config")
      .eq("id", 1)
      .maybeSingle()) as any;
    if (error) return { ...DISPAROS_DEFAULTS };
    return parseDisparosConfig(data?.custom_config || DISPAROS_DEFAULTS);
  } catch {
    return { ...DISPAROS_DEFAULTS };
  }
}

async function saveDisparosConfigToDb(config: DisparosConfig) {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  try {
    await (supabase.from("disparos_config" as any) as any).upsert(
      {
        id: 1,
        custom_config: config,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  } catch {
    // fallback silencioso
  }
}

const EVO_API_URL =
  process.env.EVO_API_URL || "http://walkup-evo-walkup-api:8080";
const EVO_API_BASE = EVO_API_URL.replace(/\/$/, "");
const EVO_INSTANCES_URL =
  process.env.EVO_INSTANCES_URL ||
  `${EVO_API_BASE}/instance/fetchInstances`;
const EVO_API_KEY =
  process.env.EVO_API_KEY || "429683C4C977415CAAFCCE10F7D57E11";
const EVO_REFRESH_URL_TEMPLATE =
  process.env.EVO_REFRESH_URL_TEMPLATE || "";
const EVO_QRCODE_URL_TEMPLATE =
  process.env.EVO_QRCODE_URL_TEMPLATE ||
  `${EVO_API_BASE}/instance/connect/{instance}`;
const EVO_DELETE_URL_TEMPLATE =
  process.env.EVO_DELETE_URL_TEMPLATE ||
  `${EVO_API_BASE}/instance/delete/{instance}`;
const EVO_CREATE_INSTANCE_URL =
  process.env.EVO_CREATE_INSTANCE_URL || `${EVO_API_BASE}/instance/create`;
const EVO_SEND_TEXT_URL_TEMPLATE =
  process.env.EVO_SEND_TEXT_URL_TEMPLATE || `${EVO_API_BASE}/message/sendText/{instance}`;
const EVO_SEND_TEXT_V1 = process.env.EVO_SEND_TEXT_V1 === "1" || process.env.EVO_SEND_TEXT_V1 === "true";

const DAY_CODES = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;
const DAY_TO_NUM: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };

const AQUECEDOR_DEFAULTS = {
  expediente: [
    { days: ["seg", "ter", "qua"], startHour: 7, endHour: 22 },
    { days: ["qui", "sex", "sab", "dom"], startHour: 6, endHour: 20 },
  ] as Array<{ days: string[]; startHour: number; endHour: number }>,
  janelaAtivaMinutos: 60,
  pausaMinutos: 14,
  waitMinSeconds: 180,
  waitMaxSeconds: 480,
};

type AquecedorConfig = typeof AQUECEDOR_DEFAULTS;

type InstanceUsageConfig = {
  useAquecedor: boolean;
  useDisparador: boolean;
  updatedAt: string;
};

type DisparosConfig = {
  lockTtlSeconds: number;
  delayMinSeconds: number;
  delayMaxSeconds: number;
  maxPerHourPerInstance: number;
  maxPerDayPerInstance: number;
  workingDays: string[];
  startHour: number;
  endHour: number;
  messageMode: "ai" | "database";
  aiBriefing: string;
  aiTone: string;
  aiCta: string;
  aiAudience: string;
  shortenerProvider: "isgd" | "tinyurl";
  shortenerDomain: string;
  whatsappTargetNumber: string;
};

type MessageTemplate = {
  id: string;
  text: string;
  alias: string;
  segment: string;
  source: "manual" | "spreadsheet";
  createdAt: string;
  active: boolean;
};

const DISPAROS_DEFAULTS: DisparosConfig = {
  lockTtlSeconds: 600,
  delayMinSeconds: 90,
  delayMaxSeconds: 240,
  maxPerHourPerInstance: 60,
  maxPerDayPerInstance: 130,
  workingDays: ["seg", "ter", "qua", "qui", "sex"],
  startHour: 8,
  endHour: 22,
  messageMode: "ai",
  aiBriefing: "",
  aiTone: "consultivo",
  aiCta: "Responda no link abaixo",
  aiAudience: "CORBAN",
  shortenerProvider: "isgd",
  shortenerDomain: "",
  whatsappTargetNumber: "",
};

const instanceUsageMemory = new Map<string, InstanceUsageConfig>();
const disparosTemplatesMemory: MessageTemplate[] = [];
let disparosRoundRobinCounter = 0;
let lastShortUrlIssued = "";

function normalizeShortenerProvider(
  value: string | null | undefined
): DisparosConfig["shortenerProvider"] {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "isgd") return "isgd";
  if (raw === "tinyurl") return "tinyurl";
  return "isgd";
}

function getAutoShortenerProviderOrder(): DisparosConfig["shortenerProvider"][] {
  const forced = normalizeShortenerProvider(process.env.SHORTENER_PROVIDER);
  // ordem padrão segura/custo: isgd -> tinyurl
  if (process.env.SHORTENER_PROVIDER) return [forced];
  return ["isgd", "tinyurl"];
}

type AquecedorRuntimeStatus = {
  running: boolean;
  isProcessing: boolean;
  nextAllowedAt: string | null;
  lastRunAt: string | null;
  lastResult: string | null;
  lastEvoError: { status: number; body: string; instance: string; numeroLen: number } | null;
};

const aquecedorRuntime: AquecedorRuntimeStatus = {
  running: false,
  isProcessing: false,
  nextAllowedAt: null,
  lastRunAt: null,
  lastResult: null,
  lastEvoError: null,
};

let aquecedorInterval: NodeJS.Timeout | null = null;

function parseAquecedorConfig(input: any): AquecedorConfig {
  const readInt = (key: string, min: number, max: number, fallback: number) => {
    const raw = Number(input?.[key]);
    if (!Number.isFinite(raw)) return fallback;
    const value = Math.floor(raw);
    if (value < min || value > max) {
      throw new Error(`Campo '${key}' fora do intervalo permitido (${min}-${max}).`);
    }
    return value;
  };

  let expediente = AQUECEDOR_DEFAULTS.expediente;
  if (input?.expediente && Array.isArray(input.expediente) && input.expediente.length > 0) {
    expediente = input.expediente.map((batch: any) => {
      const days = Array.isArray(batch?.days) ? batch.days.filter((d: string) => DAY_CODES.includes(d as any)) : [];
      const startHour = Math.max(0, Math.min(23, Math.floor(Number(batch?.startHour ?? 7))));
      const endHour = Math.max(1, Math.min(24, Math.floor(Number(batch?.endHour ?? 22))));
      if (days.length === 0) throw new Error("Cada lote deve ter pelo menos um dia.");
      if (endHour <= startHour) throw new Error("Hora final deve ser maior que a inicial.");
      return { days, startHour, endHour };
    });
  } else if (input?.windowMonWedStartHour != null) {
    const mwStart = Math.max(0, Math.min(23, Math.floor(Number(input.windowMonWedStartHour ?? 7))));
    const mwEnd = Math.max(1, Math.min(24, Math.floor(Number(input.windowMonWedEndHour ?? 22))));
    const tsStart = Math.max(0, Math.min(23, Math.floor(Number(input.windowThuSunStartHour ?? 6))));
    const tsEnd = Math.max(1, Math.min(24, Math.floor(Number(input.windowThuSunEndHour ?? 20))));
    expediente = [
      { days: ["seg", "ter", "qua"], startHour: mwStart, endHour: mwEnd },
      { days: ["qui", "sex", "sab", "dom"], startHour: tsStart, endHour: tsEnd },
    ];
  }

  const janelaAtivaMinutos = input?.janelaAtivaMinutos != null
    ? Math.max(1, Math.min(240, Math.floor(Number(input.janelaAtivaMinutos) || 60)))
    : (input?.activeWindowMinutes != null ? Math.max(1, Math.min(240, Math.floor(Number(input.activeWindowMinutes) || 60))) : 60);
  const pausaMinutos = input?.pausaMinutos != null
    ? Math.max(0, Math.min(240, Math.floor(Number(input.pausaMinutos) || 14)))
    : (input?.pauseMonWedMinutes != null ? Math.max(0, Math.min(240, Math.floor(Number(input.pauseMonWedMinutes) || 14))) : 14);
  const waitMinSeconds = Math.max(10, Math.min(3600, Math.floor(Number(input?.waitMinSeconds) || 180)));
  const waitMaxSeconds = Math.max(10, Math.min(3600, Math.floor(Number(input?.waitMaxSeconds) || 480)));

  if (waitMaxSeconds < waitMinSeconds) {
    throw new Error("Espera máxima deve ser maior ou igual à mínima.");
  }

  return { expediente, janelaAtivaMinutos, pausaMinutos, waitMinSeconds, waitMaxSeconds };
}

function nowInSaoPaulo() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

function formatDateBr(isoOrNull: string | null | undefined): string {
  if (!isoOrNull || typeof isoOrNull !== "string") return "sem data";
  try {
    let s = isoOrNull.trim();
    if (!s) return "sem data";
    if (!/Z$|[+-]\d{2}:?\d{2}$/.test(s) && (s.includes("T") || /\d{4}-\d{2}-\d{2}\s+\d/.test(s))) {
      s = s.replace(" ", "T") + "Z";
    }
    const d = new Date(s);
    if (isNaN(d.getTime())) return "sem data";
    return d.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "sem data";
  }
}

function isAquecedorWindowOpen(config: AquecedorConfig, now: Date) {
  const day = now.getDay();
  const dayCode = DAY_CODES[day];
  const hour = now.getHours();
  const minute = now.getMinutes();
  const minutesOfDay = hour * 60 + minute;

  for (const batch of config.expediente || []) {
    if (!batch.days.includes(dayCode)) continue;
    if (hour < batch.startHour || hour >= batch.endHour) return false;
    const cycle = config.janelaAtivaMinutos + config.pausaMinutos;
    if (cycle <= 0) return false;
    return minutesOfDay % cycle < config.janelaAtivaMinutos;
  }
  return false;
}

async function loadAquecedorConfigFromDb() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase não configurado.");

  const { data, error } = await (supabase
    .from("aquecedor_config" as any)
    .select("use_recommended, custom_config")
    .eq("id", 1)
    .maybeSingle()) as any;

  if (error) throw new Error("Falha ao buscar configuração do aquecedor.");

  const useRecommended = data?.use_recommended !== false;
  const customConfigRaw =
    data?.custom_config && typeof data.custom_config === "object"
      ? data.custom_config
      : AQUECEDOR_DEFAULTS;

  let customConfig: AquecedorConfig = AQUECEDOR_DEFAULTS;
  try {
    customConfig = parseAquecedorConfig(customConfigRaw);
  } catch {
    customConfig = AQUECEDOR_DEFAULTS;
  }
  return useRecommended ? AQUECEDOR_DEFAULTS : customConfig;
}

async function runAquecedorCycleTestBatch(
  connected: Array<{ instancia: string; numero: string }>,
  cicloGlobal: number,
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  _config: AquecedorConfig
) {
  const originIdx = cicloGlobal % connected.length;
  const origem = connected[originIdx];
  const destinos = connected.filter((_, i) => i !== originIdx);
  const texto = "Mensagem de teste do aquecedor.";
  let ok = 0;
  let fail = 0;
  const delayMs = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (const destino of destinos) {
    const sendUrl = buildTemplateUrl(EVO_SEND_TEXT_URL_TEMPLATE, origem.instancia);
    const numero = normalizeWhatsAppNumber(destino.numero);
    const sendBody: Record<string, any> = EVO_SEND_TEXT_V1
      ? { number: numero, textMessage: { text: texto } }
      : { number: numero, text: texto, textMessage: { text: texto } };
    const sendResult = await callEvoAction(sendUrl, "POST", sendBody);
    if (sendResult.ok) {
      ok += 1;
      await (supabase.from("logs_envios" as any) as any).insert({
        instancia_origem: origem.instancia,
        instancia_destino: destino.instancia,
        data_envio: new Date().toISOString(),
      });
      aquecedorRuntime.lastEvoError = null;
    } else {
      fail += 1;
      aquecedorRuntime.lastEvoError = {
        status: sendResult.status,
        body: String(sendResult.body || "").slice(0, 500),
        instance: origem.instancia,
        numeroLen: numero.length,
      };
    }
    if (destinos.indexOf(destino) < destinos.length - 1) {
      await delayMs(3000);
    }
  }

  const proximo = cicloGlobal + 1;
  await (supabase.from("controle_ciclo" as any) as any).upsert(
    { id: 1, ciclo_global: proximo },
    { onConflict: "id" }
  );
  aquecedorRuntime.lastResult =
    ok > 0
      ? `Ciclo teste concluído com sucesso: ${origem.instancia} enviou para ${destinos.length} destino(s). ${ok} ok, ${fail} falha(s).`
      : `Ciclo teste falhou: ${origem.instancia} → ${destinos.length} destino(s). ${fail} falha(s).`;
}

async function runAquecedorCycle(forceTest = false) {
  if (aquecedorRuntime.isProcessing) return;
  aquecedorRuntime.isProcessing = true;
  aquecedorRuntime.lastRunAt = new Date().toISOString();

  try {
    const now = new Date();
    if (aquecedorRuntime.nextAllowedAt) {
      const nextAllowed = new Date(aquecedorRuntime.nextAllowedAt);
      if (nextAllowed.getTime() > now.getTime()) {
        aquecedorRuntime.lastResult = "Aguardando intervalo aleatório.";
        return;
      }
    }

    const config = await loadAquecedorConfigFromDb();
    const nowSp = nowInSaoPaulo();
    if (!forceTest && !isAquecedorWindowOpen(config, nowSp)) {
      aquecedorRuntime.lastResult = "Fora da janela humanizada.";
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    let response: Response;
    try {
      response = await fetch(EVO_INSTANCES_URL, {
        headers: {
          apikey: EVO_API_KEY,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!response.ok) {
      aquecedorRuntime.lastResult = "Falha ao buscar instâncias da EVO.";
      return;
    }
    const rawInstances = await response.json();
    const instances = Array.isArray(rawInstances)
      ? rawInstances
      : Array.isArray(rawInstances?.response)
        ? rawInstances.response
        : Array.isArray(rawInstances?.data)
          ? rawInstances.data
          : rawInstances ? [rawInstances] : [];
    const connectedAll = buildConnectedFromEvoResponse(instances);
    const usageMap = await loadInstanceUsageMap();
    const connected = connectedAll.filter((item) => {
      const usage = usageMap.get(item.instancia);
      // padrão: ativo para não quebrar comportamento legado
      return usage ? usage.useAquecedor !== false : true;
    });

    if (connected.length < 2) {
      aquecedorRuntime.lastResult =
        "Menos de 2 instâncias conectadas e habilitadas para Aquecedor.";
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      aquecedorRuntime.lastResult = "Supabase não configurado.";
      return;
    }

    const cutoffStuck = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await ((supabase.from("aquecedor" as any) as any)
      .update({ status: "PENDENTE" })
      .eq("status", "PROCESSANDO")
      .lt("processing_at", cutoffStuck));

    for (const item of connected) {
      await (supabase.from("controle_instancia" as any) as any).upsert(
        {
          instancia: item.instancia,
          numero_whatsapp: item.numero,
        },
        { onConflict: "instancia" }
      );
    }

    const combinations: Array<{
      instancia_origem: string;
      instancia_destino: string;
      numero_whatsapp: string;
    }> = [];

    for (const origem of connected) {
      for (const destino of connected) {
        if (origem.instancia === destino.instancia) continue;
        combinations.push({
          instancia_origem: origem.instancia,
          instancia_destino: destino.instancia,
          numero_whatsapp: destino.numero,
        });
      }
    }

    if (!combinations.length) {
      aquecedorRuntime.lastResult = "Sem combinações válidas.";
      return;
    }

    const { data: cicloData } = await (supabase
      .from("controle_ciclo" as any)
      .select("id, ciclo_global")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle()) as any;
    const cicloGlobal =
      typeof cicloData?.ciclo_global === "number" ? Math.floor(cicloData.ciclo_global) : 0;
    if (forceTest) {
      await runAquecedorCycleTestBatch(connected, cicloGlobal, supabase, config);
      return;
    }

    const chosen = combinations[cicloGlobal % combinations.length];
    const proximo = cicloGlobal + 1;

    const { data: pendingData } = await (supabase
      .from("aquecedor" as any)
      .select("id, mensagem, status, scheduled_at")
      .eq("status", "PENDENTE")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle()) as any;

    if (!pendingData?.id) {
      aquecedorRuntime.lastResult = "Sem mensagem pendente para envio.";
      return;
    }

    await (supabase.from("aquecedor" as any) as any)
      .update({
        status: "PROCESSANDO",
        processing_at: new Date().toISOString(),
        instancia: chosen.instancia_origem,
        numero_destino: chosen.numero_whatsapp,
      })
      .eq("id", pendingData.id);

    const sendUrl = buildTemplateUrl(EVO_SEND_TEXT_URL_TEMPLATE, chosen.instancia_origem);
    const texto = String(pendingData.mensagem || "").trim() || " ";
    const numero = normalizeWhatsAppNumber(chosen.numero_whatsapp);
    const sendBody: Record<string, any> = EVO_SEND_TEXT_V1
      ? { number: numero, textMessage: { text: texto } }
      : { number: numero, text: texto, textMessage: { text: texto } };
    const sendResult = await callEvoAction(sendUrl, "POST", sendBody);

    if (!sendResult.ok) {
      await (supabase.from("aquecedor" as any) as any)
        .update({ status: "PENDENTE" })
        .eq("id", pendingData.id);
      const evoDetail =
        sendResult.json?.message ||
        (Array.isArray(sendResult.json?.message) ? sendResult.json.message[0] : null) ||
        sendResult.json?.error ||
        (typeof sendResult.json?.detail === "string" ? sendResult.json.detail : null) ||
        (sendResult.body && sendResult.body.length < 200 ? sendResult.body : null);
      const detail = evoDetail ? ` (${String(evoDetail).slice(0, 120)})` : "";
      aquecedorRuntime.lastResult = `Falha no envio via EVO (HTTP ${sendResult.status})${detail}. Mensagem voltou para pendente.`;
      aquecedorRuntime.lastEvoError = {
        status: sendResult.status,
        body: String(sendResult.body || "").slice(0, 500),
        instance: chosen.instancia_origem,
        numeroLen: numero.length,
      };
      console.error("[Aquecedor] sendText falhou:", aquecedorRuntime.lastEvoError);
      return;
    }
    aquecedorRuntime.lastEvoError = null;

    await (supabase.from("aquecedor" as any) as any)
      .update({
        status: "ENVIADO",
        sent_at: new Date().toISOString(),
      })
      .eq("id", pendingData.id);

    await (supabase.from("logs_envios" as any) as any).insert({
      instancia_origem: chosen.instancia_origem,
      instancia_destino: chosen.instancia_destino,
      data_envio: new Date().toISOString(),
    });

    await (supabase.from("controle_ciclo" as any) as any).upsert(
      { id: 1, ciclo_global: proximo },
      { onConflict: "id" }
    );

    const waitMin = config.waitMinSeconds;
    const waitMax = config.waitMaxSeconds;
    const waitSeconds =
      Math.floor(Math.random() * (waitMax - waitMin + 1)) + waitMin;
    aquecedorRuntime.nextAllowedAt = new Date(Date.now() + waitSeconds * 1000).toISOString();
    aquecedorRuntime.lastResult = `Envio realizado com sucesso. Próxima janela em ~${waitSeconds}s.`;
  } catch (error) {
    console.error("Erro no ciclo do aquecedor:", error);
    aquecedorRuntime.lastResult = "Erro inesperado no ciclo do aquecedor.";
  } finally {
    aquecedorRuntime.isProcessing = false;
  }
}

function startAquecedorRuntime() {
  if (aquecedorInterval) return;
  aquecedorRuntime.running = true;
  aquecedorInterval = setInterval(() => {
    if (!aquecedorRuntime.running) return;
    runAquecedorCycle();
  }, 60000);
  runAquecedorCycle();
}

function stopAquecedorRuntime() {
  aquecedorRuntime.running = false;
  if (aquecedorInterval) {
    clearInterval(aquecedorInterval);
    aquecedorInterval = null;
  }
}

// __dirname (em dev) é "src", então subimos um nível e usamos "dist"
const rootPath = path.join(__dirname, "..");
const distPath = path.join(rootPath, "dist");

app.use(express.static(distPath));

app.get("/", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// Dados direto do banco (view logs_envios_br já com fuso tratado)
app.get("/dados", async (req, res) => {
  try {
    const rangeStart =
      typeof req.query.rangeStart === "string" ? req.query.rangeStart : null;
    const rangeEnd =
      typeof req.query.rangeEnd === "string" ? req.query.rangeEnd : null;

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(503).json({
        error: "Supabase não configurado no servidor (verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY).",
      });
    }

    const isValidYMD = (ymd: string) => /^\d{4}-\d{2}-\d{2}$/.test(ymd);

    const dateToNextDayYMD = (ymd: string) => {
      // ymd: YYYY-MM-DD
      if (!isValidYMD(ymd)) {
        throw new Error("Formato de data inválido");
      }
      const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
      const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
      dt.setUTCDate(dt.getUTCDate() + 1);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
    };

    let query = supabase
      .from("logs_envios_br")
      .select(
        "id, ciclo_global, instancia_origem, instancia_destino, created_at, data_envio_br"
      )
      .order("data_envio_br", { ascending: false });

    let totalCount: number | null = null;
    let countsBySender: Record<string, number> | null = null;

    if (rangeStart && rangeEnd) {
      if (!isValidYMD(rangeStart) || !isValidYMD(rangeEnd)) {
        return res.status(400).json({ error: "rangeStart/rangeEnd devem ser YYYY-MM-DD" });
      }
      // data_envio_br já vem da view com fuso tratado (America/Sao_Paulo).
      // Como a query retorna em formato timestamp sem timezone (no geral),
      // comparamos por "timestamp sem fuso" usando literais "YYYY-MM-DD HH:MM:SS".
      const startTs = `${rangeStart} 00:00:00`;
      const endExclusive = dateToNextDayYMD(rangeEnd);
      const endTs = `${endExclusive} 00:00:00`;

      // Count exato para bater com o SQL da view (sem precisar trazer todas as linhas)
      const { count, error: countError } = await supabase
        .from("logs_envios_br")
        .select("id", { count: "exact", head: true })
        .gte("data_envio_br", startTs)
        .lt("data_envio_br", endTs);

      if (!countError && typeof count === "number") {
        totalCount = count;
      } else {
        console.error("Erro count exato:", countError);
      }

      // Distribuição por instância de origem (para gráfico de barras)
      // O PostgREST pode limitar ~1000 linhas por request e agregações podem ser desabilitadas.
      // Então paginamos e contamos no backend para bater exatamente com a contagem exata.
      if (typeof totalCount === "number" && totalCount > 0) {
        countsBySender = {};

        const pageSize = 1000;
        let offset = 0;
        let safety = 0;

        while (offset < totalCount && safety < 50) {
          safety += 1;

          const { data: senderRows, error: senderErr } = await supabase
            .from("logs_envios_br")
            .select("instancia_origem")
            .gte("data_envio_br", startTs)
            .lt("data_envio_br", endTs)
            .order("data_envio_br", { ascending: false })
            .range(offset, offset + pageSize - 1);

          if (senderErr) {
            console.error("Erro countsBySender pagination:", senderErr);
            break;
          }

          if (!senderRows || senderRows.length === 0) break;

          senderRows.forEach((r: any) => {
            const key = r?.instancia_origem || "—";
            countsBySender![key] = (countsBySender![key] || 0) + 1;
          });

          offset += senderRows.length;
          if (senderRows.length < pageSize) break;
        }
      }

      // Linhas limitadas para montar lista/gráficos (o PostgREST pode limitar ~1000)
      query = query.gte("data_envio_br", startTs).lt("data_envio_br", endTs).limit(5000);
    } else {
      query = query.limit(2000);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Erro Supabase:", error);
      return res
        .status(500)
        .json({ error: "Erro ao buscar dados no Supabase" });
    }

    const rows = data ?? [];

    const texto = rows
      .map((row: any) => {
        const dataHora = row.data_envio_br || row.created_at || "";
        const quemEnviou = row.instancia_origem || "";
        const quemRecebeu = row.instancia_destino || "";

        return `Data/Hora: ${dataHora}\nQuem enviou: ${quemEnviou}\nQuem recebeu: ${quemRecebeu}`;
      })
      .join("\n-----------------------------\n");

    return res.json({ log: texto, count: rows.length, totalCount, countsBySender });
  } catch (error) {
    console.error("Erro ao buscar dados no Supabase:", error);
    return res.status(500).json({ error: "Erro ao buscar dados no Supabase" });
  }
});

// Status das instancias (Evolution API)
app.get("/instancias", async (req, res) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    let response: Response;
    try {
      response = await fetch(EVO_INSTANCES_URL, {
        headers: {
          apikey: EVO_API_KEY,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const bodyText = await response.text();
      console.error("Erro Evolution API:", response.status, bodyText);
      return res
        .status(500)
        .json({ error: "Erro ao buscar dados na Evolution API" });
    }

    const instances: any[] = await response.json();

    let ativas = 0;
    let desconectadas = 0;

    for (const inst of instances) {
      if (inst.connectionStatus === "open") {
        ativas += 1;
      } else {
        desconectadas += 1;
      }
    }

    const total = instances.length;

    const pickNumeric = (...values: any[]): number => {
      for (const value of values) {
        if (typeof value === "number" && Number.isFinite(value)) return value;
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = Number(value);
          if (Number.isFinite(parsed)) return parsed;
        }
      }
      return 0;
    };

    // Retorna apenas campos úteis para a UI (evita expor payload sensível)
    const items = instances.slice(0, 100).map((inst: any, idx: number) => {
      const candidateName =
        inst.instanceName ??
        inst.name ??
        inst.id ??
        inst.instanceId ??
        inst.instance ??
        null;

      const displayName =
        candidateName == null || candidateName === ""
          ? `Instância ${idx + 1}`
          : String(candidateName);

      const connectionStatus =
        typeof inst.connectionStatus === "string"
          ? inst.connectionStatus
          : "unknown";

      const contacts = pickNumeric(
        inst.contacts,
        inst.contactsCount,
        inst.totalContacts,
        inst._count?.Contact,
        inst._count?.contacts,
        inst.profile?.contacts,
        inst.stats?.contacts
      );

      const messages = pickNumeric(
        inst.messages,
        inst.messagesCount,
        inst.totalMessages,
        inst.chatsCount,
        inst._count?.Message,
        inst._count?.messages,
        inst.profile?.messages,
        inst.stats?.messages
      );

      const number =
        inst.number ??
        inst.phone ??
        inst.owner ??
        inst.ownerNumber ??
        "";

      const profilePicUrl =
        typeof inst.profilePicUrl === "string" ? inst.profilePicUrl : "";

      const avatarVersion =
        typeof inst.updatedAt === "string" ? inst.updatedAt : "";

      const createdAt =
        typeof inst.createdAt === "string"
          ? inst.createdAt
          : typeof inst.created_at === "string"
            ? inst.created_at
            : "";

      return {
        name: displayName,
        displayName: String(inst.profileName || displayName),
        connectionStatus,
        number: String(number || ""),
        contacts,
        messages,
        profilePicUrl,
        avatarVersion,
        createdAt,
      };
    });

    return res.json({ total, ativas, desconectadas, items });
  } catch (error) {
    console.error("Erro ao consultar Evolution API:", error);
    return res
      .status(500)
      .json({ error: "Erro ao consultar Evolution API" });
  }
});

app.get("/instancias/uso-config", async (_req, res) => {
  try {
    const usageMap = await loadInstanceUsageMap();
    const items = Array.from(usageMap.entries()).map(([instanceName, cfg]) => ({
      instanceName,
      ...cfg,
    }));
    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao buscar configuração de uso das instâncias." });
  }
});

app.post("/instancias/uso-config", async (req, res) => {
  try {
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const items = rawItems
      .map((row: any) => ({
        instanceName: String(row?.instanceName || "").trim(),
        useAquecedor: row?.useAquecedor !== false,
        useDisparador: row?.useDisparador !== false,
      }))
      .filter((row: any) => row.instanceName);
    if (!items.length) {
      return res.status(400).json({ error: "Nenhuma instância válida foi informada." });
    }
    await persistInstanceUsage(items);
    return res.json({ ok: true, message: "Configuração de uso das instâncias salva.", items });
  } catch {
    return res.status(500).json({ error: "Erro ao salvar configuração de uso das instâncias." });
  }
});

function buildTemplateUrl(template: string, instanceName: string) {
  if (!template) return "";
  return template
    .replace("{instance}", encodeURIComponent(instanceName))
    .replace("{name}", encodeURIComponent(instanceName));
}

function normalizeWhatsAppNumber(num: string): string {
  const raw = String(num || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  if (digits.length >= 12 && digits.startsWith("55")) return digits;
  if (digits.length >= 10 && digits.length <= 11 && /^[1-9]\d/.test(digits)) {
    return "55" + digits;
  }
  return digits;
}

function extractInstanceNumber(inst: any): string {
  const raw =
    inst?.owner ??
    inst?.number ??
    inst?.phone ??
    inst?.ownerNumber ??
    inst?.profile?.owner ??
    "";
  const s = String(raw).trim();
  if (!s) return "";
  if (s.includes("@")) return s.split("@")[0] || s;
  return s;
}

function buildConnectedFromEvoResponse(instances: any[]): Array<{ instancia: string; numero: string }> {
  const list = Array.isArray(instances) ? instances : [instances];
  return list
    .map((item) => {
      const inst = item?.instance ?? item;
      const status = String(inst?.connectionStatus ?? inst?.status ?? "").toLowerCase();
      if (!status.includes("open")) return null;
      const instancia = String(inst?.name ?? inst?.instanceName ?? inst?.instance ?? "").trim();
      const numero = extractInstanceNumber(inst);
      if (!instancia || !numero) return null;
      return { instancia, numero };
    })
    .filter((x): x is { instancia: string; numero: string } => x != null);
}

async function callEvoAction(
  url: string,
  method: "GET" | "POST" | "DELETE",
  body?: Record<string, any>
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      method,
      headers: {
        apikey: EVO_API_KEY,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return {
      ok: response.ok,
      status: response.status,
      body: text,
      json,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function shortenUrlWithProvider(
  longUrl: string,
  provider: DisparosConfig["shortenerProvider"],
  customDomain = ""
) {
  const safeLongUrl = String(longUrl || "").trim();
  if (!safeLongUrl) {
    throw new Error("URL original é obrigatória.");
  }
  if (provider === "isgd") {
    const endpoint = `https://is.gd/create.php?format=simple&url=${encodeURIComponent(safeLongUrl)}`;
    const response = await fetch(endpoint, { method: "GET" });
    const body = await response.text();
    if (!response.ok || !/^https?:\/\//i.test(body.trim())) {
      throw new Error("Falha no encurtador is.gd.");
    }
    return body.trim();
  }
  if (provider === "tinyurl") {
    const token = process.env.TINYURL_API_TOKEN || "";
    if (!token) throw new Error("TINYURL_API_TOKEN não configurado.");
    const response = await fetch("https://api.tinyurl.com/create", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: safeLongUrl,
        domain: customDomain || undefined,
      }),
    });
    const data = await response.json().catch(() => ({}));
    const short = data?.data?.tiny_url || data?.data?.url || "";
    if (!response.ok || !short) throw new Error("Falha no encurtador TinyURL.");
    return String(short);
  }
  throw new Error("Provedor de encurtador não suportado.");
}

function appendAntiRepeatParam(rawUrl: string, attempt: number) {
  try {
    const u = new URL(rawUrl);
    u.searchParams.set("_n8n_link_nonce", `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}-${attempt}`);
    return u.toString();
  } catch {
    // fallback em caso de URL não parseável pelo construtor URL
    const sep = rawUrl.includes("?") ? "&" : "?";
    return `${rawUrl}${sep}_n8n_link_nonce=${Date.now()}-${attempt}`;
  }
}

function tryExtractQrCode(payload: any): string | null {
  const normalizeCandidate = (value: any): string | null => {
    if (typeof value !== "string") return null;
    const raw = value.trim();
    if (!raw) return null;
    if (raw.startsWith("data:image")) return raw;
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    if (/^[A-Za-z0-9+/=\r\n]+$/.test(raw) && raw.length >= 100) return raw;
    return null;
  };

  const visit = (node: any, depth = 0): string | null => {
    if (depth > 6 || node == null) return null;

    const normalizedDirect = normalizeCandidate(node);
    if (normalizedDirect) return normalizedDirect;

    if (Array.isArray(node)) {
      for (const item of node) {
        const found = visit(item, depth + 1);
        if (found) return found;
      }
      return null;
    }

    if (typeof node !== "object") return null;

    const priorityKeys = [
      "qrcode",
      "qrCode",
      "qr",
      "base64",
      "code",
      "pairingCode",
      "pairingcode",
      "data",
    ];

    for (const key of priorityKeys) {
      if (Object.prototype.hasOwnProperty.call(node, key)) {
        const found = visit((node as Record<string, any>)[key], depth + 1);
        if (found) return found;
      }
    }

    for (const [key, value] of Object.entries(node)) {
      if (!/(qr|qrcode|base64|code|pairing)/i.test(key)) continue;
      const found = visit(value, depth + 1);
      if (found) return found;
    }

    return null;
  };

  return visit(payload);
}

app.post("/instancias/:name/atualizar", async (req, res) => {
  try {
    const instanceName = String(req.params.name || "").trim();
    if (!instanceName) {
      return res.status(400).json({ error: "Nome da instância é obrigatório." });
    }

    const url = buildTemplateUrl(EVO_REFRESH_URL_TEMPLATE, instanceName);
    if (!url) {
      return res.status(501).json({
        error:
          "Ação atualizar não configurada. Defina EVO_REFRESH_URL_TEMPLATE no backend.",
      });
    }

    const result = await callEvoAction(url, "POST");
    if (!result.ok) {
      return res.status(502).json({
        error: "Falha ao executar atualização da instância na EVO.",
        status: result.status,
      });
    }
    return res.json({ ok: true, message: "Atualização solicitada com sucesso." });
  } catch (error) {
    console.error("Erro ao atualizar instância:", error);
    return res.status(500).json({ error: "Erro ao atualizar instância." });
  }
});

app.post("/instancias/:name/qrcode", async (req, res) => {
  try {
    const instanceName = String(req.params.name || "").trim();
    if (!instanceName) {
      return res.status(400).json({ error: "Nome da instância é obrigatório." });
    }

    const url = buildTemplateUrl(EVO_QRCODE_URL_TEMPLATE, instanceName);
    if (!url) {
      return res.status(501).json({
        error:
          "Ação QRCode não configurada. Defina EVO_QRCODE_URL_TEMPLATE no backend.",
      });
    }

    const number = typeof req.query.number === "string" ? req.query.number.trim() : "";
    const urlWithQuery = number
      ? `${url}${url.includes("?") ? "&" : "?"}number=${encodeURIComponent(number)}`
      : url;

    const result = await callEvoAction(urlWithQuery, "GET");
    if (!result.ok) {
      return res.status(502).json({
        error: "Falha ao solicitar QRCode na EVO.",
        status: result.status,
      });
    }
    const qrCode = tryExtractQrCode(result.json) || tryExtractQrCode(result.body);
    return res.json({
      ok: true,
      message: "QRCode solicitado com sucesso.",
      qrCode,
      providerResponse: result.json ?? null,
    });
  } catch (error) {
    console.error("Erro ao solicitar QRCode:", error);
    return res.status(500).json({ error: "Erro ao solicitar QRCode." });
  }
});

app.post("/instancias/registrar-qrcode", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const channel = String(req.body?.channel || "baileys").trim();
    const rawToken = String(req.body?.token || "").trim();
    const number = String(req.body?.number || "").trim();
    const token =
      rawToken ||
      crypto
        .randomUUID()
        .replace(/-/g, "")
        .toUpperCase()
        .replace(/(.{12})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");

    if (!name) {
      return res.status(400).json({ error: "Campo 'name' é obrigatório." });
    }

    // Regra de segurança operacional:
    // não permitir criar instância com nome já usado por outra instância ativa/conectada.
    // Instâncias desconectadas são desconsideradas nesse comparativo.
    try {
      const checkController = new AbortController();
      const checkTimeout = setTimeout(() => checkController.abort(), 8000);
      const checkResponse = await fetch(EVO_INSTANCES_URL, {
        headers: {
          apikey: EVO_API_KEY,
          "Content-Type": "application/json",
        },
        signal: checkController.signal,
      }).finally(() => clearTimeout(checkTimeout));

      if (checkResponse.ok) {
        const rawInstances: any = await checkResponse.json().catch(() => []);
        const list = Array.isArray(rawInstances)
          ? rawInstances
          : Array.isArray(rawInstances?.response)
            ? rawInstances.response
            : Array.isArray(rawInstances?.data)
              ? rawInstances.data
              : [];

        const alreadyActive = list.some((item: any) => {
          const inst = item?.instance ?? item;
          const existingName = String(
            inst?.name ?? inst?.instanceName ?? inst?.instance ?? ""
          ).trim();
          const status = String(inst?.connectionStatus ?? inst?.status ?? "")
            .toLowerCase()
            .trim();
          return existingName.toLowerCase() === name.toLowerCase() && status.includes("open");
        });

        if (alreadyActive) {
          return res.status(409).json({
            error:
              "Já existe uma instância ativa/conectada com este nome. Use outro nome para registrar.",
          });
        }
      }
    } catch {
      // Se a verificação falhar por indisponibilidade externa, não bloqueamos o fluxo.
    }

    // token é gerado pelo backend quando não informado.
    const createPayload = {
      name,
      instanceName: name,
      channel,
      token,
      number,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    };

    // Fallbacks para versões diferentes da Evolution API
    const createUrls = [
      EVO_CREATE_INSTANCE_URL,
      `${EVO_API_BASE}/instance/create`,
      `${EVO_API_BASE}/instance/create/${encodeURIComponent(name)}`,
    ].filter(Boolean);

    let createOk = false;
    let lastCreateStatus = 0;
    for (const createUrl of createUrls) {
      const createResult = await callEvoAction(createUrl, "POST", createPayload);
      lastCreateStatus = createResult.status;
      if (createResult.ok || createResult.status === 409) {
        // 409 pode ocorrer quando instância já existe; seguimos para QRCode
        createOk = true;
        break;
      }
    }

    let createWarning: string | null = null;
    if (!createOk) {
      createWarning = `Não foi possível salvar/atualizar a instância (status ${lastCreateStatus}). Tentando gerar QRCode da instância existente.`;
    }

    const connectCandidates = [
      buildTemplateUrl(EVO_QRCODE_URL_TEMPLATE, name),
      `${EVO_API_BASE}/instance/connect/${encodeURIComponent(name)}`,
      `${EVO_API_BASE}/instance/qrcode/${encodeURIComponent(name)}`,
      `${EVO_API_BASE}/instance/qr/${encodeURIComponent(name)}`,
    ].filter(Boolean) as string[];

    const qrcodeUrls = connectCandidates.map((candidate) =>
      number
        ? `${candidate}${candidate.includes("?") ? "&" : "?"}number=${encodeURIComponent(
            number
          )}`
        : candidate
    );

    let qrResult: Awaited<ReturnType<typeof callEvoAction>> | null = null;
    for (const qrcodeUrl of qrcodeUrls) {
      const result = await callEvoAction(qrcodeUrl, "GET");
      if (result.ok) {
        qrResult = result;
        break;
      }
    }

    if (!qrResult || !qrResult.ok) {
      return res.status(502).json({
        error: "Dados salvos, mas falha ao gerar QRCode na EVO.",
      });
    }

    const qrCode = tryExtractQrCode(qrResult.json);
    return res.json({
      ok: true,
      message: createWarning
        ? "QRCode gerado com sucesso para a instância existente."
        : "Dados salvos e QRCode gerado com sucesso.",
      warning: createWarning,
      qrCode,
      providerResponse: qrResult.json ?? null,
    });
  } catch (error) {
    console.error("Erro ao registrar instância e gerar QRCode:", error);
    return res.status(500).json({ error: "Erro ao gerar QRCode da instância." });
  }
});

app.delete("/instancias/:name", async (req, res) => {
  try {
    const instanceName = String(req.params.name || "").trim();
    if (!instanceName) {
      return res.status(400).json({ error: "Nome da instância é obrigatório." });
    }

    const url = buildTemplateUrl(EVO_DELETE_URL_TEMPLATE, instanceName);
    if (!url) {
      return res.status(501).json({
        error:
          "Ação deletar não configurada. Defina EVO_DELETE_URL_TEMPLATE no backend.",
      });
    }

    const result = await callEvoAction(url, "DELETE");
    if (!result.ok) {
      return res.status(502).json({
        error: "Falha ao deletar instância na EVO.",
        status: result.status,
      });
    }
    return res.json({ ok: true, message: "Instância deletada com sucesso." });
  } catch (error) {
    console.error("Erro ao deletar instância:", error);
    return res.status(500).json({ error: "Erro ao deletar instância." });
  }
});

app.get("/aquecedor/config", async (_req, res) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(503).json({
        error:
          "Supabase não configurado no servidor (verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY).",
      });
    }

    const { data, error } = await (supabase
      .from("aquecedor_config" as any)
      .select("use_recommended, custom_config, updated_at")
      .eq("id", 1)
      .maybeSingle()) as any;

    if (error) {
      console.error("Erro ao buscar configuração do aquecedor:", error);
      return res.status(500).json({ error: "Erro ao buscar configuração do aquecedor." });
    }

    const useRecommended = data?.use_recommended !== false;
    const customConfigRaw =
      data?.custom_config && typeof data.custom_config === "object"
        ? data.custom_config
        : AQUECEDOR_DEFAULTS;

    let customConfig: AquecedorConfig;
    try {
      customConfig = parseAquecedorConfig(customConfigRaw);
    } catch {
      customConfig = AQUECEDOR_DEFAULTS;
    }

    const effectiveConfig = useRecommended ? AQUECEDOR_DEFAULTS : customConfig;
    return res.json({
      useRecommended,
      recommendedConfig: AQUECEDOR_DEFAULTS,
      customConfig,
      effectiveConfig,
      updatedAt: data?.updated_at ?? null,
    });
  } catch (error) {
    console.error("Erro inesperado ao buscar configuração do aquecedor:", error);
    return res.status(500).json({ error: "Erro ao buscar configuração do aquecedor." });
  }
});

app.post("/aquecedor/config", async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(503).json({
        error:
          "Supabase não configurado no servidor (verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY).",
      });
    }

    const useRecommended = req.body?.useRecommended !== false;
    const customConfig = parseAquecedorConfig(req.body?.customConfig || AQUECEDOR_DEFAULTS);

    const payload = {
      id: 1,
      use_recommended: useRecommended,
      custom_config: customConfig,
      updated_at: new Date().toISOString(),
    };

    const { error } = await (supabase.from("aquecedor_config" as any) as any).upsert(
      payload as any,
      {
        onConflict: "id",
      }
    );

    if (error) {
      console.error("Erro ao salvar configuração do aquecedor:", error);
      return res.status(500).json({ error: "Erro ao salvar configuração do aquecedor." });
    }

    const effectiveConfig = useRecommended ? AQUECEDOR_DEFAULTS : customConfig;
    return res.json({
      ok: true,
      message: "Configuração do aquecedor salva com sucesso.",
      useRecommended,
      recommendedConfig: AQUECEDOR_DEFAULTS,
      customConfig,
      effectiveConfig,
    });
  } catch (error: any) {
    const message = error?.message || "Erro ao validar configuração do aquecedor.";
    return res.status(400).json({ error: message });
  }
});

app.get("/aquecedor/status", (_req, res) => {
  return res.json({
    ...aquecedorRuntime,
  });
});

app.get("/aquecedor/envios", async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(503).json({
        error:
          "Supabase não configurado no servidor (verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY).",
      });
    }

    const cutoffStuck = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await ((supabase.from("aquecedor" as any) as any)
      .update({ status: "PENDENTE" })
      .eq("status", "PROCESSANDO")
      .lt("processing_at", cutoffStuck));

    const rawLimit = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(200, Math.floor(rawLimit)))
      : 50;

    const items: Array<{
      instanciaOrigem: string;
      instanciaDestino: string;
      dataEnvio: string | null;
      dataEnvioBr: string;
      status: "Em Fila" | "Envio com Sucesso";
    }> = [];

    const { data: processandoData } = await (supabase
      .from("aquecedor" as any)
      .select("instancia, numero_destino, scheduled_at, processing_at")
      .eq("status", "PROCESSANDO")
      .order("processing_at", { ascending: false })
      .limit(5)) as any;

    if (Array.isArray(processandoData) && processandoData.length > 0) {
      const { data: instanciasData } = await (supabase
        .from("controle_instancia" as any)
        .select("instancia, numero_whatsapp")) as any;
      const numToInst = new Map<string, string>();
      for (const r of instanciasData || []) {
        const num = String(r?.numero_whatsapp || "").trim();
        if (num) numToInst.set(num, String(r?.instancia || "").trim());
      }
      for (const row of processandoData) {
        const origem = String(row?.instancia || "").trim() || "—";
        const numDest = String(row?.numero_destino || "").trim();
        const destino = numToInst.get(numDest) || numDest || "—";
        const dataEnvio = String(row?.scheduled_at || row?.processing_at || "").trim() || null;
        items.push({
          instanciaOrigem: origem,
          instanciaDestino: destino,
          dataEnvio,
          dataEnvioBr: formatDateBr(dataEnvio),
          status: "Em Fila",
        });
      }
    }

    const { data: pendingData, error: pendingErr } = await (supabase
      .from("aquecedor" as any)
      .select("scheduled_at")
      .eq("status", "PENDENTE")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle()) as any;

    if (pendingData) {
      let origem = "—";
      let destino = "—";
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(EVO_INSTANCES_URL, {
          headers: { apikey: EVO_API_KEY, "Content-Type": "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (response.ok) {
          const instances: any[] = (await response.json().catch(() => [])) || [];
          const connectedAll = buildConnectedFromEvoResponse(instances);
          const usageMap = await loadInstanceUsageMap();
          const connected = connectedAll.filter((item) => {
            const usage = usageMap.get(item.instancia);
            return usage ? usage.useAquecedor !== false : true;
          });
          if (connected.length >= 2) {
            const combinations: Array<{ origem: string; destino: string }> = [];
            for (const o of connected) {
              for (const d of connected) {
                if (o.instancia === d.instancia) continue;
                combinations.push({ origem: o.instancia, destino: d.instancia });
              }
            }
            const { data: cicloData } = await (supabase
              .from("controle_ciclo" as any)
              .select("ciclo_global")
              .order("id", { ascending: true })
              .limit(1)
              .maybeSingle()) as any;
            const cicloGlobal =
              typeof cicloData?.ciclo_global === "number"
                ? Math.floor(cicloData.ciclo_global)
                : 0;
            const chosen = combinations[cicloGlobal % combinations.length];
            if (chosen) {
              origem = chosen.origem;
              destino = chosen.destino;
            }
          }
        }
      } catch (_) {
        // usar — quando não for possível obter origem/destino
      }
      const dataEnvio = String(pendingData?.scheduled_at || "").trim() || null;
      items.unshift({
        instanciaOrigem: origem,
        instanciaDestino: destino,
        dataEnvio,
        dataEnvioBr: formatDateBr(dataEnvio),
        status: "Em Fila",
      });
    }

    const { data: logsData, error } = await (supabase
      .from("logs_envios" as any)
      .select("instancia_origem, instancia_destino, data_envio")
      .order("data_envio", { ascending: false })
      .limit(limit)) as any;

    if (!error && Array.isArray(logsData)) {
      for (const row of logsData) {
        const dataEnvio = String(row?.data_envio || "").trim() || null;
        items.push({
          instanciaOrigem: String(row?.instancia_origem || "").trim() || "—",
          instanciaDestino: String(row?.instancia_destino || "").trim() || "—",
          dataEnvio,
          dataEnvioBr: formatDateBr(dataEnvio),
          status: "Envio com Sucesso",
        });
      }
    }

    items.sort((a, b) => {
      const tsA = a.dataEnvio ? new Date(a.dataEnvio).getTime() : 0;
      const tsB = b.dataEnvio ? new Date(b.dataEnvio).getTime() : 0;
      return tsB - tsA;
    });

    return res.json({ items });
  } catch (error) {
    console.error("Erro inesperado ao listar envios do aquecedor:", error);
    return res.status(500).json({ error: "Erro ao listar envios do aquecedor." });
  }
});

app.post("/aquecedor/start", (_req, res) => {
  startAquecedorRuntime();
  return res.json({ ok: true, message: "Aquecedor iniciado.", status: aquecedorRuntime });
});

app.post("/aquecedor/stop", (_req, res) => {
  stopAquecedorRuntime();
  return res.json({ ok: true, message: "Aquecedor parado.", status: aquecedorRuntime });
});

app.post("/aquecedor/run-once", async (_req, res) => {
  await runAquecedorCycle(true); // bypass janela e cooldown para teste
  stopAquecedorRuntime(); // execução única: para o motor ao finalizar
  return res.json({ ok: true, message: "Ciclo executado.", status: aquecedorRuntime });
});

app.post("/aquecedor/criar-mensagem-teste", async (_req, res) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(503).json({
        error: "Supabase não configurado no servidor.",
      });
    }
    const mensagem = String(_req.body?.mensagem ?? "").trim() || "Mensagem de teste do aquecedor.";
    const scheduledAt = new Date().toISOString();
    const { data, error } = await (supabase.from("aquecedor" as any) as any)
      .insert({
        mensagem,
        status: "PENDENTE",
        scheduled_at: scheduledAt,
      })
      .select("id, scheduled_at")
      .single();
    if (error) {
      console.error("Erro ao criar mensagem de teste:", error);
      return res.status(500).json({ error: "Erro ao criar mensagem de teste." });
    }
    const dataEnvio = data?.scheduled_at || scheduledAt;
    const item = {
      instanciaOrigem: "—",
      instanciaDestino: "—",
      dataEnvio,
      dataEnvioBr: formatDateBr(dataEnvio),
      status: "Em Fila" as const,
    };
    await runAquecedorCycle(true); // executa um ciclo para processar a mensagem criada
    stopAquecedorRuntime(); // execução única: para o motor ao finalizar
    return res.json({
      ok: true,
      message: "Mensagem de teste criada e ciclo executado.",
      id: data?.id,
      item,
      status: aquecedorRuntime,
    });
  } catch (error) {
    console.error("Erro ao criar mensagem de teste:", error);
    return res.status(500).json({ error: "Erro ao criar mensagem de teste." });
  }
});

app.get("/aquecedor/fila-localizar", async (_req, res) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(503).json({ error: "Supabase não configurado." });
    }
    const now = new Date().toISOString();
    const { data: pendentes } = await (supabase
      .from("aquecedor" as any)
      .select("id, status, scheduled_at, instancia, numero_destino")
      .eq("status", "PENDENTE")
      .order("scheduled_at", { ascending: true })
      .limit(10)) as any;
    const { data: processando } = await (supabase
      .from("aquecedor" as any)
      .select("id, status, scheduled_at, processing_at, instancia, numero_destino")
      .eq("status", "PROCESSANDO")
      .order("processing_at", { ascending: false })
      .limit(10)) as any;
    const processandoComMinutos = (processando || []).map((r: any) => {
      const pt = r?.processing_at ? new Date(r.processing_at).getTime() : 0;
      const minutos = pt ? Math.floor((Date.now() - pt) / 60000) : 0;
      return { ...r, minutosEmProcessando: minutos };
    });
    return res.json({
      pendenteCount: (pendentes || []).length,
      processandoCount: (processando || []).length,
      pendentes: pendentes || [],
      processando: processandoComMinutos,
      motorRodando: aquecedorRuntime.running,
      proximoPermitido: aquecedorRuntime.nextAllowedAt,
      ultimoResultado: aquecedorRuntime.lastResult,
      lastEvoError: aquecedorRuntime.lastEvoError,
    });
  } catch (error) {
    console.error("Erro ao localizar fila:", error);
    return res.status(500).json({ error: "Erro ao localizar fila." });
  }
});

app.get("/aquecedor/diagnostico", async (_req, res) => {
  const diag: Record<string, any> = {
    runtime: { ...aquecedorRuntime },
    evo: { ok: false, connectedCount: 0, instances: [] as string[] },
    supabase: { ok: false, pendingCount: 0 },
    janela: { aberta: false, motivo: "" },
    proximaCombinacao: null as { origem: string; destino: string } | null,
    cicloGlobal: null as number | null,
  };

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(EVO_INSTANCES_URL, {
      headers: { apikey: EVO_API_KEY, "Content-Type": "application/json" },
      signal: controller.signal,
    });
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = null;
    if (response.ok) {
      const instances: any[] = (await response.json().catch(() => [])) || [];
      const connectedAll = buildConnectedFromEvoResponse(instances);
      const usageMap = await loadInstanceUsageMap();
      const connected = connectedAll.filter((item) => {
        const usage = usageMap.get(item.instancia);
        return usage ? usage.useAquecedor !== false : true;
      });
      diag.evo.ok = true;
      diag.evo.connectedCount = connected.length;
      diag.evo.instances = connected.map((c) => c.instancia);
      if (connected.length >= 2) {
        const combinations: Array<{ origem: string; destino: string }> = [];
        for (const origem of connected) {
          for (const destino of connected) {
            if (origem.instancia === destino.instancia) continue;
            combinations.push({
              origem: origem.instancia,
              destino: destino.instancia,
            });
          }
        }
        const supabase = getSupabaseClient();
        if (supabase) {
          try {
            const { count } = await (supabase
              .from("aquecedor" as any)
              .select("id", { count: "exact", head: true })
              .eq("status", "PENDENTE")
              .lte("scheduled_at", new Date().toISOString())) as any;
            diag.supabase.ok = true;
            diag.supabase.pendingCount = typeof count === "number" ? count : 0;
            const { data: cicloData } = await (supabase
              .from("controle_ciclo" as any)
              .select("ciclo_global")
              .order("id", { ascending: true })
              .limit(1)
              .maybeSingle()) as any;
            const cicloGlobal =
              typeof cicloData?.ciclo_global === "number"
                ? Math.floor(cicloData.ciclo_global)
                : 0;
            diag.cicloGlobal = cicloGlobal;
            if (combinations.length) {
              const chosen = combinations[cicloGlobal % combinations.length];
              diag.proximaCombinacao = chosen;
            }
          } catch (supErr) {
            diag.supabase.mensagem = (supErr as Error)?.message || "Erro ao consultar Supabase.";
          }
        } else {
          diag.supabase.mensagem = "Supabase não configurado.";
        }
      }
      try {
        const config = await loadAquecedorConfigFromDb();
        const nowSp = nowInSaoPaulo();
        diag.janela.aberta = isAquecedorWindowOpen(config, nowSp);
        diag.janela.motivo = diag.janela.aberta
          ? "Dentro da janela humanizada."
          : "Fora da janela humanizada.";
      } catch (cfgErr) {
        diag.janela.motivo = (cfgErr as Error)?.message || "Erro ao carregar janela.";
      }
    } else {
      diag.evo.mensagem = `EVO retornou status ${response.status}.`;
    }
  } catch (e) {
    if (timeoutId) clearTimeout(timeoutId);
    diag.evo.mensagem = (e as Error)?.message || "Erro ao conectar na EVO (timeout ou rede).";
  }

  if (!diag.supabase.ok && getSupabaseClient()) {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { count } = await (supabase
          .from("aquecedor" as any)
          .select("id", { count: "exact", head: true })
          .eq("status", "PENDENTE")
          .lte("scheduled_at", new Date().toISOString())) as any;
        diag.supabase.ok = true;
        diag.supabase.pendingCount = typeof count === "number" ? count : 0;
      }
    } catch (_) {
      if (!diag.supabase.mensagem) diag.supabase.mensagem = "Erro ao consultar fila.";
    }
  }

  return res.status(200).json(diag);
});

app.get("/disparos/config", async (_req, res) => {
  try {
    const config = await loadDisparosConfigFromDb();
    const autoProviders = getAutoShortenerProviderOrder();
    const currentShortenerProvider = autoProviders[0];
    return res.json({
      config,
      shortenerAuto: true,
      currentShortenerProvider,
      shortenerProviders: [
        { id: "isgd", label: "is.gd (gratuito)", auth: "não requer token" },
        { id: "tinyurl", label: "TinyURL", auth: "requer token (plano gratuito disponível)" },
      ],
    });
  } catch {
    return res.status(500).json({ error: "Erro ao carregar configuração do Disparador." });
  }
});

app.post("/disparos/config", async (req, res) => {
  try {
    const config = parseDisparosConfig(req.body?.config || {});
    await saveDisparosConfigToDb(config);
    return res.json({ ok: true, message: "Configuração do Disparador salva.", config });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || "Configuração inválida." });
  }
});

app.post("/disparos/shorten", async (req, res) => {
  try {
    const longUrl = String(req.body?.longUrl || "").trim();
    const domain = ""; // domínio custom removido da UI por simplicidade operacional
    if (!/^https?:\/\//i.test(longUrl)) {
      return res.status(400).json({ error: "longUrl deve ser uma URL válida." });
    }

    let shortUrl = "";
    let finalLongUrl = longUrl;
    let providerUsed: DisparosConfig["shortenerProvider"] | null = null;
    const maxAttempts = 5;
    const providers = getAutoShortenerProviderOrder();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const candidateUrl =
        attempt === 1 ? longUrl : appendAntiRepeatParam(longUrl, attempt);
      for (const provider of providers) {
        try {
          const candidateShort = await shortenUrlWithProvider(
            candidateUrl,
            provider,
            domain
          );
          if (candidateShort !== lastShortUrlIssued) {
            shortUrl = candidateShort;
            finalLongUrl = candidateUrl;
            providerUsed = provider;
            break;
          }
        } catch {
          // tenta próximo provedor
        }
      }
      if (shortUrl) break;
    }

    if (!shortUrl) {
      return res.status(409).json({
        error:
          "Não foi possível gerar um link diferente do último link usado. Tente novamente.",
      });
    }

    lastShortUrlIssued = shortUrl;
    return res.json({
      ok: true,
      shortUrl,
      provider: providerUsed || providers[0],
      nonRepeated: true,
      sourceUrlUsed: finalLongUrl,
      shortenerAuto: true,
    });
  } catch (error: any) {
    return res.status(502).json({ error: error?.message || "Falha ao encurtar URL." });
  }
});

app.get("/disparos/next-instance", async (_req, res) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(EVO_INSTANCES_URL, {
      headers: { apikey: EVO_API_KEY, "Content-Type": "application/json" },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));
    if (!response.ok) {
      return res.status(502).json({ error: "Falha ao consultar instâncias na EVO." });
    }
    const raw = await response.json();
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.response)
        ? raw.response
        : Array.isArray(raw?.data)
          ? raw.data
          : [];
    const connected = buildConnectedFromEvoResponse(list);
    const usageMap = await loadInstanceUsageMap();
    const eligible = connected.filter((item) => {
      const usage = usageMap.get(item.instancia);
      return usage ? usage.useDisparador !== false : true;
    });
    if (!eligible.length) {
      return res.status(409).json({
        error: "Nenhuma instância conectada e habilitada para Disparador.",
      });
    }
    const idx = disparosRoundRobinCounter % eligible.length;
    const selected = eligible[idx];
    disparosRoundRobinCounter += 1;
    return res.json({
      ok: true,
      selected,
      totalEligible: eligible.length,
      fallbackEnabled: true,
      note:
        "Quando a instância atual desconectar/bloquear, o próximo ciclo deve usar a próxima conectada.",
    });
  } catch {
    return res.status(500).json({ error: "Erro ao selecionar próxima instância do Disparador." });
  }
});

app.get("/disparos/templates", async (_req, res) => {
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data } = await (supabase
          .from("disparos_message_templates" as any)
          .select("id, message_text, alias, segment, source, created_at, active")
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(200)) as any;
        if (Array.isArray(data)) {
          const items = data.map((row: any) => ({
            id: String(row?.id || ""),
            text: String(row?.message_text || ""),
            alias: String(row?.alias || ""),
            segment: String(row?.segment || ""),
            source: row?.source === "manual" ? "manual" : "spreadsheet",
            createdAt: String(row?.created_at || ""),
            active: row?.active !== false,
          }));
          return res.json({ items });
        }
      } catch {
        // fallback em memória
      }
    }
    return res.json({ items: disparosTemplatesMemory.slice(0, 200) });
  } catch {
    return res.status(500).json({ error: "Erro ao listar templates de mensagem." });
  }
});

app.post("/disparos/templates/import", async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const mapped = rows
      .map((row: any) => ({
        id: crypto.randomUUID(),
        text: String(row?.text || "").trim(),
        alias: String(row?.alias || "").trim(),
        segment: String(row?.segment || "").trim(),
        source: "spreadsheet" as const,
        createdAt: new Date().toISOString(),
        active: true,
      }))
      .filter((row: MessageTemplate) => row.text.length > 0);
    if (!mapped.length) {
      return res.status(400).json({ error: "Nenhuma mensagem válida encontrada para importar." });
    }
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const payload = mapped.map((row: MessageTemplate) => ({
          id: row.id,
          message_text: row.text,
          alias: row.alias,
          segment: row.segment,
          source: row.source,
          created_at: row.createdAt,
          active: row.active,
        }));
        await (supabase.from("disparos_message_templates" as any) as any).insert(payload);
      } catch {
        disparosTemplatesMemory.unshift(...mapped);
      }
    } else {
      disparosTemplatesMemory.unshift(...mapped);
    }
    return res.json({
      ok: true,
      imported: mapped.length,
      message: `${mapped.length} mensagem(ns) importada(s) com sucesso.`,
    });
  } catch {
    return res.status(500).json({ error: "Erro ao importar templates de mensagem." });
  }
});

app.listen(PORT, () => {
  console.log(`Disparador N8 - servidor rodando em http://localhost:${PORT}`);
});

