/**
 * Fluxos de bot do Inbox Cloud META (adaptado do Soma).
 * Inbound inicia/continua o fluxo. Sem tokens nos logs.
 */

export type BotNodeCategory = "chatbot" | "sistema";
export type BotExecutionKind = "flow" | "system";

export type BotNodeKind =
  | "start"
  | "end"
  | "wait_reply"
  | "delay"
  | "condition"
  | "switch"
  | "loop"
  | "message"
  | "media"
  | "link"
  | "buttons"
  | "list"
  | "menu"
  | "expediente"
  | "transfer_agent";

export type BotMediaKind = "video" | "pdf" | "audio";

export type BotPortDef = {
  id: string;
  label: string;
};

export type BotNodeStatus =
  | "idle"
  | "ready"
  | "running"
  | "waiting"
  | "success"
  | "error"
  | "skipped";

export type BotJson =
  | string
  | number
  | boolean
  | null
  | BotJson[]
  | { [key: string]: BotJson };

export type BotNodeLogEntry = {
  at: string;
  level: "info" | "warn" | "error";
  message: string;
  data?: Record<string, BotJson>;
};

export type BotNodeConfig = {
  label?: string;
  description?: string;
  text?: string;
  timeoutSeconds?: number;
  delaySeconds?: number;
  expression?: string;
  cases?: Array<{ id: string; label: string; value: string }>;
  maxIterations?: number;
  options?: Array<{ id: string; label: string; value?: string }>;
  outputVariable?: string;
  mediaKind?: BotMediaKind;
  mediaUrl?: string;
  mediaCaption?: string;
  mediaFileName?: string;
  mediaMime?: string;
  mediaRef?: string;
  voiceNote?: boolean;
  buttonLabel?: string;
  url?: string;
};

export type BotNodeData = {
  kind: BotNodeKind;
  category: BotNodeCategory;
  executionKind: BotExecutionKind;
  title: string;
  config: BotNodeConfig;
  variables: Record<string, BotJson>;
  logs: BotNodeLogEntry[];
  status: BotNodeStatus;
};

export type BotFlowNode = {
  id: string;
  type: "botStep";
  position: { x: number; y: number };
  deletable?: boolean;
  data: BotNodeData;
};

export type BotFlowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
};

export type BotFlowDraft = {
  id: string;
  name: string;
  updatedAt: string;
  nodes: BotFlowNode[];
  edges: BotFlowEdge[];
};

export type BotRunPhase =
  | "idle"
  | "starting"
  | "running"
  | "waiting_reply"
  | "finished"
  | "error";

export type BotRunState = {
  id: string;
  flowId: string;
  flowName: string;
  testPhone: string;
  phase: BotRunPhase;
  currentNodeId: string | null;
  variables: Record<string, BotJson>;
  logs: BotNodeLogEntry[];
  startedAt: string;
  updatedAt: string;
  error?: string;
};

export type BotNodeExecuteContext = {
  node: BotFlowNode;
  variables: Record<string, BotJson>;
  testPhone?: string;
  dryRun?: boolean;
  inboundText?: string | null;
  conversationId?: string;
  phone?: string;
};

export type BotOutboundInteractive = {
  kind: "buttons" | "list";
  text: string;
  options: Array<{ id: string; label: string; value?: string }>;
};

export type BotOutboundMedia = {
  mediaKind: BotMediaKind;
  mediaUrl?: string;
  mediaRef?: string;
  mediaMime?: string;
  mediaFileName?: string;
  caption?: string;
  voiceNote?: boolean;
};

export type BotOutboundCtaUrl = {
  text: string;
  buttonLabel: string;
  url: string;
};

export type BotNodeExecuteResult = {
  ok: boolean;
  status: BotNodeStatus;
  message: string;
  nextHandle?: string;
  variables?: Record<string, BotJson>;
  outboundText?: string;
  outboundInteractive?: BotOutboundInteractive;
  outboundMedia?: BotOutboundMedia;
  outboundCtaUrl?: BotOutboundCtaUrl;
  waitForReply?: boolean;
  transferHuman?: boolean;
  data?: Record<string, BotJson>;
};

export type BotOutboundPayload =
  | { type: "text"; text: string }
  | { type: "interactive"; interactive: BotOutboundInteractive }
  | { type: "media"; media: BotOutboundMedia }
  | { type: "cta_url"; cta: BotOutboundCtaUrl };

export type BotPhoneLink = {
  tenantId: string;
  phoneNumberId: string;
  botId: string;
  updatedAt: string;
};

export type BotHandledClaim = {
  tenantId: string;
  messageId: string;
  conversationId: string;
  botId: string;
  handled: boolean;
  at: string;
};
