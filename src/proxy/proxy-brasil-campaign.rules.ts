/**
 * Regras de Proxy Brasil na campanha Alternativa.
 * Sem HTTP: decide se pode enviar, se deve ligar e se deve desligar.
 *
 * - Envio só com instância selecionada, open e `/proxy/find` enabled.
 * - Proxy ligada só em selecionada + open.
 * - Proxy desligada em desconectada confirmada ou fora da seleção.
 * - connection unknown: não desliga (evita falso offline).
 */

export type ProxyBrasilConnectionKind = "open" | "disconnected" | "unknown";

export function campaignStatusHoldsProxyBrasil(status: string): boolean {
  const s = String(status || "").trim().toLowerCase();
  return s === "running" || s === "paused";
}

export function normalizeProxyBrasilInstanceNames(names: unknown): string[] {
  const list = Array.isArray(names) ? names : [];
  return Array.from(
    new Set(list.map((n) => String(n || "").trim()).filter(Boolean)),
  );
}

export function heldProxyBrasilInstanceNames(
  campaigns: Array<{ status?: string; selectedInstanceNames?: unknown }>,
): string[] {
  const held: string[] = [];
  for (const campaign of campaigns) {
    if (!campaignStatusHoldsProxyBrasil(String(campaign.status || ""))) continue;
    held.push(...normalizeProxyBrasilInstanceNames(campaign.selectedInstanceNames));
  }
  return normalizeProxyBrasilInstanceNames(held);
}

export function classifyProxyBrasilConnection(state: string): ProxyBrasilConnectionKind {
  const s = String(state || "").trim().toLowerCase();
  if (!s) return "unknown";
  if (s === "open") return "open";
  if (s === "connecting" || s === "pairing" || s === "qrcode") return "unknown";
  return "disconnected";
}

export function instanceMaySendWithProxyBrasil(input: {
  proxyConfigEnabled: boolean;
  selectedInLiveCampaign: boolean;
  connection: ProxyBrasilConnectionKind;
  proxyFindEnabled: boolean | null;
}): { allowed: boolean; reason: string } {
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

export function desiredProxyBrasilEnabled(input: {
  selectedInLiveCampaign: boolean;
  connection: ProxyBrasilConnectionKind;
}): boolean {
  return input.selectedInLiveCampaign && input.connection === "open";
}

export function shouldEnableProxyBrasil(input: {
  selectedInLiveCampaign: boolean;
  connection: ProxyBrasilConnectionKind;
  proxyFindEnabled: boolean | null;
}): boolean {
  return desiredProxyBrasilEnabled(input) && input.proxyFindEnabled !== true;
}

export function shouldDisableProxyBrasil(input: {
  selectedInLiveCampaign: boolean;
  connection: ProxyBrasilConnectionKind;
}): boolean {
  if (input.connection === "unknown") return false;
  if (!input.selectedInLiveCampaign) return true;
  return input.connection === "disconnected";
}

export function instanceNamesToReleaseAfterCampaignEnd(
  endingSelected: string[],
  otherLiveSelected: string[],
): string[] {
  const held = new Set(
    normalizeProxyBrasilInstanceNames(otherLiveSelected).map((n) => n.toLowerCase()),
  );
  return normalizeProxyBrasilInstanceNames(endingSelected).filter(
    (n) => !held.has(n.toLowerCase()),
  );
}

/**
 * 1 envio por número selecionado e ativo, na ordem da campanha, depois repete.
 * Inativos (sem proxy, não open, pausa humana, teto diário) são pulados nesta vez e tentados no próximo ciclo.
 */
export function pickNextEligibleCampaignInstance(input: {
  selectedNames: string[];
  eligibleNames: string[];
  cursor: number;
}): { instanceName: string | null; nextCursor: number } {
  const selected = normalizeProxyBrasilInstanceNames(input.selectedNames);
  const eligible = new Set(
    normalizeProxyBrasilInstanceNames(input.eligibleNames).map((n) => n.toLowerCase()),
  );
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

export function runProxyBrasilCampaignRulesSelfCheck(): void {
  const send = instanceMaySendWithProxyBrasil;
  const cases: Array<[string, boolean, ReturnType<typeof send>]> = [
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
  if (
    !shouldEnableProxyBrasil({
      selectedInLiveCampaign: true,
      connection: "open",
      proxyFindEnabled: false,
    })
  ) {
    throw new Error("proxy-brasil rule failed: enable-selected-open");
  }
  if (
    shouldEnableProxyBrasil({
      selectedInLiveCampaign: true,
      connection: "open",
      proxyFindEnabled: true,
    })
  ) {
    throw new Error("proxy-brasil rule failed: skip-enable-already-on");
  }
  if (
    !shouldDisableProxyBrasil({
      selectedInLiveCampaign: true,
      connection: "disconnected",
    })
  ) {
    throw new Error("proxy-brasil rule failed: disable-disconnected");
  }
  if (
    shouldDisableProxyBrasil({
      selectedInLiveCampaign: true,
      connection: "unknown",
    })
  ) {
    throw new Error("proxy-brasil rule failed: keep-unknown");
  }
  if (
    !shouldDisableProxyBrasil({
      selectedInLiveCampaign: false,
      connection: "open",
    })
  ) {
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
}
