"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDefaultBotDraft = createDefaultBotDraft;
exports.ensureBotHasStart = ensureBotHasStart;
exports.normalizeBotDraft = normalizeBotDraft;
exports.formatNumberedMenu = formatNumberedMenu;
const waba_bot_node_registry_1 = require("./waba-bot-node.registry");
function randomId(prefix) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}
function createDefaultBotDraft(name = "Novo bot") {
    const startId = "bot-start";
    const start = {
        id: startId,
        type: "botStep",
        position: { x: 80, y: 180 },
        deletable: false,
        data: (0, waba_bot_node_registry_1.createBotNodeData)("start"),
    };
    return {
        id: randomId("bot"),
        name,
        updatedAt: new Date().toISOString(),
        nodes: [start],
        edges: [],
    };
}
function ensureBotHasStart(draft) {
    const hasStart = draft.nodes.some((node) => node.data?.kind === "start");
    if (hasStart)
        return draft;
    const start = {
        id: "bot-start",
        type: "botStep",
        position: { x: 80, y: 180 },
        deletable: false,
        data: (0, waba_bot_node_registry_1.createBotNodeData)("start"),
    };
    return { ...draft, nodes: [start, ...draft.nodes] };
}
const KINDS = new Set([
    "start",
    "end",
    "wait_reply",
    "delay",
    "condition",
    "switch",
    "loop",
    "message",
    "media",
    "link",
    "buttons",
    "list",
    "menu",
    "expediente",
    "transfer_agent",
]);
function normalizeBotDraft(raw) {
    const input = (raw && typeof raw === "object" ? raw : {});
    const nodes = Array.isArray(input.nodes)
        ? input.nodes.map((node, index) => {
            const rawKind = String(node?.data?.kind || "message");
            const kind = (KINDS.has(rawKind) ? rawKind : "message");
            const definition = (0, waba_bot_node_registry_1.getBotNodeDefinition)(kind);
            const data = node?.data || (0, waba_bot_node_registry_1.createBotNodeData)("message");
            return {
                id: String(node?.id || `node-${index}`),
                type: "botStep",
                position: {
                    x: Number(node?.position?.x) || 0,
                    y: Number(node?.position?.y) || 0,
                },
                deletable: node?.deletable ?? kind !== "start",
                data: {
                    ...(0, waba_bot_node_registry_1.createBotNodeData)(definition?.kind || "message"),
                    ...data,
                    kind: definition?.kind || "message",
                    category: definition?.category || data.category || "chatbot",
                    executionKind: definition?.executionKind || data.executionKind || "flow",
                    title: data.title || definition?.label || "Node",
                    config: { ...(definition?.defaultConfig || {}), ...(data.config || {}) },
                    variables: data.variables && typeof data.variables === "object"
                        ? data.variables
                        : {},
                    logs: Array.isArray(data.logs) ? data.logs : [],
                    status: data.status || "idle",
                },
            };
        })
        : [];
    const edges = Array.isArray(input.edges)
        ? input.edges.map((edge, index) => ({
            id: String(edge?.id || `e-${index}`),
            source: String(edge?.source || ""),
            target: String(edge?.target || ""),
            sourceHandle: edge?.sourceHandle ?? null,
            targetHandle: edge?.targetHandle ?? null,
            label: typeof edge?.label === "string" ? edge.label : undefined,
        }))
        : [];
    return ensureBotHasStart({
        id: String(input.id || randomId("bot")),
        name: String(input.name || "Bot sem nome").trim() || "Bot sem nome",
        updatedAt: String(input.updatedAt || new Date().toISOString()),
        nodes,
        edges,
    });
}
function formatNumberedMenu(text, options) {
    const body = String(text || "").trim();
    const lines = options
        .map((opt, index) => `${index + 1}. ${String(opt.label || "").trim()}`)
        .filter((line) => !line.endsWith(". "));
    if (!lines.length)
        return body;
    return body ? `${body}\n\n${lines.join("\n")}` : lines.join("\n");
}
