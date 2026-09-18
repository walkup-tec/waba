import type { WabaRequestAuth } from "../../../auth/waba-request-auth";
import { MetaWhatsappError } from "../meta-whatsapp-errors";
import { resolveMetaWhatsappTenant } from "../meta-whatsapp-tenant";
import {
  isPhoneInboxEnabled,
  listPhoneInboxChannels,
  readPhoneIdentity,
} from "../meta-whatsapp-phone-identity.store";
import { BOT_NODE_REGISTRY, createBotNodeData } from "./waba-bot-node.registry";
import { createDefaultBotDraft, normalizeBotDraft } from "./waba-bot-flow.normalize";
import {
  advanceBotRun,
  createBotRunState,
  executeBotNode,
  findStartNode,
} from "./waba-bot-runtime.engine";
import {
  deleteBotFlow,
  getBotIdForPhone,
  listBotFlows,
  listBotPhoneLinks,
  readBotFlow,
  setBotPhoneLink,
  upsertBotFlow,
} from "./waba-bot.store";
import type { BotFlowDraft, BotFlowNode, BotJson, BotRunState } from "./waba-bot.types";

const testRuns = new Map<string, BotRunState>();

/** Só chips com Inbox ligado em CLOUD META → Conexão. */
export function listBotAssignableChannels(tenantId: string) {
  return listPhoneInboxChannels(tenantId).filter((row) => row.inboxEnabled === true);
}

function requireTenant(auth: WabaRequestAuth) {
  try {
    return resolveMetaWhatsappTenant(auth);
  } catch {
    throw new MetaWhatsappError("unauthenticated");
  }
}

export class WabaBotService {
  getCatalog() {
    return {
      nodes: BOT_NODE_REGISTRY.map((item) => ({
        kind: item.kind,
        category: item.category,
        label: item.label,
        description: item.description,
        outputs: item.outputs,
        defaultConfig: item.defaultConfig,
      })),
    };
  }

  list(auth: WabaRequestAuth) {
    const tenant = requireTenant(auth);
    const flows = listBotFlows(tenant.tenantId);
    const links = listBotPhoneLinks(tenant.tenantId);
    const channels = listBotAssignableChannels(tenant.tenantId);
    return {
      tenantId: tenant.tenantId,
      flows,
      links,
      channels: channels.map((row) => ({
        phoneNumberId: row.phoneNumberId,
        name: row.name,
        displayPhoneNumber: row.displayPhoneNumber,
        inboxEnabled: row.inboxEnabled,
        inboxEligible: row.inboxEligible,
        botId: getBotIdForPhone(tenant.tenantId, row.phoneNumberId),
      })),
      catalog: this.getCatalog(),
    };
  }

  upsert(auth: WabaRequestAuth, body: unknown) {
    const tenant = requireTenant(auth);
    const draft = normalizeBotDraft(body);
    if (!findStartNode(draft)) throw new MetaWhatsappError("invalid_payload");
    return upsertBotFlow(tenant.tenantId, draft);
  }

  create(auth: WabaRequestAuth, name?: string) {
    const tenant = requireTenant(auth);
    return upsertBotFlow(tenant.tenantId, createDefaultBotDraft(String(name || "Novo bot").trim() || "Novo bot"));
  }

  remove(auth: WabaRequestAuth, botId: string) {
    const tenant = requireTenant(auth);
    const ok = deleteBotFlow(tenant.tenantId, botId);
    if (!ok) throw new MetaWhatsappError("conversation_not_found");
    return { ok: true };
  }

  linkPhone(auth: WabaRequestAuth, body: Record<string, unknown> | undefined) {
    const tenant = requireTenant(auth);
    const phoneNumberId = String(body?.phoneNumberId || body?.phone_number_id || "").trim();
    const botIdRaw = body?.botId ?? body?.bot_id;
    const botId = botIdRaw == null || botIdRaw === "" ? null : String(botIdRaw).trim();
    if (!phoneNumberId) throw new MetaWhatsappError("invalid_payload");
    if (botId && !isPhoneInboxEnabled(readPhoneIdentity(tenant.tenantId, phoneNumberId))) {
      throw new MetaWhatsappError("invalid_payload");
    }
    const links = setBotPhoneLink({
      tenantId: tenant.tenantId,
      phoneNumberId,
      botId,
    });
    return { ok: true, links };
  }

  async testNode(auth: WabaRequestAuth, body: Record<string, unknown> | undefined) {
    requireTenant(auth);
    const node = body?.node as BotFlowNode | undefined;
    if (!node?.data?.kind) throw new MetaWhatsappError("invalid_payload");
    return executeBotNode({
      node,
      variables:
        body?.variables && typeof body.variables === "object"
          ? (body.variables as Record<string, BotJson>)
          : {},
      dryRun: true,
      inboundText: body?.inboundText != null ? String(body.inboundText) : null,
    });
  }

  async startTest(auth: WabaRequestAuth, body: Record<string, unknown> | undefined) {
    requireTenant(auth);
    const flow = normalizeBotDraft(body?.flow);
    if (!findStartNode(flow)) throw new MetaWhatsappError("invalid_payload");
    const phone = String(body?.testPhone || body?.test_phone || "00000000000").trim();
    let run = createBotRunState({ flow, testPhone: phone });
    const advanced = await advanceBotRun({ flow, run });
    run = advanced.run;
    testRuns.set(run.id, run);
    return { ok: true, run, outboundTexts: advanced.outboundTexts };
  }

  async continueTest(auth: WabaRequestAuth, body: Record<string, unknown> | undefined) {
    requireTenant(auth);
    const runId = String(body?.runId || body?.run_id || "").trim();
    const current = testRuns.get(runId);
    if (!current) throw new MetaWhatsappError("conversation_not_found");
    const flow = normalizeBotDraft(body?.flow);
    const advanced = await advanceBotRun({
      flow,
      run: current,
      inboundText: body?.inboundText != null ? String(body.inboundText) : undefined,
    });
    testRuns.set(advanced.run.id, advanced.run);
    return { ok: true, run: advanced.run, outboundTexts: advanced.outboundTexts };
  }

  get(auth: WabaRequestAuth, botId: string): BotFlowDraft {
    const tenant = requireTenant(auth);
    const flow = readBotFlow(tenant.tenantId, botId);
    if (!flow) throw new MetaWhatsappError("conversation_not_found");
    return flow;
  }
}

export function resetWabaBotTestRunsForTests(): void {
  testRuns.clear();
}
