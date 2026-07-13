export const SYSTEM_LOG_MOTIVOS = ["Traefik", "Yaml", "Docker", "Servidor"] as const;

export type SystemLogMotivo = (typeof SYSTEM_LOG_MOTIVOS)[number];

export type SystemLogStatus = "conexao" | "desconexao";

export type SystemConnectionLogEvent = {
  id: string;
  ts: string;
  status: SystemLogStatus;
  motivo: SystemLogMotivo;
  /** Texto curto para listagem. */
  detalhes: string;
  /** Brief completo para handoff (dev/agente). */
  handoff?: string;
  targetKey: string;
  targetLabel: string;
  targetUrl?: string;
  probeDetail?: string;
  consecutiveFailures?: number;
  peersDown?: string[];
  /** Horas do período offline encerrado (preenchido em eventos de conexão). */
  durationHours?: number;
};

export type SystemLogMotivoShare = {
  motivo: SystemLogMotivo;
  count: number;
  pct: number;
};

export type SystemConnectionLogFilters = {
  motivos?: SystemLogMotivo[];
  status?: SystemLogStatus | "all";
  from?: string;
  to?: string;
  preset?: "day" | "week" | "month" | "custom";
  month?: number;
  year?: number;
};

export type SystemConnectionLogDashboard = {
  generatedAt: string;
  filters: SystemConnectionLogFilters;
  kpis: {
    eventsPerDay: { conexao: number; desconexao: number };
    hoursPerDay: { conexao: number; desconexao: number };
    daysInRange: number;
  };
  appsFailDay: SystemLogMotivoShare[];
  appsFailWeek: SystemLogMotivoShare[];
  appsFailMonth: SystemLogMotivoShare[];
  events: Array<
    SystemConnectionLogEvent & {
      dia: string;
      horario: string;
      statusLabel: string;
      /** Brief técnico para copiar (sempre preenchido na API). */
      handoffBrief: string;
    }
  >;
  totalEvents: number;
};
