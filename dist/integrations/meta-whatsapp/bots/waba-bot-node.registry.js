"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOT_CATEGORY_META = exports.BOT_NODE_REGISTRY = void 0;
exports.getBotNodeDefinition = getBotNodeDefinition;
exports.listBotNodesByCategory = listBotNodesByCategory;
exports.createBotNodeData = createBotNodeData;
exports.resolveBotNodeOutputs = resolveBotNodeOutputs;
const IN = [{ id: "in", label: "Entrada" }];
const OUT = [{ id: "out", label: "Saída" }];
const NONE_IN = [];
const NONE_OUT = [];
function def(partial) {
    return {
        inputs: partial.inputs ?? IN,
        outputs: partial.outputs ?? OUT,
        defaultConfig: partial.defaultConfig ?? {},
        ...partial,
    };
}
exports.BOT_NODE_REGISTRY = [
    def({
        kind: "start",
        category: "chatbot",
        executionKind: "flow",
        label: "Início",
        description: "Ponto de entrada do fluxo",
        inputs: NONE_IN,
        defaultConfig: { label: "Início" },
    }),
    def({
        kind: "end",
        category: "chatbot",
        executionKind: "flow",
        label: "Fim",
        description: "Encerra o atendimento neste ramo",
        outputs: NONE_OUT,
        defaultConfig: { label: "Fim" },
    }),
    def({
        kind: "wait_reply",
        category: "chatbot",
        executionKind: "flow",
        label: "Esperar resposta",
        description: "Aguarda mensagem do contato",
        defaultConfig: { timeoutSeconds: 300, outputVariable: "ultima_resposta" },
    }),
    def({
        kind: "delay",
        category: "chatbot",
        executionKind: "flow",
        label: "Delay",
        description: "Aguarda um intervalo antes de seguir",
        defaultConfig: { delaySeconds: 1 },
    }),
    def({
        kind: "condition",
        category: "chatbot",
        executionKind: "flow",
        label: "Condição",
        description: "Bifurca em verdadeiro / falso",
        outputs: [
            { id: "true", label: "Sim" },
            { id: "false", label: "Não" },
        ],
        defaultConfig: { expression: "{{ultima_resposta}} contém sim" },
    }),
    def({
        kind: "switch",
        category: "chatbot",
        executionKind: "flow",
        label: "Switch",
        description: "Múltiplos caminhos por valor",
        outputs: [
            { id: "case-1", label: "Caso 1" },
            { id: "case-2", label: "Caso 2" },
            { id: "default", label: "Padrão" },
        ],
        defaultConfig: {
            expression: "{{ultima_resposta}}",
            cases: [
                { id: "case-1", label: "Caso 1", value: "1" },
                { id: "case-2", label: "Caso 2", value: "2" },
            ],
        },
    }),
    def({
        kind: "loop",
        category: "chatbot",
        executionKind: "flow",
        label: "Loop",
        description: "Repete um trecho até o limite",
        outputs: [
            { id: "body", label: "Corpo" },
            { id: "done", label: "Concluído" },
        ],
        defaultConfig: { maxIterations: 3, outputVariable: "loop_index" },
    }),
    def({
        kind: "message",
        category: "chatbot",
        executionKind: "flow",
        label: "Mensagem",
        description: "Envia texto ao contato",
        defaultConfig: { text: "Olá! Como posso ajudar?" },
    }),
    def({
        kind: "media",
        category: "chatbot",
        executionKind: "flow",
        label: "Mídia",
        description: "Envia vídeo MP4, PDF ou áudio. Nota de voz nativa do WhatsApp usa OGG/OPUS.",
        defaultConfig: {
            mediaKind: "video",
            mediaUrl: "",
            mediaCaption: "",
            mediaFileName: "",
            mediaMime: "",
            mediaRef: "",
            voiceNote: true,
        },
    }),
    def({
        kind: "link",
        category: "chatbot",
        executionKind: "flow",
        label: "Link",
        description: "Envia um botão oficial (CTA URL) com rótulo e endereço https",
        defaultConfig: {
            text: "Toque no botão para abrir o link.",
            buttonLabel: "Abrir link",
            url: "",
        },
    }),
    def({
        kind: "buttons",
        category: "chatbot",
        executionKind: "flow",
        label: "Botões",
        description: "Escolha com botões (enviada como menu numerado na Cloud API)",
        outputs: [
            { id: "opt-1", label: "Opção 1" },
            { id: "opt-2", label: "Opção 2" },
        ],
        defaultConfig: {
            text: "Escolha uma opção:",
            options: [
                { id: "opt-1", label: "Atendimento", value: "1" },
                { id: "opt-2", label: "Financeiro", value: "2" },
            ],
        },
    }),
    def({
        kind: "list",
        category: "chatbot",
        executionKind: "flow",
        label: "Lista",
        description: "Lista de opções (enviada como menu numerado)",
        defaultConfig: {
            text: "Selecione na lista:",
            options: [
                { id: "opt-1", label: "Opção A", value: "a" },
                { id: "opt-2", label: "Opção B", value: "b" },
            ],
        },
    }),
    def({
        kind: "menu",
        category: "chatbot",
        executionKind: "flow",
        label: "Menu",
        description: "Menu numerado de atendimento",
        defaultConfig: {
            text: "Digite o número da opção:",
            options: [
                { id: "opt-1", label: "1 - Atendimento", value: "1" },
                { id: "opt-2", label: "2 - Financeiro", value: "2" },
            ],
        },
    }),
    def({
        kind: "expediente",
        category: "chatbot",
        executionKind: "flow",
        label: "Expediente",
        description: "Bifurca por turno de Brasília",
        outputs: [
            { id: "bom_dia", label: "Bom dia" },
            { id: "boa_tarde", label: "Boa tarde" },
            { id: "boa_noite", label: "Boa noite" },
        ],
        defaultConfig: { label: "Expediente", outputVariable: "turno" },
    }),
    def({
        kind: "transfer_agent",
        category: "sistema",
        executionKind: "system",
        label: "Transferir atendente",
        description: "Assume human_takeover e para o bot",
        defaultConfig: { label: "Transferir" },
    }),
];
function getBotNodeDefinition(kind) {
    return exports.BOT_NODE_REGISTRY.find((item) => item.kind === kind);
}
function listBotNodesByCategory(category) {
    return exports.BOT_NODE_REGISTRY.filter((item) => item.category === category);
}
function createBotNodeData(kind) {
    const definition = getBotNodeDefinition(kind);
    if (!definition)
        throw new Error(`Node desconhecido: ${kind}`);
    return {
        kind: definition.kind,
        category: definition.category,
        executionKind: definition.executionKind,
        title: definition.label,
        config: structuredClone(definition.defaultConfig),
        variables: {},
        logs: [],
        status: "idle",
    };
}
function resolveBotNodeOutputs(data) {
    const definition = getBotNodeDefinition(data.kind);
    if (data.kind === "buttons" || data.kind === "list" || data.kind === "menu") {
        const options = (data.config.options || [])
            .filter((opt) => String(opt.label || "").trim().length > 0)
            .map((opt, index) => ({
            id: String(opt.id || `opt-${index + 1}`),
            label: String(opt.label).trim(),
        }));
        if (options.length === 0)
            return [{ id: "out", label: "Saída" }];
        return options;
    }
    return definition?.outputs?.length ? definition.outputs : [{ id: "out", label: "Saída" }];
}
exports.BOT_CATEGORY_META = {
    chatbot: { label: "Chatbot" },
    sistema: { label: "Sistema" },
};
