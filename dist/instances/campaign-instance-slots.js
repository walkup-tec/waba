"use strict";
/**
 * Teto de instâncias da campanha: o tamanho configurado não cresce na troca.
 * Vermelho sai; substituto entra no mesmo slot.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCampaignInstanceSlotCount = resolveCampaignInstanceSlotCount;
exports.mergeCampaignSlotsReplacingDisconnected = mergeCampaignSlotsReplacingDisconnected;
exports.sameInstanceByExactName = sameInstanceByExactName;
exports.runCampaignInstanceSlotsSelfCheck = runCampaignInstanceSlotsSelfCheck;
function resolveCampaignInstanceSlotCount(prevSelected, storedSlotCount) {
    const stored = Math.max(0, Math.floor(Number(storedSlotCount) || 0));
    if (stored >= 1)
        return stored;
    const n = prevSelected.map((s) => String(s || "").trim()).filter(Boolean).length;
    return Math.max(n, 1);
}
function mergeCampaignSlotsReplacingDisconnected(input) {
    const prev = uniqueTrim(input.prevSelected);
    const incoming = uniqueTrim(input.incoming);
    const disconnected = uniqueTrim(input.disconnected).filter((name) => prev.some((p) => input.sameInstance(name, p)));
    const slotCount = Math.max(1, Math.floor(Number(input.slotCount) || prev.length || 1));
    const greens = prev.filter((name) => !disconnected.some((d) => input.sameInstance(d, name)));
    const incomingNew = incoming.filter((name) => !prev.some((p) => input.sameInstance(name, p)));
    const roomForNew = Math.max(0, slotCount - greens.length);
    const maxAdd = Math.min(incomingNew.length, disconnected.length, roomForNew);
    const added = incomingNew.slice(0, maxAdd);
    const mustDrop = Math.max(0, prev.length - slotCount);
    const removedCount = Math.min(disconnected.length, added.length + mustDrop);
    const removed = disconnected.slice(0, removedCount);
    let selected = [...greens, ...added];
    const leftoverRed = disconnected.filter((name) => !removed.some((r) => input.sameInstance(r, name)));
    if (selected.length < slotCount) {
        selected = [...selected, ...leftoverRed].slice(0, slotCount);
    }
    else {
        selected = selected.slice(0, slotCount);
    }
    return { selected, added, removed };
}
function uniqueTrim(names) {
    const out = [];
    const seen = new Set();
    for (const raw of names) {
        const n = String(raw || "").trim();
        if (!n)
            continue;
        const key = n.toLowerCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(n);
    }
    return out;
}
function sameInstanceByExactName(a, b) {
    return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}
function runCampaignInstanceSlotsSelfCheck() {
    const same = sameInstanceByExactName;
    const swap = mergeCampaignSlotsReplacingDisconnected({
        prevSelected: ["1261", "walkup-5401", "wb-walkup", "WB-2477"],
        incoming: ["wb-9224"],
        disconnected: ["WB-2477"],
        slotCount: 4,
        sameInstance: same,
    });
    if (swap.selected.length !== 4) {
        throw new Error(`slot swap size ${swap.selected.length}`);
    }
    if (!swap.selected.includes("wb-9224") || swap.selected.some((n) => n.toLowerCase() === "wb-2477")) {
        throw new Error(`slot swap members ${swap.selected.join(",")}`);
    }
    if (swap.removed.join(",") !== "WB-2477" || swap.added.join(",") !== "wb-9224") {
        throw new Error(`slot swap in/out ${swap.added} / ${swap.removed}`);
    }
    const noRed = mergeCampaignSlotsReplacingDisconnected({
        prevSelected: ["1261", "walkup-5401", "wb-walkup", "WB-2477"],
        incoming: ["wb-9224"],
        disconnected: [],
        slotCount: 4,
        sameInstance: same,
    });
    if (noRed.added.length || noRed.selected.length !== 4 || noRed.selected.includes("wb-9224")) {
        throw new Error("sem vermelho não pode crescer");
    }
    const oneOfThree = mergeCampaignSlotsReplacingDisconnected({
        prevSelected: ["a", "b", "c", "d"],
        incoming: ["e", "f", "g"],
        disconnected: ["d"],
        slotCount: 4,
        sameInstance: same,
    });
    if (oneOfThree.selected.length !== 4 || oneOfThree.added.join(",") !== "e") {
        throw new Error(`um vermelho só troca um ${oneOfThree.selected.join(",")}`);
    }
    const twoRedOneSpare = mergeCampaignSlotsReplacingDisconnected({
        prevSelected: ["a", "b", "c", "d"],
        incoming: ["e"],
        disconnected: ["c", "d"],
        slotCount: 4,
        sameInstance: same,
    });
    if (twoRedOneSpare.selected.length !== 4) {
        throw new Error("dois vermelhos / um spare deve continuar 4");
    }
    if (!twoRedOneSpare.selected.includes("e") || twoRedOneSpare.selected.includes("c")) {
        throw new Error(`resto vermelho ${twoRedOneSpare.selected.join(",")}`);
    }
    const overCap = mergeCampaignSlotsReplacingDisconnected({
        prevSelected: ["a", "b", "c", "d", "e"],
        incoming: ["f"],
        disconnected: ["e"],
        slotCount: 4,
        sameInstance: same,
    });
    if (overCap.selected.length !== 4 || overCap.selected.includes("e")) {
        throw new Error(`teto 4 com 5 na lista ${overCap.selected.join(",")}`);
    }
}
