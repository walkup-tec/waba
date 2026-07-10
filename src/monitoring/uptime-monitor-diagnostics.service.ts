import { execFile } from "child_process";
import { promisify } from "util";
import type { VpsCpuPlaybook } from "../infra/vps-cpu-monitor.types";
import { getUptimeLights, resolveUptimeTargets } from "./uptime-monitor.service";
import { evaluateAsaasIntegrationHealth } from "./asaas-integration-health.service";
import {
  isKnownUptimePlaybookTargetKey,
  resolveUptimePlaybookForTarget,
} from "./uptime-playbooks";

const execFileAsync = promisify(execFile);

const DIAGNOSTIC_MASTER_EMAIL = "walkup@walkuptec.com.br";

const SSH_ALLOWLIST = new Set([
  "bash /root/traefik-sync-landings-dynamic-vps.sh",
  "tail -20 /var/log/traefik-sync-landings-dynamic.log",
  'curl -sS -o /dev/null -w "disparos:%{http_code} bet:%{http_code}\\n" --max-time 15 https://wabadisparos.com.br/ https://bet.waba.info/',
  "bash /root/traefik-easypanel-bootstrap.sh",
  "curl -sS --max-time 10 http://127.0.0.1:30180/health",
  "bash /root/traefik-permanent-waba-vps.sh run",
  'curl -sS -o /dev/null -w "drax:%{http_code}\\n" --max-time 15 https://draxsistemas.com.br/',
  "curl -sSI --max-time 15 https://draxsistemas.com.br/ | head -20",
  "docker service ps walkup_evo-walkup --no-trunc | head -8",
  'curl -sS -o /dev/null -w "evo:%{http_code}\\n" --max-time 12 -H "apikey: $EVO_API_KEY" http://127.0.0.1:30181/instance/fetchInstances',
  "docker service update --force walkup_evo-walkup",
]);

export type UptimeDiagnosticStepResult = {
  order: number;
  title: string;
  command: string;
  note?: string;
  executed: boolean;
  ok: boolean;
  output: string;
};

export type UptimeDiagnosticResult = {
  targetKey: string;
  label: string;
  checkedAt: string;
  light: { ok: boolean; detail: string };
  playbook: VpsCpuPlaybook;
  inApp?: Record<string, unknown>;
  steps: UptimeDiagnosticStepResult[];
  hints: string[];
};

const isDiagnosticExecEnabled = (): boolean =>
  String(process.env.WABA_UPTIME_DIAGNOSTIC_EXEC ?? "").trim() === "1";

const resolveSshTarget = (): { host: string; user: string } | null => {
  const host = String(process.env.WABA_UPTIME_DIAGNOSTIC_SSH_HOST ?? "").trim();
  if (!host) return null;
  const user = String(process.env.WABA_UPTIME_DIAGNOSTIC_SSH_USER ?? "root").trim() || "root";
  return { host, user };
};

async function runAllowlistedRemoteCommand(command: string): Promise<{ ok: boolean; output: string }> {
  const trimmed = String(command || "").trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("POST ")) {
    return { ok: true, output: "Passo manual — sem execução remota." };
  }
  if (!SSH_ALLOWLIST.has(trimmed)) {
    return { ok: false, output: "Comando fora da allowlist de diagnóstico." };
  }
  const ssh = resolveSshTarget();
  if (!ssh) {
    return { ok: false, output: "SSH não configurado (WABA_UPTIME_DIAGNOSTIC_SSH_HOST)." };
  }
  try {
    const { stdout, stderr } = await execFileAsync(
      "ssh",
      ["-o", "BatchMode=yes", "-o", "ConnectTimeout=12", `${ssh.user}@${ssh.host}`, trimmed],
      { timeout: 45_000, maxBuffer: 512 * 1024 },
    );
    const output = [stdout, stderr].filter(Boolean).join("\n").trim().slice(0, 4000);
    return { ok: true, output: output || "(sem saída)" };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error && "stderr" in error
          ? String((error as { stderr?: string }).stderr || "")
          : "falha SSH";
    return { ok: false, output: message.slice(0, 4000) };
  }
}

async function buildInAppDiagnostics(targetKey: string): Promise<Record<string, unknown> | undefined> {
  if (targetKey === "asaas_webhook") {
    const health = await evaluateAsaasIntegrationHealth();
    return { health };
  }
  return undefined;
}

function buildHints(targetKey: string, lightOk: boolean): string[] {
  if (lightOk) {
    return ["O alvo respondeu OK na checagem rápida. Use o playbook se o problema for intermitente."];
  }
  if (targetKey === "site_bet" || targetKey === "site_disparos") {
    return [
      "Landings WABA: priorize traefik-sync-landings-dynamic-vps.sh.",
      "Não use restore-landing-routers nem patches no main.yaml do Easypanel.",
    ];
  }
  if (targetKey === "app_waba") {
    return ["Confirme :30180/health no host antes de mexer no Traefik."];
  }
  if (targetKey === "asaas_webhook") {
    return ["Use o botão de executar monitor Asaas no Financeiro ou a ação in-app deste diagnóstico."];
  }
  return [];
}

export async function diagnoseUptimeTarget(
  targetKey: string,
  options?: { execute?: boolean },
): Promise<UptimeDiagnosticResult> {
  const key = String(targetKey || "").trim();
  if (!isKnownUptimePlaybookTargetKey(key)) {
    const known = resolveUptimeTargets().map((t) => t.key);
    throw new Error(`Alvo inválido. Use: ${known.join(", ")}`);
  }

  const playbook = resolveUptimePlaybookForTarget(key);
  if (!playbook) {
    throw new Error("Playbook não encontrado para o alvo.");
  }

  const lightsPayload = await getUptimeLights({ fresh: true });
  const lightRow = lightsPayload.lights.find((l) => l.key === key);
  const light = {
    ok: Boolean(lightRow?.ok),
    detail: String(lightRow?.detail || "sem detalhe"),
  };
  const label = String(lightRow?.label || playbook.label);

  const inApp = await buildInAppDiagnostics(key);
  const execute = Boolean(options?.execute) && isDiagnosticExecEnabled();
  const hints = buildHints(key, light.ok);

  const steps: UptimeDiagnosticStepResult[] = [];
  for (const step of [...playbook.steps].sort((a, b) => (a.order || 0) - (b.order || 0))) {
    const command = String(step.command || "").trim();
    let executed = false;
    let ok = true;
    let output = "Modo somente leitura — copie o comando e execute no VPS.";

    if (execute) {
      executed = true;
      const result = await runAllowlistedRemoteCommand(command);
      ok = result.ok;
      output = result.output;
    }

    steps.push({
      order: Number(step.order || 0),
      title: String(step.title || "Passo"),
      command,
      note: step.note,
      executed,
      ok,
      output,
    });
  }

  return {
    targetKey: key,
    label,
    checkedAt: lightsPayload.checkedAt,
    light,
    playbook,
    inApp,
    steps,
    hints,
  };
}

export const isUptimeDiagnosticMasterEmail = (email: string): boolean =>
  String(email || "").trim().toLowerCase() === DIAGNOSTIC_MASTER_EMAIL;

export const uptimeDiagnosticMasterEmail = (): string => DIAGNOSTIC_MASTER_EMAIL;
