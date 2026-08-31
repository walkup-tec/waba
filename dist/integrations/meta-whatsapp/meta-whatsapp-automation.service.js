"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaWhatsappAutomationService = void 0;
const meta_whatsapp_tenant_1 = require("./meta-whatsapp-tenant");
const meta_whatsapp_connection_repository_1 = require("./meta-whatsapp-connection.repository");
const meta_whatsapp_errors_1 = require("./meta-whatsapp-errors");
const meta_whatsapp_automation_log_1 = require("./meta-whatsapp-automation-log");
const meta_whatsapp_automation_repository_1 = require("./meta-whatsapp-automation.repository");
const meta_whatsapp_automation_types_1 = require("./meta-whatsapp-automation.types");
const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const TZ_RE = /^[A-Za-z_]+\/[A-Za-z_+\-0-9]+$/;
function requireTenant(auth) {
    try {
        return (0, meta_whatsapp_tenant_1.resolveMetaWhatsappTenant)(auth);
    }
    catch {
        throw new meta_whatsapp_errors_1.MetaWhatsappError("unauthenticated");
    }
}
function warnIgnored(body, tenantId) {
    if (body?.tenant_id ||
        body?.tenantId ||
        body?.owner_email ||
        body?.waba_id ||
        body?.wabaId ||
        body?.access_token) {
        (0, meta_whatsapp_automation_log_1.logMetaAutomation)("ERROR", { reason: "ignored_client_claims", tenantId });
    }
}
function clampInt(raw, fallback, min, max) {
    const n = Number(raw);
    if (!Number.isFinite(n))
        return fallback;
    return Math.min(max, Math.max(min, Math.floor(n)));
}
function parseDays(raw, fallback) {
    if (!Array.isArray(raw))
        return fallback;
    const days = raw.map((item) => Number(item)).filter((item) => item >= 1 && item <= 7);
    return days.length ? Array.from(new Set(days)).sort((a, b) => a - b) : fallback;
}
function parsePayload(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
        return {};
    const json = JSON.stringify(raw);
    if (json.length > 4000)
        throw new meta_whatsapp_errors_1.MetaWhatsappError("automation_invalid");
    return JSON.parse(json);
}
class MetaWhatsappAutomationService {
    constructor(connections = new meta_whatsapp_connection_repository_1.MetaWhatsappConnectionRepository(), settings = new meta_whatsapp_automation_repository_1.MetaWhatsappAutomationSettingsRepository(), flows = new meta_whatsapp_automation_repository_1.MetaWhatsappAutomationFlowRepository(), rules = new meta_whatsapp_automation_repository_1.MetaWhatsappAutomationRuleRepository(), runs = new meta_whatsapp_automation_repository_1.MetaWhatsappAutomationRunRepository()) {
        this.connections = connections;
        this.settings = settings;
        this.flows = flows;
        this.rules = rules;
        this.runs = runs;
    }
    async requireConnected(tenantId) {
        const row = await this.connections.findConnectedByTenant(tenantId);
        if (!row || row.status !== "connected" || row.tenantId !== tenantId) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("not_connected");
        }
        return row;
    }
    async getBundle(auth) {
        const tenant = requireTenant(auth);
        const connection = await this.requireConnected(tenant.tenantId);
        const settingsRow = await this.settings.upsert({
            tenantId: tenant.tenantId,
            connectionId: connection.id,
        });
        let flow = await this.flows.findDefault(tenant.tenantId, connection.id);
        if (!flow) {
            flow = await this.flows.insert({
                tenantId: tenant.tenantId,
                connectionId: connection.id,
                name: "Padrão",
                status: "active",
                isDefault: true,
            });
        }
        const ruleRows = await this.rules.listByFlow(tenant.tenantId, flow.id);
        const runRows = await this.runs.listRecent(tenant.tenantId, connection.id, 30);
        return {
            matchPolicy: meta_whatsapp_automation_types_1.AUTOMATION_MATCH_POLICY,
            settings: (0, meta_whatsapp_automation_types_1.toPublicAutomationSettings)(settingsRow),
            flow: (0, meta_whatsapp_automation_types_1.toPublicAutomationFlow)(flow),
            rules: ruleRows.map(meta_whatsapp_automation_types_1.toPublicAutomationRule),
            runs: runRows.map(meta_whatsapp_automation_types_1.toPublicAutomationRun),
        };
    }
    async patchSettings(auth, body) {
        const tenant = requireTenant(auth);
        warnIgnored(body, tenant.tenantId);
        const connection = await this.requireConnected(tenant.tenantId);
        const current = await this.settings.upsert({ tenantId: tenant.tenantId, connectionId: connection.id });
        const timezone = String(body?.timezone ?? current.timezone).trim() || "America/Sao_Paulo";
        if (timezone !== "UTC" && !TZ_RE.test(timezone))
            throw new meta_whatsapp_errors_1.MetaWhatsappError("automation_invalid");
        const businessStart = String(body?.businessStart ?? body?.business_start ?? current.businessStart).trim();
        const businessEnd = String(body?.businessEnd ?? body?.business_end ?? current.businessEnd).trim();
        if (!TIME_RE.test(businessStart) || !TIME_RE.test(businessEnd)) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("automation_invalid");
        }
        const updated = await this.settings.upsert({
            tenantId: tenant.tenantId,
            connectionId: connection.id,
            enabled: body?.enabled == null ? current.enabled : body.enabled === true,
            timezone,
            businessDays: parseDays(body?.businessDays ?? body?.business_days, current.businessDays),
            businessStart,
            businessEnd,
            rateLimitCount: clampInt(body?.rateLimitCount ?? body?.rate_limit_count, current.rateLimitCount, 1, 100),
            rateLimitWindowSeconds: clampInt(body?.rateLimitWindowSeconds ?? body?.rate_limit_window_seconds, current.rateLimitWindowSeconds, 30, 86400),
            rateLimitTakeover: body?.rateLimitTakeover == null && body?.rate_limit_takeover == null
                ? current.rateLimitTakeover
                : body?.rateLimitTakeover === true || body?.rate_limit_takeover === true,
        });
        return (0, meta_whatsapp_automation_types_1.toPublicAutomationSettings)(updated);
    }
    async patchFlow(auth, flowId, body) {
        const tenant = requireTenant(auth);
        warnIgnored(body, tenant.tenantId);
        await this.requireConnected(tenant.tenantId);
        const existing = await this.flows.findByIdForTenant(tenant.tenantId, String(flowId || "").trim());
        if (!existing)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("automation_not_found");
        const name = String(body?.name ?? existing.name).trim().slice(0, 80) || existing.name;
        const statusRaw = String(body?.status ?? existing.status).trim();
        const status = statusRaw === "inactive" ? "inactive" : "active";
        const updated = await this.flows.update(tenant.tenantId, existing.id, { name, status });
        if (!updated)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("automation_not_found");
        return (0, meta_whatsapp_automation_types_1.toPublicAutomationFlow)(updated);
    }
    async createRule(auth, body) {
        const tenant = requireTenant(auth);
        warnIgnored(body, tenant.tenantId);
        const connection = await this.requireConnected(tenant.tenantId);
        const flowId = String(body?.flowId || body?.flow_id || "").trim();
        const flow = flowId
            ? await this.flows.findByIdForTenant(tenant.tenantId, flowId)
            : await this.flows.findDefault(tenant.tenantId, connection.id);
        if (!flow || flow.tenantId !== tenant.tenantId)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("automation_not_found");
        const parsed = this.parseRuleBody(body, {
            priority: 100,
            triggerType: "ANY_INBOUND",
            triggerValue: null,
            actionType: "SEND_TEXT",
            actionPayload: {},
            active: true,
        });
        this.assertActionPayload(parsed.actionType, parsed.actionPayload);
        const created = await this.rules.insert({
            tenantId: tenant.tenantId,
            flowId: flow.id,
            ...parsed,
        });
        return (0, meta_whatsapp_automation_types_1.toPublicAutomationRule)(created);
    }
    async patchRule(auth, ruleId, body) {
        const tenant = requireTenant(auth);
        warnIgnored(body, tenant.tenantId);
        await this.requireConnected(tenant.tenantId);
        const existing = await this.rules.findByIdForTenant(tenant.tenantId, String(ruleId || "").trim());
        if (!existing)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("automation_not_found");
        const parsed = this.parseRuleBody(body, existing);
        this.assertActionPayload(parsed.actionType, parsed.actionPayload);
        const updated = await this.rules.update(tenant.tenantId, existing.id, parsed);
        if (!updated)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("automation_not_found");
        return (0, meta_whatsapp_automation_types_1.toPublicAutomationRule)(updated);
    }
    async deleteRule(auth, ruleId) {
        const tenant = requireTenant(auth);
        await this.requireConnected(tenant.tenantId);
        const ok = await this.rules.delete(tenant.tenantId, String(ruleId || "").trim());
        if (!ok)
            throw new meta_whatsapp_errors_1.MetaWhatsappError("automation_not_found");
        return { deleted: true };
    }
    parseRuleBody(body, fallback) {
        const triggerType = String(body?.triggerType || body?.trigger_type || fallback.triggerType).trim();
        const actionType = String(body?.actionType || body?.action_type || fallback.actionType).trim();
        if (!(0, meta_whatsapp_automation_types_1.isAutomationTriggerType)(triggerType) || !(0, meta_whatsapp_automation_types_1.isAutomationActionType)(actionType)) {
            throw new meta_whatsapp_errors_1.MetaWhatsappError("automation_invalid");
        }
        const triggerValueRaw = body?.triggerValue ?? body?.trigger_value;
        const triggerValue = triggerValueRaw == null
            ? fallback.triggerValue
            : String(triggerValueRaw).trim().slice(0, 200) || null;
        return {
            priority: clampInt(body?.priority, fallback.priority, 1, 10000),
            triggerType,
            triggerValue,
            actionType,
            actionPayload: body?.actionPayload != null || body?.action_payload != null
                ? parsePayload(body?.actionPayload ?? body?.action_payload)
                : fallback.actionPayload,
            active: body?.active == null ? fallback.active : body.active !== false,
        };
    }
    assertActionPayload(actionType, payload) {
        if (actionType === "SEND_TEXT") {
            const text = String(payload.text || payload.message || "").trim();
            if (!text)
                throw new meta_whatsapp_errors_1.MetaWhatsappError("automation_invalid");
        }
        if (actionType === "SEND_TEMPLATE") {
            const nested = payload.template && typeof payload.template === "object"
                ? payload.template
                : payload;
            const name = String(nested.name || payload.templateName || "").trim();
            const language = String(nested.language || payload.templateLanguage || "").trim();
            if (!name || !language)
                throw new meta_whatsapp_errors_1.MetaWhatsappError("automation_invalid");
        }
        if (actionType === "SET_STATUS") {
            const status = String(payload.status || "").trim();
            if (status !== "open" && status !== "pending" && status !== "closed") {
                throw new meta_whatsapp_errors_1.MetaWhatsappError("automation_invalid");
            }
        }
    }
}
exports.MetaWhatsappAutomationService = MetaWhatsappAutomationService;
