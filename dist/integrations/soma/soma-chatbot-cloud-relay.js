"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.relaySomaChatbotCloudWebhook = relaySomaChatbotCloudWebhook;
exports.registerSomaChatbotCloudRelayRoutes = registerSomaChatbotCloudRelayRoutes;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const FILE = (0, node_path_1.join)(process.cwd(), "data", "soma-chatbot-cloud-numbers.json");
function expectedKey() {
    return String(process.env.SOMA_WABA_INTEGRATION_KEY || "").trim();
}
function authorized(req) {
    const expected = expectedKey();
    const provided = String(req.headers["x-soma-waba-key"] || "").trim();
    return Boolean(expected && provided && provided === expected);
}
async function readRegistry() {
    try {
        const raw = await (0, promises_1.readFile)(FILE, "utf8");
        const parsed = JSON.parse(raw);
        return {
            webhookUrl: parsed.webhookUrl || null,
            numbers: parsed.numbers && typeof parsed.numbers === "object" ? parsed.numbers : {},
        };
    }
    catch {
        return { webhookUrl: null, numbers: {} };
    }
}
async function writeRegistry(registry) {
    await (0, promises_1.mkdir)((0, node_path_1.join)(process.cwd(), "data"), { recursive: true });
    await (0, promises_1.writeFile)(FILE, JSON.stringify(registry, null, 2));
}
function collectPhoneNumberIds(payload) {
    const ids = new Set();
    const root = payload && typeof payload === "object" ? payload : {};
    const entries = Array.isArray(root.entry) ? root.entry : [];
    for (const entry of entries) {
        const changes = Array.isArray(entry?.changes)
            ? (entry.changes)
            : [];
        for (const change of changes) {
            const value = change?.value;
            const id = String(value?.metadata?.phone_number_id || "").trim();
            if (id)
                ids.add(id);
        }
    }
    return [...ids];
}
async function relaySomaChatbotCloudWebhook(payload) {
    const registry = await readRegistry();
    const envUrl = String(process.env.SOMA_CHAT_CLOUD_WEBHOOK_URL || "").trim().replace(/\/+$/, "");
    const webhookUrl = envUrl || registry.webhookUrl;
    if (!webhookUrl)
        return;
    const key = expectedKey();
    if (!key)
        return;
    const ids = collectPhoneNumberIds(payload);
    const match = ids.some((id) => Boolean(registry.numbers[id]));
    if (!match)
        return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
        await fetch(webhookUrl, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "X-Soma-Waba-Key": key,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
    }
    catch (error) {
        console.error("[soma-cloud-relay] falha ao reenviar webhook", error);
    }
    finally {
        clearTimeout(timeout);
    }
}
function registerSomaChatbotCloudRelayRoutes(app) {
    app.post("/integrations/soma/chatbot-cloud-numbers", async (req, res) => {
        try {
            if (!expectedKey()) {
                return res.status(503).json({
                    ok: false,
                    error: "SOMA_WABA_INTEGRATION_KEY não configurada no WABA.",
                });
            }
            if (!authorized(req)) {
                return res.status(401).json({ ok: false, error: "Não autorizado." });
            }
            const body = req.body && typeof req.body === "object" ? req.body : {};
            const action = String(body.action || "register").trim().toLowerCase();
            const phoneNumberId = String(body.phoneNumberId || body.phone_number_id || "").trim();
            if (!phoneNumberId) {
                return res.status(400).json({ ok: false, error: "phoneNumberId obrigatório." });
            }
            const registry = await readRegistry();
            const webhookUrl = String(body.webhookUrl || body.webhook_url || "").trim().replace(/\/+$/, "");
            if (webhookUrl)
                registry.webhookUrl = webhookUrl;
            if (action === "unregister") {
                delete registry.numbers[phoneNumberId];
            }
            else {
                registry.numbers[phoneNumberId] = {
                    phoneNumberId,
                    wabaId: String(body.wabaId || "").trim() || undefined,
                    displayPhone: String(body.displayPhone || "").trim() || undefined,
                    label: String(body.label || "").trim() || undefined,
                    updatedAt: new Date().toISOString(),
                };
            }
            await writeRegistry(registry);
            return res.status(200).json({ ok: true, total: Object.keys(registry.numbers).length });
        }
        catch (error) {
            console.error("POST /integrations/soma/chatbot-cloud-numbers", error);
            return res.status(500).json({ ok: false, error: "Falha ao registrar número Cloud do Soma." });
        }
    });
}
