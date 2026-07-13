import type { SystemLogMotivo, SystemLogStatus } from "./system-connection-log.types";
import { resolveUptimePlaybookForTarget } from "./uptime-playbooks";

const TZ = "America/Sao_Paulo";
const VPS_HINT = "srv1261237 (72.60.51.127) · Easypanel Swarm · Traefik easypanel-traefik";

export type SystemLogHandoffInput = {
  ts: string;
  status: SystemLogStatus;
  motivo: SystemLogMotivo;
  targetKey: string;
  targetLabel: string;
  probeDetail: string;
  targetUrl?: string | null;
  consecutiveFailures?: number;
  downCountSameCheck?: number;
  peersDown?: string[];
  previousSince?: string | null;
  durationHours?: number;
};

function formatLocal(ts: string): string {
  try {
    return new Date(ts).toLocaleString("pt-BR", { timeZone: TZ });
  } catch {
    return ts;
  }
}

function classifyHint(motivo: SystemLogMotivo, probeDetail: string): string {
  const d = String(probeDetail || "").toLowerCase();
  if (motivo === "Yaml") {
    return "Suspeita de rule/entryPoint/backend incorreto no main.yaml ou arquivo dinâmico (ex.: web/websecure vs http/https).";
  }
  if (motivo === "Docker") {
    return "Suspeita de serviço Swarm 0/1, publish ausente, overlay DNS ou container reiniciando.";
  }
  if (motivo === "Servidor") {
    return "Suspeita de rede/host (timeout, DNS, unreachable) ou VPS sobrecarregado — validar :443 e conectividade local.";
  }
  if (/502|bad gateway/.test(d)) {
    return "502: Traefik alcançou o router mas o backend (publish host / 172.17.0.1:PORT) não respondeu.";
  }
  if (/000|timeout|abort/.test(d)) {
    return "Sem resposta TLS/HTTP a tempo — checar Traefik 1/1, listener :443 e publish do backend.";
  }
  return "Falha no caminho HTTPS/proxy — priorizar probe local do backend e backends no Traefik (sem HUP se :443 up).";
}

/** Texto curto para célula da tabela. */
export function buildSystemLogResumo(input: SystemLogHandoffInput): string {
  const status = input.status === "conexao" ? "UP" : "DOWN";
  const dur =
    input.status === "conexao" && input.durationHours != null
      ? ` · offline ~${input.durationHours.toFixed(2)}h`
      : "";
  return `[${status}] ${input.targetLabel} · ${input.probeDetail}${dur} · motivo ${input.motivo}`;
}

/**
 * Brief completo para colar em ticket / enviar a dev backend-rede ou agente de IA.
 */
export function buildSystemLogHandoffBrief(input: SystemLogHandoffInput): string {
  const playbook = resolveUptimePlaybookForTarget(input.targetKey);
  const peers =
    input.peersDown && input.peersDown.length
      ? input.peersDown.join(", ")
      : input.downCountSameCheck && input.downCountSameCheck > 1
        ? `${input.downCountSameCheck} alvos down no mesmo check`
        : "nenhum outro reportado";
  const commands = (playbook?.steps || [])
    .map((step) => {
      const note = step.note ? `  # ${step.note}` : "";
      return `${step.order}. ${step.title}\n   ${step.command}${note ? `\n${note}` : ""}`;
    })
    .join("\n");

  const lines = [
    "## WABA · System Connection Log — Handoff técnico",
    "",
    "### Evento",
    `- Status: ${input.status === "conexao" ? "Conexão (recuperação)" : "Desconexão (queda)"}`,
    `- Motivo classificado: ${input.motivo}`,
    `- Hipótese: ${classifyHint(input.motivo, input.probeDetail)}`,
    `- Timestamp UTC: ${input.ts}`,
    `- Timestamp ${TZ}: ${formatLocal(input.ts)}`,
    "",
    "### Alvo monitorado",
    `- Label: ${input.targetLabel}`,
    `- Key: ${input.targetKey}`,
    `- URL/probe: ${input.targetUrl || "(não informada — ver key/playbook)"}`,
    `- Resultado do probe: ${input.probeDetail}`,
    `- Falhas consecutivas: ${input.consecutiveFailures ?? "n/d"}`,
    `- Outros alvos down (mesmo check): ${peers}`,
  ];

  if (input.previousSince) {
    lines.push(`- Offline desde: ${input.previousSince} (${formatLocal(input.previousSince)})`);
  }
  if (input.durationHours != null) {
    lines.push(`- Duração offline encerrada: ~${input.durationHours.toFixed(3)} h`);
  }

  lines.push(
    "",
    "### Stack / ambiente",
    `- VPS: ${VPS_HINT}`,
    "- Backends canônicos: host gateway `http://172.17.0.1:<porta>/` (30180 WABA, 30210 disparos, 30211 bet, 30181 EVO)",
    "- Evitar `docker service update --force easypanel-traefik` / HUP se Traefik já estiver 1/1 e :443 up",
    "- Script heal login: `/root/waba-infra/heal-waba-login-vps.sh run`",
  );

  if (playbook) {
    lines.push(
      "",
      "### Playbook do alvo",
      `- ${playbook.label}: ${playbook.summary}`,
      "",
      "### Comandos sugeridos (root no VPS)",
      commands || "(sem passos cadastrados)",
    );
  } else {
    lines.push(
      "",
      "### Comandos genéricos sugeridos",
      "1. `curl -sS --max-time 10 http://127.0.0.1:30180/health`",
      "2. `ss -tlnp | grep -E ':443|:30180'`",
      "3. `docker service ls | grep -E 'traefik|waba_disparador'`",
      "4. `bash /root/restore-easypanel-traefik-backends-vps.sh`",
      "5. `bash /root/waba-infra/heal-waba-login-vps.sh run`",
    );
  }

  lines.push(
    "",
    "### Pedido ao desenvolvedor / agente",
    "Diagnosticar a causa da falha de conectividade, aplicar correção mínima (publish/backends/YAML/Docker) e validar:",
    `1) probe local do backend; 2) HTTPS do alvo \`${input.targetLabel}\` → HTTP 200; 3) não derrubar :443 sem necessidade.`,
    "",
    "### Resumo uma linha",
    buildSystemLogResumo(input),
  );

  return lines.join("\n");
}
