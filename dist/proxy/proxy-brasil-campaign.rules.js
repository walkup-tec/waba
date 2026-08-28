"use strict";
/**
 * Regras de Proxy Brasil na campanha Alternativa.
 * Sem HTTP: decide se pode enviar, se deve ligar e se deve desligar.
 *
 * - Envio só com instância selecionada, open e `/proxy/find` enabled.
 * - Proxy ligada só em selecionada + open.
 * - Proxy desligada em desconectada confirmada ou fora da seleção.
 * - connection unknown: não desliga (evita falso offline).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.campaignStatusHoldsProxyBrasil = campaignStatusHoldsProxyBrasil;
exports.normalizeProxyBrasilInstanceNames = normalizeProxyBrasilInstanceNames;
exports.heldProxyBrasilInstanceNames = heldProxyBrasilInstanceNames;
exports.namesHeldByUnfinishedCampaigns = namesHeldByUnfinishedCampaigns;
exports.instanceNameConflictsWithHeld = instanceNameConflictsWithHeld;
exports.classifyProxyBrasilConnection = classifyProxyBrasilConnection;
exports.instanceMaySendWithProxyBrasil = instanceMaySendWithProxyBrasil;
exports.desiredProxyBrasilEnabled = desiredProxyBrasilEnabled;
exports.shouldEnableProxyBrasil = shouldEnableProxyBrasil;
exports.shouldDisableProxyBrasil = shouldDisableProxyBrasil;
exports.shouldSkipProxySetBecauseSessionOpen = shouldSkipProxySetBecauseSessionOpen;
exports.shouldDisableProxyBrasilOnLiveCampaignTick = shouldDisableProxyBrasilOnLiveCampaignTick;
exports.instanceNamesToReleaseAfterCampaignEnd = instanceNamesToReleaseAfterCampaignEnd;
exports.pickNextEligibleCampaignInstance = pickNextEligibleCampaignInstance;
exports.pickBalancedEligibleCampaignInstance = pickBalancedEligibleCampaignInstance;
exports.runProxyBrasilCampaignRulesSelfCheck = runProxyBrasilCampaignRulesSelfCheck;
function campaignStatusHoldsProxyBrasil(status) {
    const s = String(status || "").trim().toLowerCase();
    return s === "running" || s === "paused";
}
function normalizeProxyBrasilInstanceNames(names) {
    const list = Array.isArray(names) ? names : [];
    return Array.from(new Set(list.map((n) => String(n || "").trim()).filter(Boolean)));
}
function heldProxyBrasilInstanceNames(campaigns) {
    const held = [];
    for (const campaign of campaigns) {
        if (!campaignStatusHoldsProxyBrasil(String(campaign.status || "")))
            continue;
        held.push(...normalizeProxyBrasilInstanceNames(campaign.selectedInstanceNames));
    }
    return normalizeProxyBrasilInstanceNames(held);
}
/** Números em campanha running/paused, opcionalmente excluindo uma campanha (ex.: a que está sendo editada). */
function namesHeldByUnfinishedCampaigns(campaigns, exceptCampaignId) {
    const except = String(exceptCampaignId || "").trim();
    return heldProxyBrasilInstanceNames(campaigns
        .filter((c) => !except || String(c.id || "") !== except)
        .map((c) => ({
        status: c.status,
        selectedInstanceNames: c.selectedInstanceNames,
    })));
}
function instanceNameConflictsWithHeld(name, heldNames) {
    const key = String(name || "").trim().toLowerCase();
    if (!key)
        return false;
    return normalizeProxyBrasilInstanceNames(heldNames).some((n) => n.toLowerCase() === key);
}
function classifyProxyBrasilConnection(state) {
    const s = String(state || "").trim().toLowerCase();
    if (!s)
        return "unknown";
    if (s === "open")
        return "open";
    if (s === "connecting" || s === "pairing" || s === "qrcode")
        return "unknown";
    return "disconnected";
}
function instanceMaySendWithProxyBrasil(input) {
    if (!input.selectedInLiveCampaign) {
        return { allowed: false, reason: "not-selected" };
    }
    if (input.connection !== "open") {
        return { allowed: false, reason: "not-open" };
    }
    if (!input.proxyConfigEnabled) {
        return { allowed: true, reason: "proxy-config-off" };
    }
    if (input.proxyFindEnabled !== true) {
        return { allowed: false, reason: "proxy-off" };
    }
    return { allowed: true, reason: "ok" };
}
function desiredProxyBrasilEnabled(input) {
    return input.selectedInLiveCampaign && input.connection === "open";
}
function shouldEnableProxyBrasil(input) {
    return desiredProxyBrasilEnabled(input) && input.proxyFindEnabled !== true;
}
function shouldDisableProxyBrasil(input) {
    if (input.connection === "unknown")
        return false;
    if (!input.selectedInLiveCampaign)
        return true;
    return input.connection === "disconnected";
}
/**
 * `proxy/set` (ligar ou desligar) com a sessão já `open` gera conflict/device_removed.
 * Ligar proxy só no QR «Proxy Campanha», nunca em número já pareado.
 */
function shouldSkipProxySetBecauseSessionOpen(wasOpen) {
    return wasOpen === true;
}
/**
 * No tick da campanha viva: não desligar Proxy dos números que ainda estão na seleção,
 * mesmo se o connectionState oscilar. Desligar com sessão pareada derruba a integração.
 */
function shouldDisableProxyBrasilOnLiveCampaignTick(input) {
    if (input.selectedInLiveCampaign)
        return false;
    return shouldDisableProxyBrasil(input);
}
function instanceNamesToReleaseAfterCampaignEnd(endingSelected, otherLiveSelected) {
    const held = new Set(normalizeProxyBrasilInstanceNames(otherLiveSelected).map((n) => n.toLowerCase()));
    return normalizeProxyBrasilInstanceNames(endingSelected).filter((n) => !held.has(n.toLowerCase()));
}
/**
 * 1 envio por número selecionado e ativo, na ordem da campanha, depois repete.
 * Inativos (sem proxy, não open, pausa humana, teto diário) são pulados nesta vez e tentados no próximo ciclo.
 */
function pickNextEligibleCampaignInstance(input) {
    const selected = normalizeProxyBrasilInstanceNames(input.selectedNames);
    const eligible = new Set(normalizeProxyBrasilInstanceNames(input.eligibleNames).map((n) => n.toLowerCase()));
    if (!selected.length || !eligible.size) {
        return { instanceName: null, nextCursor: Number.isFinite(input.cursor) ? input.cursor : 0 };
    }
    const start = ((Number(input.cursor) || 0) % selected.length + selected.length) % selected.length;
    for (let step = 0; step < selected.length; step += 1) {
        const idx = (start + step) % selected.length;
        const name = selected[idx];
        if (eligible.has(name.toLowerCase())) {
            return { instanceName: name, nextCursor: (idx + 1) % selected.length };
        }
    }
    return { instanceName: null, nextCursor: start };
}
function sendCountForInstanceName(sendCounts, instanceName) {
    const key = String(instanceName || "").trim().toLowerCase();
    if (!key)
        return 0;
    const n = Number(sendCounts?.[key]);
    return Number.isFinite(n) && n > 0 ? n : 0;
}
/**
 * Entre os ativos, escolhe quem tem menos envios nesta campanha.
 * Empate: ordem da seleção a partir do cursor (1 por número, depois repete).
 */
function pickBalancedEligibleCampaignInstance(input) {
    const selected = normalizeProxyBrasilInstanceNames(input.selectedNames);
    const eligible = new Set(normalizeProxyBrasilInstanceNames(input.eligibleNames).map((n) => n.toLowerCase()));
    if (!selected.length || !eligible.size) {
        return { instanceName: null, nextCursor: Number.isFinite(input.cursor) ? input.cursor : 0 };
    }
    const active = selected.filter((n) => eligible.has(n.toLowerCase()));
    if (!active.length) {
        return { instanceName: null, nextCursor: Number.isFinite(input.cursor) ? input.cursor : 0 };
    }
    let min = sendCountForInstanceName(input.sendCounts, active[0]);
    for (const name of active) {
        const n = sendCountForInstanceName(input.sendCounts, name);
        if (n < min)
            min = n;
    }
    const lowest = new Set(active.filter((n) => sendCountForInstanceName(input.sendCounts, n) === min).map((n) => n.toLowerCase()));
    return pickNextEligibleCampaignInstance({
        selectedNames: selected,
        eligibleNames: selected.filter((n) => lowest.has(n.toLowerCase())),
        cursor: input.cursor,
    });
}
function runProxyBrasilCampaignRulesSelfCheck() {
    const send = instanceMaySendWithProxyBrasil;
    const cases = [
        [
            "send-ok",
            true,
            send({
                proxyConfigEnabled: true,
                selectedInLiveCampaign: true,
                connection: "open",
                proxyFindEnabled: true,
            }),
        ],
        [
            "send-blocks-proxy-off",
            false,
            send({
                proxyConfigEnabled: true,
                selectedInLiveCampaign: true,
                connection: "open",
                proxyFindEnabled: false,
            }),
        ],
        [
            "send-blocks-proxy-unknown",
            false,
            send({
                proxyConfigEnabled: true,
                selectedInLiveCampaign: true,
                connection: "open",
                proxyFindEnabled: null,
            }),
        ],
        [
            "send-blocks-disconnected",
            false,
            send({
                proxyConfigEnabled: true,
                selectedInLiveCampaign: true,
                connection: "disconnected",
                proxyFindEnabled: true,
            }),
        ],
        [
            "send-blocks-unselected",
            false,
            send({
                proxyConfigEnabled: true,
                selectedInLiveCampaign: false,
                connection: "open",
                proxyFindEnabled: true,
            }),
        ],
    ];
    for (const [name, allowed, result] of cases) {
        if (result.allowed !== allowed) {
            throw new Error(`proxy-brasil rule failed: ${name}`);
        }
    }
    if (!shouldEnableProxyBrasil({
        selectedInLiveCampaign: true,
        connection: "open",
        proxyFindEnabled: false,
    })) {
        throw new Error("proxy-brasil rule failed: enable-selected-open");
    }
    if (shouldEnableProxyBrasil({
        selectedInLiveCampaign: true,
        connection: "open",
        proxyFindEnabled: true,
    })) {
        throw new Error("proxy-brasil rule failed: skip-enable-already-on");
    }
    if (!shouldDisableProxyBrasil({
        selectedInLiveCampaign: true,
        connection: "disconnected",
    })) {
        throw new Error("proxy-brasil rule failed: disable-disconnected");
    }
    if (shouldDisableProxyBrasil({
        selectedInLiveCampaign: true,
        connection: "unknown",
    })) {
        throw new Error("proxy-brasil rule failed: keep-unknown");
    }
    if (!shouldSkipProxySetBecauseSessionOpen(true)) {
        throw new Error("proxy-brasil rule failed: skip-proxy-set-on-open");
    }
    if (shouldSkipProxySetBecauseSessionOpen(false)) {
        throw new Error("proxy-brasil rule failed: allow-proxy-set-when-not-open");
    }
    if (shouldDisableProxyBrasilOnLiveCampaignTick({
        selectedInLiveCampaign: true,
        connection: "disconnected",
    })) {
        throw new Error("proxy-brasil rule failed: tick-keep-proxy-on-selected");
    }
    if (!shouldDisableProxyBrasilOnLiveCampaignTick({
        selectedInLiveCampaign: false,
        connection: "open",
    })) {
        throw new Error("proxy-brasil rule failed: tick-disable-left-campaign");
    }
    if (!shouldDisableProxyBrasil({
        selectedInLiveCampaign: false,
        connection: "open",
    })) {
        throw new Error("proxy-brasil rule failed: disable-unselected");
    }
    const held = heldProxyBrasilInstanceNames([
        { status: "running", selectedInstanceNames: ["drax", "9224"] },
        { status: "finished", selectedInstanceNames: ["walkup"] },
        { status: "paused", selectedInstanceNames: ["2477"] },
    ]);
    if (held.sort().join(",") !== "2477,9224,drax") {
        throw new Error(`proxy-brasil rule failed: held-set ${held.join(",")}`);
    }
    const heldExcept = namesHeldByUnfinishedCampaigns([
        { id: "a", status: "running", selectedInstanceNames: ["drax"] },
        { id: "b", status: "paused", selectedInstanceNames: ["2477"] },
        { id: "c", status: "finished", selectedInstanceNames: ["9224"] },
    ], "a");
    if (heldExcept.join(",") !== "2477") {
        throw new Error(`proxy-brasil rule failed: held-except ${heldExcept.join(",")}`);
    }
    if (!instanceNameConflictsWithHeld("DRAX", ["drax", "9224"])) {
        throw new Error("proxy-brasil rule failed: conflict-case");
    }
    const released = instanceNamesToReleaseAfterCampaignEnd(["drax", "9224"], ["9224", "2477"]);
    if (released.join(",") !== "drax") {
        throw new Error(`proxy-brasil rule failed: release ${released.join(",")}`);
    }
    const cycle = ["2477", "walkup-5401", "drax", "9224"];
    const first = pickNextEligibleCampaignInstance({
        selectedNames: cycle,
        eligibleNames: cycle,
        cursor: 0,
    });
    if (first.instanceName !== "2477" || first.nextCursor !== 1) {
        throw new Error(`proxy-brasil rule failed: rr-first ${first.instanceName}`);
    }
    const second = pickNextEligibleCampaignInstance({
        selectedNames: cycle,
        eligibleNames: cycle,
        cursor: first.nextCursor,
    });
    if (second.instanceName !== "walkup-5401" || second.nextCursor !== 2) {
        throw new Error(`proxy-brasil rule failed: rr-second ${second.instanceName}`);
    }
    const skip5401 = pickNextEligibleCampaignInstance({
        selectedNames: cycle,
        eligibleNames: ["2477", "drax", "9224"],
        cursor: 1,
    });
    if (skip5401.instanceName !== "drax" || skip5401.nextCursor !== 3) {
        throw new Error(`proxy-brasil rule failed: rr-skip ${skip5401.instanceName}`);
    }
    const wrap = pickNextEligibleCampaignInstance({
        selectedNames: cycle,
        eligibleNames: cycle,
        cursor: 3,
    });
    if (wrap.instanceName !== "9224" || wrap.nextCursor !== 0) {
        throw new Error(`proxy-brasil rule failed: rr-wrap ${wrap.instanceName}`);
    }
    const balanced = pickBalancedEligibleCampaignInstance({
        selectedNames: cycle,
        eligibleNames: cycle,
        sendCounts: { "9224": 12, drax: 3, "2477": 1, "walkup-5401": 1 },
        cursor: 0,
    });
    if (balanced.instanceName !== "2477") {
        throw new Error(`proxy-brasil rule failed: balance-least ${balanced.instanceName}`);
    }
    const catchUp = pickBalancedEligibleCampaignInstance({
        selectedNames: cycle,
        eligibleNames: ["2477", "drax", "9224"],
        sendCounts: { "2477": 4, drax: 4, "9224": 12 },
        cursor: 0,
    });
    if (catchUp.instanceName !== "2477") {
        throw new Error(`proxy-brasil rule failed: balance-tie ${catchUp.instanceName}`);
    }
    const skipHeavy = pickBalancedEligibleCampaignInstance({
        selectedNames: cycle,
        eligibleNames: ["2477", "drax", "9224"],
        sendCounts: { "2477": 4, drax: 3, "9224": 12 },
        cursor: 0,
    });
    if (skipHeavy.instanceName !== "drax") {
        throw new Error(`proxy-brasil rule failed: balance-skip-heavy ${skipHeavy.instanceName}`);
    }
}
