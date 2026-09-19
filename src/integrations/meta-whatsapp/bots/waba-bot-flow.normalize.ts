import { createBotNodeData, getBotNodeDefinition } from "./waba-bot-node.registry";
import type {
  BotFlowDraft,
  BotFlowEdge,
  BotFlowNode,
  BotJson,
  BotNodeData,
  BotNodeKind,
} from "./waba-bot.types";

function randomId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function createDefaultBotDraft(name = "Novo bot"): BotFlowDraft {
  const startId = "bot-start";
  const start: BotFlowNode = {
    id: startId,
    type: "botStep",
    position: { x: 80, y: 180 },
    deletable: false,
    data: createBotNodeData("start"),
  };
  return {
    id: randomId("bot"),
    name,
    updatedAt: new Date().toISOString(),
    nodes: [start],
    edges: [],
  };
}

export function ensureBotHasStart(draft: BotFlowDraft): BotFlowDraft {
  const hasStart = draft.nodes.some((node) => node.data?.kind === "start");
  if (hasStart) return draft;
  const start: BotFlowNode = {
    id: "bot-start",
    type: "botStep",
    position: { x: 80, y: 180 },
    deletable: false,
    data: createBotNodeData("start"),
  };
  return { ...draft, nodes: [start, ...draft.nodes] };
}

const KINDS = new Set<BotNodeKind>([
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

export function normalizeBotDraft(raw: unknown): BotFlowDraft {
  const input = (raw && typeof raw === "object" ? raw : {}) as Partial<BotFlowDraft>;
  const nodes: BotFlowNode[] = Array.isArray(input.nodes)
    ? input.nodes.map((node, index) => {
        const rawKind = String((node?.data as BotNodeData | undefined)?.kind || "message");
        const kind = (KINDS.has(rawKind as BotNodeKind) ? rawKind : "message") as BotNodeKind;
        const definition = getBotNodeDefinition(kind);
        const data = (node?.data as BotNodeData | undefined) || createBotNodeData("message");
        return {
          id: String(node?.id || `node-${index}`),
          type: "botStep" as const,
          position: {
            x: Number(node?.position?.x) || 0,
            y: Number(node?.position?.y) || 0,
          },
          deletable: node?.deletable ?? kind !== "start",
          data: {
            ...createBotNodeData(definition?.kind || "message"),
            ...data,
            kind: definition?.kind || "message",
            category: definition?.category || data.category || "chatbot",
            executionKind: definition?.executionKind || data.executionKind || "flow",
            title: data.title || definition?.label || "Node",
            config: { ...(definition?.defaultConfig || {}), ...(data.config || {}) },
            variables:
              data.variables && typeof data.variables === "object"
                ? (data.variables as Record<string, BotJson>)
                : {},
            logs: Array.isArray(data.logs) ? data.logs : [],
            status: data.status || "idle",
          },
        };
      })
    : [];

  const edges: BotFlowEdge[] = Array.isArray(input.edges)
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

export function formatNumberedMenu(text: string, options: Array<{ label: string }>): string {
  const body = String(text || "").trim();
  const lines = options
    .map((opt, index) => `${index + 1}. ${String(opt.label || "").trim()}`)
    .filter((line) => !line.endsWith(". "));
  if (!lines.length) return body;
  return body ? `${body}\n\n${lines.join("\n")}` : lines.join("\n");
}
