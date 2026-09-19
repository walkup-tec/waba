"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTemplate = resolveTemplate;
exports.evalSimpleCondition = evalSimpleCondition;
exports.matchMenuOption = matchMenuOption;
exports.executeBotNode = executeBotNode;
exports.findStartNode = findStartNode;
exports.findNextNode = findNextNode;
exports.createBotRunState = createBotRunState;
exports.advanceBotRun = advanceBotRun;
const waba_bot_node_registry_1 = require("./waba-bot-node.registry");
const waba_bot_expediente_1 = require("./waba-bot-expediente");
const waba_bot_flow_normalize_1 = require("./waba-bot-flow.normalize");
const waba_bot_cloud_payload_1 = require("./waba-bot-cloud-payload");
function nowIso() {
    return new Date().toISOString();
}
function log(level, message, data) {
    return { at: nowIso(), level, message, data };
}
function resolveTemplate(template, variables) {
    return String(template || "").replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, rawPath) => {
        const path = rawPath.trim().split(".");
        let current = variables;
        for (const key of path) {
            if (current && typeof current === "object" && !Array.isArray(current) && key in current) {
                current = current[key];
            }
            else {
                return "";
            }
        }
        if (current == null)
            return "";
        if (typeof current === "object")
            return JSON.stringify(current);
        return String(current);
    });
}
function evalSimpleCondition(expression, variables) {
    const resolved = resolveTemplate(expression, variables).trim().toLowerCase();
    if (!resolved)
        return false;
    if (resolved.includes(" contém ")) {
        const [left, right] = resolved.split(" contém ").map((part) => part.trim());
        return left.includes(right);
    }
    if (resolved.includes("==")) {
        const [left, right] = resolved.split("==").map((part) => part.trim().replace(/^["']|["']$/g, ""));
        return left === right;
    }
    return ["1", "true", "sim", "yes", "ok"].includes(resolved);
}
function matchMenuOption(replyRaw, options) {
    const normalized = String(replyRaw || "").trim().toLowerCase();
    if (!normalized)
        return undefined;
    const byText = options.find((opt) => {
        const label = String(opt.label || "").trim().toLowerCase();
        const value = String(opt.value || "").trim().toLowerCase();
        const id = String(opt.id || "").trim().toLowerCase();
        return normalized === label || normalized === value || normalized === id;
    });
    if (byText)
        return byText;
    const asNumber = Number.parseInt(normalized.replace(/[^\d]/g, ""), 10);
    if (!Number.isFinite(asNumber) || asNumber < 1 || asNumber > options.length)
        return undefined;
    return options[asNumber - 1];
}
async function executeBotNode(ctx) {
    const { node, variables, dryRun, inboundText } = ctx;
    const { kind, config } = node.data;
    const definition = (0, waba_bot_node_registry_1.getBotNodeDefinition)(kind);
    try {
        switch (kind) {
            case "start":
                return { ok: true, status: "success", message: "Fluxo iniciado", nextHandle: "out" };
            case "end":
                return { ok: true, status: "success", message: "Fluxo finalizado" };
            case "message": {
                const text = resolveTemplate(config.text || definition?.label || "", variables);
                return {
                    ok: true,
                    status: "success",
                    message: dryRun ? `Simulado: ${text}` : "Mensagem preparada",
                    nextHandle: "out",
                    outboundText: text,
                };
            }
            case "media": {
                const mediaKind = config.mediaKind === "pdf" || config.mediaKind === "audio" ? config.mediaKind : "video";
                const mediaUrl = resolveTemplate(config.mediaUrl || "", variables).trim();
                const mediaRef = String(config.mediaRef || "").trim();
                if (!mediaUrl && !mediaRef) {
                    return { ok: false, status: "error", message: "Mídia sem arquivo nem URL https" };
                }
                const caption = resolveTemplate(config.mediaCaption || "", variables).trim();
                return {
                    ok: true,
                    status: "success",
                    message: dryRun ? `Simulado: mídia ${mediaKind}` : `Mídia ${mediaKind} preparada`,
                    nextHandle: "out",
                    outboundMedia: {
                        mediaKind,
                        mediaUrl: mediaUrl || undefined,
                        mediaRef: mediaRef || undefined,
                        mediaMime: config.mediaMime || undefined,
                        mediaFileName: config.mediaFileName || undefined,
                        caption: caption || undefined,
                        voiceNote: mediaKind === "audio" ? config.voiceNote !== false : false,
                    },
                };
            }
            case "link": {
                const text = resolveTemplate(config.text || "Toque no botão para abrir o link.", variables).trim();
                const buttonLabel = (0, waba_bot_cloud_payload_1.normalizeBotButtonLabel)(resolveTemplate(config.buttonLabel || "Abrir link", variables));
                const url = (0, waba_bot_cloud_payload_1.normalizeBotHttpsUrl)(resolveTemplate(config.url || "", variables));
                if (!buttonLabel || !url) {
                    return { ok: false, status: "error", message: "Link exige rótulo e URL https" };
                }
                return {
                    ok: true,
                    status: "success",
                    message: dryRun ? `Simulado: ${buttonLabel}` : "Botão de link preparado",
                    nextHandle: "out",
                    outboundCtaUrl: { text: text || buttonLabel, buttonLabel, url },
                };
            }
            case "buttons":
            case "list":
            case "menu": {
                const text = resolveTemplate(config.text || definition?.label || "", variables);
                const options = (config.options || []).filter((opt) => String(opt.label || "").trim());
                const optionsPayload = options.map((opt) => ({
                    id: opt.id,
                    label: opt.label,
                    value: opt.value || opt.label,
                }));
                const numbered = (0, waba_bot_flow_normalize_1.formatNumberedMenu)(text, options);
                const replyRaw = inboundText != null && String(inboundText).trim() !== ""
                    ? String(inboundText).trim()
                    : null;
                if (!replyRaw) {
                    return {
                        ok: true,
                        status: dryRun ? "success" : "waiting",
                        message: dryRun
                            ? `Simulado: ${text} (${options.length} opções)`
                            : "Aguardando escolha do contato",
                        waitForReply: !dryRun,
                        nextHandle: dryRun ? options[0]?.id || "out" : undefined,
                        outboundText: numbered,
                        data: { options: optionsPayload },
                    };
                }
                const match = matchMenuOption(replyRaw, options);
                if (!match && kind !== "menu") {
                    return {
                        ok: true,
                        status: "waiting",
                        message: `Resposta "${replyRaw}" não corresponde a uma opção — continua aguardando`,
                        waitForReply: true,
                        outboundText: `${numbered}\n\nPor favor, escolha uma das opções.`,
                        data: { options: optionsPayload, chosen: null },
                    };
                }
                return {
                    ok: true,
                    status: "success",
                    message: match
                        ? `Opção escolhida: ${match.label}`
                        : `Sem match — Fallback (${replyRaw})`,
                    nextHandle: match?.id || "out",
                    variables: {
                        [config.outputVariable || "opcao_escolhida"]: match?.value || match?.label || replyRaw,
                        ultima_resposta: replyRaw,
                    },
                    data: { options: optionsPayload, chosen: match?.id || null },
                };
            }
            case "delay": {
                const seconds = Math.max(0, Math.min(3, Number(config.delaySeconds) || 0));
                if (!dryRun && seconds > 0) {
                    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
                }
                return { ok: true, status: "success", message: `Delay ${seconds}s`, nextHandle: "out" };
            }
            case "wait_reply": {
                const outKey = String(config.outputVariable || "ultima_resposta").trim() || "ultima_resposta";
                const reply = inboundText != null && String(inboundText).trim() !== ""
                    ? String(inboundText).trim()
                    : null;
                if (!reply) {
                    return {
                        ok: true,
                        status: "waiting",
                        message: "Aguardando resposta do contato",
                        waitForReply: true,
                    };
                }
                return {
                    ok: true,
                    status: "success",
                    message: `Resposta salva em {{${outKey}}}`,
                    nextHandle: "out",
                    variables: { [outKey]: reply, ultima_resposta: reply },
                };
            }
            case "condition": {
                const ok = evalSimpleCondition(config.expression || "", variables);
                return {
                    ok: true,
                    status: "success",
                    message: ok ? "Condição verdadeira" : "Condição falsa",
                    nextHandle: ok ? "true" : "false",
                };
            }
            case "expediente": {
                const turno = (0, waba_bot_expediente_1.resolveBrasiliaExpedienteTurno)();
                const outKey = config.outputVariable || "turno";
                return {
                    ok: true,
                    status: "success",
                    message: `Expediente Brasília ${turno.timeLabel}: ${turno.label}`,
                    nextHandle: turno.handle,
                    variables: {
                        [outKey]: turno.id,
                        saudacao_turno: turno.label,
                        expediente_horario: turno.timeLabel,
                    },
                    data: { turno: turno.id, label: turno.label, horario: turno.timeLabel },
                };
            }
            case "switch": {
                const value = resolveTemplate(config.expression || "{{ultima_resposta}}", variables)
                    .trim()
                    .toLowerCase();
                const match = (config.cases || []).find((item) => String(item.value || "").trim().toLowerCase() === value);
                return {
                    ok: true,
                    status: "success",
                    message: match ? `Caso ${match.label}` : "Caso padrão",
                    nextHandle: match?.id || "default",
                };
            }
            case "loop": {
                const key = config.outputVariable || "loop_index";
                const current = Number(variables[key] || 0);
                const max = Math.max(1, Number(config.maxIterations) || 1);
                if (current >= max) {
                    return {
                        ok: true,
                        status: "success",
                        message: "Loop concluído",
                        nextHandle: "done",
                        variables: { [key]: current },
                    };
                }
                return {
                    ok: true,
                    status: "success",
                    message: `Loop iteração ${current + 1}/${max}`,
                    nextHandle: "body",
                    variables: { [key]: current + 1 },
                };
            }
            case "transfer_agent":
                return {
                    ok: true,
                    status: "success",
                    message: "Atendimento transferido para humano",
                    nextHandle: "out",
                    transferHuman: true,
                };
            default:
                return { ok: false, status: "error", message: `Handler não implementado: ${kind}` };
        }
    }
    catch (error) {
        return {
            ok: false,
            status: "error",
            message: error instanceof Error ? error.message : "Falha ao executar node",
        };
    }
}
function findStartNode(draft) {
    return draft.nodes.find((node) => node.data.kind === "start") || null;
}
function findNextNode(draft, sourceId, handle = "out") {
    const edge = draft.edges.find((item) => item.source === sourceId && (item.sourceHandle || "out") === handle) ||
        draft.edges.find((item) => item.source === sourceId && !item.sourceHandle);
    if (!edge)
        return null;
    return draft.nodes.find((node) => node.id === edge.target) || null;
}
function createBotRunState(input) {
    const start = findStartNode(input.flow);
    return {
        id: `run-${crypto.randomUUID().slice(0, 8)}`,
        flowId: input.flow.id,
        flowName: input.flow.name,
        testPhone: input.testPhone,
        phase: "starting",
        currentNodeId: start?.id || null,
        variables: { telefone_teste: input.testPhone },
        logs: [log("info", `Execução iniciada para ${input.testPhone}`)],
        startedAt: nowIso(),
        updatedAt: nowIso(),
    };
}
async function advanceBotRun(input) {
    const outboundTexts = [];
    const outbound = [];
    let transferHuman = false;
    let run = {
        ...input.run,
        updatedAt: nowIso(),
        variables: { ...input.run.variables },
        logs: [...input.run.logs],
    };
    if (input.inboundText != null) {
        run.variables.ultima_resposta = input.inboundText;
        run.logs.push(log("info", "Resposta recebida"));
        run.phase = "running";
    }
    let guard = 0;
    while (guard < 40) {
        guard += 1;
        const nodeId = run.currentNodeId;
        if (!nodeId) {
            run.phase = "finished";
            run.logs.push(log("info", "Sem node atual — fluxo encerrado"));
            break;
        }
        const node = input.flow.nodes.find((item) => item.id === nodeId);
        if (!node) {
            run.phase = "error";
            run.error = "Node atual não encontrado";
            break;
        }
        run.phase = "running";
        const result = await executeBotNode({
            node,
            variables: run.variables,
            testPhone: run.testPhone,
            dryRun: false,
            inboundText: input.inboundText,
            conversationId: input.conversationId,
            phone: input.phone || run.testPhone,
        });
        run.logs.push(log(result.ok ? "info" : "error", `[${node.data.title}] ${result.message}`, result.data));
        if (result.variables)
            run.variables = { ...run.variables, ...result.variables };
        if (result.outboundInteractive) {
            outbound.push({ type: "interactive", interactive: result.outboundInteractive });
            outboundTexts.push(result.outboundInteractive.text);
        }
        else if (result.outboundMedia) {
            outbound.push({ type: "media", media: result.outboundMedia });
            outboundTexts.push(result.outboundMedia.caption || `[${result.outboundMedia.mediaKind}]`);
        }
        else if (result.outboundCtaUrl) {
            outbound.push({ type: "cta_url", cta: result.outboundCtaUrl });
            outboundTexts.push(result.outboundCtaUrl.text);
        }
        else if (result.outboundText) {
            outbound.push({ type: "text", text: result.outboundText });
            outboundTexts.push(result.outboundText);
        }
        if (result.transferHuman)
            transferHuman = true;
        if (!result.ok) {
            run.phase = "error";
            run.error = result.message;
            break;
        }
        if (result.waitForReply && (!result.nextHandle || input.inboundText == null)) {
            run.phase = "waiting_reply";
            break;
        }
        if (node.data.kind === "end" || !result.nextHandle) {
            run.phase = "finished";
            run.currentNodeId = nodeId;
            break;
        }
        let next = findNextNode(input.flow, nodeId, result.nextHandle);
        if (!next &&
            result.nextHandle &&
            result.nextHandle !== "out" &&
            (node.data.kind === "buttons" || node.data.kind === "list" || node.data.kind === "menu")) {
            next = findNextNode(input.flow, nodeId, "out");
            if (next) {
                run.logs.push(log("warn", `Saída "${result.nextHandle}" sem conexão — usando Fallback (out)`));
            }
        }
        if (!next) {
            run.phase = "finished";
            run.logs.push(log("warn", `Sem conexão na saída "${result.nextHandle}"`));
            break;
        }
        run.currentNodeId = next.id;
        const clearsInbound = node.data.kind === "wait_reply" ||
            node.data.kind === "buttons" ||
            node.data.kind === "list" ||
            node.data.kind === "menu";
        if (clearsInbound && input.inboundText != null) {
            input = { ...input, inboundText: undefined };
        }
    }
    run.updatedAt = nowIso();
    return { run, outboundTexts, outbound, transferHuman };
}
