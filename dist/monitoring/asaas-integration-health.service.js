"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateAsaasIntegrationHealth = evaluateAsaasIntegrationHealth;
const asaas_client_1 = require("../billing/asaas.client");
const isProductionRuntime = () => {
    const runtime = String(process.env.RUNTIME_MODE ?? "").trim().toLowerCase();
    const wabaEnv = String(process.env.WABA_ENV ?? "").trim().toLowerCase();
    if (runtime === "production")
        return true;
    if (wabaEnv === "v01")
        return true;
    if (!runtime && wabaEnv !== "v02")
        return true;
    return false;
};
const isSplitPayoutEnabled = () => {
    const raw = String(process.env.WABA_FINANCEIRO_SPLIT_PAYOUT_ENABLED ?? "true")
        .trim()
        .toLowerCase();
    return raw !== "0" && raw !== "false" && raw !== "no";
};
const resolveAsaasApiBaseUrl = () => String(process.env.ASAAS_API_BASE_URL ?? "").trim().replace(/\/$/, "");
async function evaluateAsaasIntegrationHealth() {
    const issues = [];
    const production = isProductionRuntime();
    const splitEnabled = isSplitPayoutEnabled();
    const apiBaseUrl = resolveAsaasApiBaseUrl();
    if (!(0, asaas_client_1.isAsaasConfigured)()) {
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
    if (splitEnabled && !(0, asaas_client_1.usesDedicatedAsaasTransferKey)()) {
        issues.push({
            code: "missing_dedicated_transfer_key",
            severity: "critical",
            message: "WABA_FINANCEIRO_SPLIT_PAYOUT_ENABLED=true, mas ASAAS_TRANSFER_API_KEY não está definida (repasse PIX).",
            action: "env",
        });
    }
    if (splitEnabled && !(0, asaas_client_1.isAsaasTransferConfigured)()) {
        issues.push({
            code: "missing_transfer_key",
            severity: "critical",
            message: "Repasse PIX habilitado sem chave de transferência Asaas configurada.",
            action: "env",
        });
    }
    if ((0, asaas_client_1.isAsaasConfigured)()) {
        const paymentProbe = await (0, asaas_client_1.probeAsaasPaymentApi)();
        if (!paymentProbe.ok) {
            issues.push({
                code: `payment_api_${paymentProbe.code || "failed"}`,
                severity: "critical",
                message: paymentProbe.message,
                action: paymentProbe.code === "ip_forbidden" ? "asaas_panel" : "env",
            });
        }
    }
    if (splitEnabled && (0, asaas_client_1.isAsaasTransferConfigured)()) {
        const transferProbe = await (0, asaas_client_1.probeAsaasTransferPermission)();
        if (!transferProbe.ok) {
            issues.push({
                code: `transfer_${transferProbe.code || "failed"}`,
                severity: "critical",
                message: transferProbe.message,
                action: transferProbe.code === "insufficient_permission" || transferProbe.code === "ip_forbidden"
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
