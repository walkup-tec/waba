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
exports.systemConnectionLogService = exports.SystemConnectionLogService = void 0;
const system_connection_log_types_1 = require("./system-connection-log.types");
const system_connection_log_repository_1 = require("./system-connection-log.repository");
const system_connection_log_classifier_1 = require("./system-connection-log.classifier");
const system_connection_log_handoff_1 = require("./system-connection-log-handoff");
const TZ = "America/Sao_Paulo";
function parseIso(ts) {
    const n = Date.parse(ts);
    return Number.isFinite(n) ? n : 0;
}
function formatDay(ts) {
    return new Date(ts).toLocaleDateString("pt-BR", { timeZone: TZ });
}
function formatTime(ts) {
    return new Date(ts).toLocaleTimeString("pt-BR", {
        timeZone: TZ,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}
function resolveRange(filters) {
    const now = Date.now();
    const toMs = filters.to ? parseIso(filters.to) || now : now;
    let fromMs = filters.from ? parseIso(filters.from) : 0;
    if (filters.preset === "day") {
        fromMs = now - 24 * 60 * 60 * 1000;
    }
    else if (filters.preset === "week") {
        fromMs = now - 7 * 24 * 60 * 60 * 1000;
    }
    else if (filters.preset === "month") {
        if (filters.month && filters.year) {
            const month = Math.min(12, Math.max(1, filters.month));
            const year = filters.year;
            fromMs = Date.UTC(year, month - 1, 1, 3, 0, 0);
            const end = Date.UTC(year, month, 1, 3, 0, 0) - 1;
            return {
                fromMs,
                toMs: Math.min(end, toMs),
                days: Math.max(1, Math.ceil((Math.min(end, toMs) - fromMs) / (24 * 60 * 60 * 1000))),
            };
        }
        fromMs = now - 30 * 24 * 60 * 60 * 1000;
    }
    else if (!fromMs) {
        fromMs = now - 30 * 24 * 60 * 60 * 1000;
    }
    const days = Math.max(1, Math.ceil((toMs - fromMs) / (24 * 60 * 60 * 1000)));
    return { fromMs, toMs, days };
}
function shareByMotivo(events) {
    const downs = events.filter((e) => e.status === "desconexao");
    const counts = new Map();
    for (const motivo of system_connection_log_types_1.SYSTEM_LOG_MOTIVOS)
        counts.set(motivo, 0);
    for (const event of downs) {
        counts.set(event.motivo, (counts.get(event.motivo) || 0) + 1);
    }
    const total = Math.max(1, downs.length);
    return system_connection_log_types_1.SYSTEM_LOG_MOTIVOS.map((motivo) => {
        const count = counts.get(motivo) || 0;
        return { motivo, count, pct: downs.length ? (count / total) * 100 : 0 };
    }).filter((row) => row.count > 0);
}
function applyFilters(events, filters, fromMs, toMs) {
    const motivos = filters.motivos?.length ? new Set(filters.motivos) : null;
    const status = filters.status && filters.status !== "all" ? filters.status : null;
    return events
        .filter((event) => {
        const ts = parseIso(event.ts);
        if (ts < fromMs || ts > toMs)
            return false;
        if (motivos && !motivos.has(event.motivo))
            return false;
        if (status && event.status !== status)
            return false;
        return true;
    })
        .sort((a, b) => parseIso(b.ts) - parseIso(a.ts));
}
function resolveHandoffBrief(event) {
    if (event.handoff && event.handoff.trim().length > 40)
        return event.handoff;
    return (0, system_connection_log_handoff_1.buildSystemLogHandoffBrief)({
        ts: event.ts,
        status: event.status,
        motivo: event.motivo,
        targetKey: event.targetKey,
        targetLabel: event.targetLabel,
        probeDetail: event.probeDetail || event.detalhes || "n/d",
        targetUrl: event.targetUrl,
        consecutiveFailures: event.consecutiveFailures,
        peersDown: event.peersDown,
        previousSince: null,
        durationHours: event.durationHours,
    });
}
class SystemConnectionLogService {
    async recordTransition(input) {
        const ts = input.ts || new Date().toISOString();
        const motivo = (0, system_connection_log_classifier_1.classifySystemLogMotivo)({
            detail: input.detail,
            targetKey: input.targetKey,
            targetLabel: input.targetLabel,
            downCountSameCheck: input.downCountSameCheck,
        });
        let durationHours;
        if (input.status === "conexao" && input.previousSince) {
            const ms = parseIso(ts) - parseIso(input.previousSince);
            if (ms > 0)
                durationHours = Math.round((ms / 3600000) * 1000) / 1000;
        }
        const handoffInput = {
            ts,
            status: input.status,
            motivo,
            targetKey: input.targetKey,
            targetLabel: input.targetLabel,
            probeDetail: input.detail,
            targetUrl: input.targetUrl,
            consecutiveFailures: input.consecutiveFailures,
            downCountSameCheck: input.downCountSameCheck,
            peersDown: input.peersDown,
            previousSince: input.previousSince,
            durationHours,
        };
        const detalhes = (0, system_connection_log_handoff_1.buildSystemLogResumo)(handoffInput);
        const handoff = (0, system_connection_log_handoff_1.buildSystemLogHandoffBrief)(handoffInput);
        return system_connection_log_repository_1.systemConnectionLogRepository.append({
            ts,
            status: input.status,
            motivo,
            detalhes,
            handoff,
            targetKey: input.targetKey,
            targetLabel: input.targetLabel,
            targetUrl: input.targetUrl || undefined,
            probeDetail: input.detail,
            consecutiveFailures: input.consecutiveFailures,
            peersDown: input.peersDown,
            durationHours,
        });
    }
    /** Se ainda não há histórico, materializa o estado atual do uptime (evita tela vazia). */
    async seedFromUptimeStateIfEmpty() {
        const existing = await system_connection_log_repository_1.systemConnectionLogRepository.listAll();
        if (existing.length > 0)
            return 0;
        try {
            const { promises: fs } = await Promise.resolve().then(() => __importStar(require("fs")));
            const { resolveDataFile } = await Promise.resolve().then(() => __importStar(require("../data-path")));
            const statePath = resolveDataFile("uptime-monitor-state.json");
            const raw = await fs.readFile(statePath, "utf-8");
            const parsed = JSON.parse(raw);
            const targets = parsed?.targets && typeof parsed.targets === "object" ? parsed.targets : {};
            const entries = Object.entries(targets);
            if (!entries.length)
                return 0;
            const peersDown = entries.filter(([, t]) => t.status === "down").map(([k]) => k);
            let n = 0;
            for (const [key, target] of entries) {
                const status = target.status === "down" ? "desconexao" : "conexao";
                const detail = String(target.lastDetail || (status === "desconexao" ? "offline" : "online"));
                const ts = String(target.lastCheckedAt || target.since || new Date().toISOString());
                await this.recordTransition({
                    status,
                    detail: `${detail} (seed estado uptime)`,
                    targetKey: key,
                    targetLabel: key.replace(/_/g, " "),
                    ts,
                    previousSince: status === "conexao" ? target.since || null : null,
                    consecutiveFailures: target.consecutiveFailures,
                    downCountSameCheck: peersDown.length,
                    peersDown,
                });
                n += 1;
            }
            return n;
        }
        catch {
            return 0;
        }
    }
    async getDashboard(rawFilters = {}) {
        await this.seedFromUptimeStateIfEmpty();
        const filters = {
            preset: rawFilters.preset || "month",
            ...rawFilters,
        };
        const all = await system_connection_log_repository_1.systemConnectionLogRepository.listAll();
        const { fromMs, toMs, days } = resolveRange(filters);
        const filtered = applyFilters(all, filters, fromMs, toMs);
        const conexaoCount = filtered.filter((e) => e.status === "conexao").length;
        const desconexaoCount = filtered.filter((e) => e.status === "desconexao").length;
        const desconexaoHours = filtered
            .filter((e) => e.status === "conexao" && typeof e.durationHours === "number")
            .reduce((sum, e) => sum + (e.durationHours || 0), 0);
        const windowHours = days * 24;
        const conexaoHours = Math.max(0, windowHours - desconexaoHours);
        const now = Date.now();
        const dayEvents = all.filter((e) => parseIso(e.ts) >= now - 24 * 60 * 60 * 1000);
        const weekEvents = all.filter((e) => parseIso(e.ts) >= now - 7 * 24 * 60 * 60 * 1000);
        const monthEvents = all.filter((e) => parseIso(e.ts) >= now - 30 * 24 * 60 * 60 * 1000);
        const motivoFilter = filters.motivos?.length ? new Set(filters.motivos) : null;
        const narrow = (list) => motivoFilter ? list.filter((e) => motivoFilter.has(e.motivo)) : list;
        return {
            generatedAt: new Date().toISOString(),
            filters,
            kpis: {
                eventsPerDay: {
                    conexao: Math.round((conexaoCount / days) * 100) / 100,
                    desconexao: Math.round((desconexaoCount / days) * 100) / 100,
                },
                hoursPerDay: {
                    conexao: Math.round((conexaoHours / days) * 100) / 100,
                    desconexao: Math.round((desconexaoHours / days) * 100) / 100,
                },
                daysInRange: days,
            },
            appsFailDay: shareByMotivo(narrow(dayEvents)),
            appsFailWeek: shareByMotivo(narrow(weekEvents)),
            appsFailMonth: shareByMotivo(narrow(monthEvents)),
            events: filtered.map((event) => ({
                ...event,
                dia: formatDay(event.ts),
                horario: formatTime(event.ts),
                statusLabel: event.status === "conexao" ? "Conexão" : "Desconexão",
                handoffBrief: resolveHandoffBrief(event),
            })),
            totalEvents: filtered.length,
        };
    }
    async exportRows(filters = {}) {
        const dashboard = await this.getDashboard(filters);
        return dashboard.events.map((event) => ({
            Dia: event.dia,
            Horário: event.horario,
            Status: event.statusLabel,
            Motivo: event.motivo,
            Resumo: event.detalhes,
            Alvo: event.targetLabel,
            Key: event.targetKey,
            Probe: event.probeDetail || "",
            Handoff: event.handoffBrief,
        }));
    }
}
exports.SystemConnectionLogService = SystemConnectionLogService;
exports.systemConnectionLogService = new SystemConnectionLogService();
