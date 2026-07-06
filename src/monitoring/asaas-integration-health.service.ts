import {
  isAsaasConfigured,
  isAsaasTransferConfigured,
  probeAsaasPaymentApi,
  probeAsaasTransferPermission,
  usesDedicatedAsaasTransferKey,
} from "../billing/asaas.client";

export type AsaasIntegrationIssueAction = "env" | "code" | "asaas_panel";

export type AsaasIntegrationIssue = {
  code: string;
  severity: "critical" | "warning";
  message: string;
  action: AsaasIntegrationIssueAction;
};

export type AsaasIntegrationHealthReport = {
  ok: boolean;
  checkedAt: string;
  issues: AsaasIntegrationIssue[];
};

const isProductionRuntime = (): boolean => {
  const runtime = String(process.env.RUNTIME_MODE ?? "").trim().toLowerCase();
  const wabaEnv = String(process.env.WABA_ENV ?? "").trim().toLowerCase();
  if (runtime === "production") return true;
  if (wabaEnv === "v01") return true;
  if (!runtime && wabaEnv !== "v02") return true;
  return false;
};

const isSplitPayoutEnabled = (): boolean => {
  const raw = String(process.env.WABA_FINANCEIRO_SPLIT_PAYOUT_ENABLED ?? "true")
    .trim()
    .toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "no";
};

const resolveAsaasApiBaseUrl = (): string =>
  String(process.env.ASAAS_API_BASE_URL ?? "").trim().replace(/\/$/, "");

export async function evaluateAsaasIntegrationHealth(): Promise<AsaasIntegrationHealthReport> {
  const issues: AsaasIntegrationIssue[] = [];
  const production = isProductionRuntime();
  const splitEnabled = isSplitPayoutEnabled();
  const apiBaseUrl = resolveAsaasApiBaseUrl();

  if (!isAsaasConfigured()) {
    issues.push({
      code: "missing_asaas_api_key",
      severity: "critical",
      message: "ASAAS_API_KEY ausente — checkout PIX e webhooks de pagamento não funcionam.",
      action: "env",
    });
  }

  const webhookToken = String(process.env.ASAAS_WEBHOOK_ACCESS_TOKEN ?? "").trim();
  if (production && !webhookToken) {
    issues.push({
      code: "missing_webhook_token",
      severity: "critical",
      message: "ASAAS_WEBHOOK_ACCESS_TOKEN ausente — webhooks podem ser rejeitados ou ficar inseguros.",
      action: "env",
    });
  }

  if (production && apiBaseUrl.includes("sandbox")) {
    issues.push({
      code: "sandbox_url_in_production",
      severity: "critical",
      message: "ASAAS_API_BASE_URL aponta para sandbox em produção.",
      action: "env",
    });
  }

  if (splitEnabled && !usesDedicatedAsaasTransferKey()) {
    issues.push({
      code: "missing_dedicated_transfer_key",
      severity: "critical",
      message:
        "WABA_FINANCEIRO_SPLIT_PAYOUT_ENABLED=true, mas ASAAS_TRANSFER_API_KEY não está definida (repasse PIX).",
      action: "env",
    });
  }

  if (splitEnabled && !isAsaasTransferConfigured()) {
    issues.push({
      code: "missing_transfer_key",
      severity: "critical",
      message: "Repasse PIX habilitado sem chave de transferência Asaas configurada.",
      action: "env",
    });
  }

  if (isAsaasConfigured()) {
    const paymentProbe = await probeAsaasPaymentApi();
    if (!paymentProbe.ok) {
      issues.push({
        code: `payment_api_${paymentProbe.code || "failed"}`,
        severity: "critical",
        message: paymentProbe.message,
        action: paymentProbe.code === "ip_forbidden" ? "asaas_panel" : "env",
      });
    }
  }

  if (splitEnabled && isAsaasTransferConfigured()) {
    const transferProbe = await probeAsaasTransferPermission();
    if (!transferProbe.ok) {
      issues.push({
        code: `transfer_${transferProbe.code || "failed"}`,
        severity: "critical",
        message: transferProbe.message,
        action:
          transferProbe.code === "insufficient_permission" || transferProbe.code === "ip_forbidden"
            ? "asaas_panel"
            : "env",
      });
    }
  }

  return {
    ok: issues.length === 0,
    checkedAt: new Date().toISOString(),
    issues,
  };
}
