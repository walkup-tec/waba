import {
  SYSTEM_LOG_MOTIVOS,
  type SystemConnectionLogDashboard,
  type SystemConnectionLogEvent,
  type SystemConnectionLogFilters,
  type SystemLogMotivo,
  type SystemLogMotivoShare,
  type SystemLogStatus,
} from "./system-connection-log.types";
import { systemConnectionLogRepository } from "./system-connection-log.repository";
import { classifySystemLogMotivo } from "./system-connection-log.classifier";

const TZ = "America/Sao_Paulo";

function parseIso(ts: string): number {
  const n = Date.parse(ts);
  return Number.isFinite(n) ? n : 0;
}

function formatDay(ts: string): string {
  return new Date(ts).toLocaleDateString("pt-BR", { timeZone: TZ });
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function resolveRange(filters: SystemConnectionLogFilters): { fromMs: number; toMs: number; days: number } {
  const now = Date.now();
  const toMs = filters.to ? parseIso(filters.to) || now : now;
  let fromMs = filters.from ? parseIso(filters.from) : 0;

  if (filters.preset === "day") {
    fromMs = now - 24 * 60 * 60 * 1000;
  } else if (filters.preset === "week") {
    fromMs = now - 7 * 24 * 60 * 60 * 1000;
  } else if (filters.preset === "month") {
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
  } else if (!fromMs) {
    fromMs = now - 30 * 24 * 60 * 60 * 1000;
  }

  const days = Math.max(1, Math.ceil((toMs - fromMs) / (24 * 60 * 60 * 1000)));
  return { fromMs, toMs, days };
}

function shareByMotivo(events: SystemConnectionLogEvent[]): SystemLogMotivoShare[] {
  const downs = events.filter((e) => e.status === "desconexao");
  const counts = new Map<SystemLogMotivo, number>();
  for (const motivo of SYSTEM_LOG_MOTIVOS) counts.set(motivo, 0);
  for (const event of downs) {
    counts.set(event.motivo, (counts.get(event.motivo) || 0) + 1);
  }
  const total = Math.max(1, downs.length);
  return SYSTEM_LOG_MOTIVOS.map((motivo) => {
    const count = counts.get(motivo) || 0;
    return { motivo, count, pct: downs.length ? (count / total) * 100 : 0 };
  }).filter((row) => row.count > 0);
}

function applyFilters(
  events: SystemConnectionLogEvent[],
  filters: SystemConnectionLogFilters,
  fromMs: number,
  toMs: number,
): SystemConnectionLogEvent[] {
  const motivos = filters.motivos?.length ? new Set(filters.motivos) : null;
  const status = filters.status && filters.status !== "all" ? filters.status : null;
  return events
    .filter((event) => {
      const ts = parseIso(event.ts);
      if (ts < fromMs || ts > toMs) return false;
      if (motivos && !motivos.has(event.motivo)) return false;
      if (status && event.status !== status) return false;
      return true;
    })
    .sort((a, b) => parseIso(b.ts) - parseIso(a.ts));
}

export class SystemConnectionLogService {
  async recordTransition(input: {
    status: SystemLogStatus;
    detail: string;
    targetKey: string;
    targetLabel: string;
    ts?: string;
    downCountSameCheck?: number;
    previousSince?: string | null;
  }): Promise<SystemConnectionLogEvent> {
    const ts = input.ts || new Date().toISOString();
    const motivo = classifySystemLogMotivo({
      detail: input.detail,
      targetKey: input.targetKey,
      targetLabel: input.targetLabel,
      downCountSameCheck: input.downCountSameCheck,
    });
    let durationHours: number | undefined;
    if (input.status === "conexao" && input.previousSince) {
      const ms = parseIso(ts) - parseIso(input.previousSince);
      if (ms > 0) durationHours = Math.round((ms / 3_600_000) * 1000) / 1000;
    }
    const detalhes =
      input.status === "desconexao"
        ? `Alvo ${input.targetLabel} fora do ar — ${input.detail}`
        : `Alvo ${input.targetLabel} recuperado — ${input.detail}${
            durationHours != null ? ` (offline ~${durationHours.toFixed(2)}h)` : ""
          }`;

    return systemConnectionLogRepository.append({
      ts,
      status: input.status,
      motivo,
      detalhes,
      targetKey: input.targetKey,
      targetLabel: input.targetLabel,
      durationHours,
    });
  }

  async getDashboard(rawFilters: SystemConnectionLogFilters = {}): Promise<SystemConnectionLogDashboard> {
    const filters: SystemConnectionLogFilters = {
      preset: rawFilters.preset || "month",
      ...rawFilters,
    };
    const all = await systemConnectionLogRepository.listAll();
    const { fromMs, toMs, days } = resolveRange(filters);
    const filtered = applyFilters(all, filters, fromMs, toMs);

    const conexaoCount = filtered.filter((e) => e.status === "conexao").length;
    const desconexaoCount = filtered.filter((e) => e.status === "desconexao").length;
    const desconexaoHours = filtered
      .filter((e) => e.status === "conexao" && typeof e.durationHours === "number")
      .reduce((sum, e) => sum + (e.durationHours || 0), 0);
    // horas conectadas aproximadas = janela - offline (não negativa)
    const windowHours = days * 24;
    const conexaoHours = Math.max(0, windowHours - desconexaoHours);

    const now = Date.now();
    const dayEvents = all.filter((e) => parseIso(e.ts) >= now - 24 * 60 * 60 * 1000);
    const weekEvents = all.filter((e) => parseIso(e.ts) >= now - 7 * 24 * 60 * 60 * 1000);
    const monthEvents = all.filter((e) => parseIso(e.ts) >= now - 30 * 24 * 60 * 60 * 1000);

    // gráficos respeitam filtro de motivo/app quando aplicado
    const motivoFilter = filters.motivos?.length ? new Set(filters.motivos) : null;
    const narrow = (list: SystemConnectionLogEvent[]) =>
      motivoFilter ? list.filter((e) => motivoFilter.has(e.motivo)) : list;

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
      })),
      totalEvents: filtered.length,
    };
  }

  async exportRows(filters: SystemConnectionLogFilters = {}): Promise<
    Array<{
      Dia: string;
      Horário: string;
      Status: string;
      Motivo: string;
      Detalhes: string;
      Alvo: string;
    }>
  > {
    const dashboard = await this.getDashboard(filters);
    return dashboard.events.map((event) => ({
      Dia: event.dia,
      Horário: event.horario,
      Status: event.statusLabel,
      Motivo: event.motivo,
      Detalhes: event.detalhes,
      Alvo: event.targetLabel,
    }));
  }
}

export const systemConnectionLogService = new SystemConnectionLogService();
