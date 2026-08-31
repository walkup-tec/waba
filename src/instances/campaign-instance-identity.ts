/**
 * Casa o nome gravado na campanha (WB-7770, 1261) com a chave técnica da Evolution (drax, 1261).
 * O pick de envio e o chip da campanha têm de usar a mesma regra.
 */

export type CampaignInstanceIdentityRow = {
  instanceKey: string;
  displayName: string;
  nameKeys: string[];
  digitKeys: string[];
};

function addKey(set: Set<string>, value: unknown) {
  const s = String(value || "").trim().toLowerCase();
  if (s) set.add(s);
}

export function digitKeysFromStoredLabel(raw: string): string[] {
  const out = new Set<string>();
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length >= 4) {
    out.add(digits);
    out.add(digits.slice(-4));
  } else if (digits) {
    out.add(digits);
  }
  return Array.from(out);
}

export function identityRowFromEvoFields(input: {
  instanceKey: string;
  displayName?: string;
  phone?: string;
}): CampaignInstanceIdentityRow {
  const instanceKey = String(input.instanceKey || "").trim();
  const displayName = String(input.displayName || instanceKey).trim() || instanceKey;
  const nameKeys = new Set<string>();
  addKey(nameKeys, instanceKey);
  addKey(nameKeys, displayName);
  const digitKeys = new Set<string>([
    ...digitKeysFromStoredLabel(instanceKey),
    ...digitKeysFromStoredLabel(displayName),
    ...digitKeysFromStoredLabel(String(input.phone || "")),
  ]);
  return {
    instanceKey,
    displayName,
    nameKeys: Array.from(nameKeys),
    digitKeys: Array.from(digitKeys),
  };
}

/**
 * WB-7770 + alias/telefone do drax → `drax`.
 * 1261 sem telefone no fetch → `1261` se a chave existir nas linhas.
 */
export function resolveCampaignStoredNameToEvoKey(
  storedName: string,
  rows: CampaignInstanceIdentityRow[],
): string {
  const raw = String(storedName || "").trim();
  const rawLc = raw.toLowerCase();
  if (!raw) return "";
  if (!rows.length) return raw;

  for (const r of rows) {
    if (r.nameKeys.some((k) => k === rawLc)) {
      return String(r.instanceKey || raw).trim() || raw;
    }
  }

  const storedDigits = digitKeysFromStoredLabel(raw);
  if (!storedDigits.length) return raw;

  const digitHits = rows.filter((r) =>
    storedDigits.some((d) => r.digitKeys.includes(d)),
  );
  if (digitHits.length === 1) {
    return String(digitHits[0].instanceKey || raw).trim() || raw;
  }
  if (digitHits.length > 1) {
    const exactKey = digitHits.find((r) => r.instanceKey.toLowerCase() === rawLc);
    if (exactKey) return exactKey.instanceKey;
    const exactDisp = digitHits.find((r) => r.displayName.toLowerCase() === rawLc);
    if (exactDisp) return exactDisp.instanceKey;
  }
  return raw;
}

/**
 * Token de identidade da campanha: chave EVO, alias técnico (WB-5401) ou telefone.
 * Nome de perfil WhatsApp (`Walkup`, `Drax Sistemas`) não entra — vários chips compartilham.
 */
export function isStableCampaignIdentityToken(
  token: string,
  instanceKey: string,
  displayName: string,
): boolean {
  const s = String(token || "").trim().toLowerCase();
  if (!s || /\s/.test(s)) return false;
  const ik = String(instanceKey || "").trim().toLowerCase();
  const disp = String(displayName || "").trim().toLowerCase();
  if (ik && s === ik) return true;
  if (/\d{4,}/.test(s)) return true;
  if (disp && s === disp) {
    if (ik && disp === ik) return true;
    if (/\d{4,}/.test(disp)) return true;
    return false;
  }
  return false;
}

/** Tokens usados para saber se um spare já está na seleção (nome/alias/telefone ≥8 dígitos). */
export function campaignIdentityTokensFromRow(row: CampaignInstanceIdentityRow): string[] {
  const out = new Set<string>();
  const instanceKey = String(row.instanceKey || "").trim();
  const displayName = String(row.displayName || "").trim();
  addKey(out, instanceKey);
  if (isStableCampaignIdentityToken(displayName, instanceKey, displayName)) {
    addKey(out, displayName);
  }
  for (const k of row.nameKeys) {
    if (isStableCampaignIdentityToken(k, instanceKey, displayName)) addKey(out, k);
  }
  for (const d of row.digitKeys) {
    const digits = String(d || "").trim();
    if (digits.length >= 8) out.add(`d:${digits}`);
  }
  return Array.from(out);
}

export function campaignRowSharesSelectionIdentity(
  selectedRows: CampaignInstanceIdentityRow[],
  candidate: CampaignInstanceIdentityRow,
): boolean {
  const identity = new Set<string>();
  for (const row of selectedRows) {
    for (const token of campaignIdentityTokensFromRow(row)) identity.add(token);
  }
  return campaignIdentityTokensFromRow(candidate).some((token) => identity.has(token));
}

export function uniqueProbeNamesForLiveState(
  evoKey: string,
  storedName: string,
): string[] {
  const out: string[] = [];
  for (const n of [evoKey, storedName]) {
    const v = String(n || "").trim();
    if (!v) continue;
    if (out.some((x) => x.toLowerCase() === v.toLowerCase())) continue;
    out.push(v);
  }
  return out;
}

export function runCampaignInstanceIdentitySelfCheck(): void {
  const drax = identityRowFromEvoFields({
    instanceKey: "drax",
    displayName: "WB-7770",
    phone: "51981077770",
  });
  const n1261 = identityRowFromEvoFields({
    instanceKey: "1261",
    displayName: "1261",
    phone: "",
  });
  const walkup5401 = identityRowFromEvoFields({
    instanceKey: "walkup-5401",
    displayName: "WB-5401",
    phone: "5198335401",
  });
  const walkup2102 = identityRowFromEvoFields({
    instanceKey: "walkup",
    displayName: "WB-2102",
    phone: "5197462102",
  });
  const rows = [drax, n1261, walkup5401, walkup2102];

  const cases: Array<[string, string, string]> = [
    ["WB-7770", "drax", "alias da campanha tem de virar a chave EVO"],
    ["drax", "drax", "chave técnica permanece"],
    ["1261", "1261", "1261 sem telefone no fetch continua encontrável"],
    ["WB-5401", "walkup-5401", "5401 pelo alias"],
    ["WB-2102", "walkup", "2102 pelo alias não vira walkup-5401"],
  ];
  for (const [stored, expected, label] of cases) {
    const got = resolveCampaignStoredNameToEvoKey(stored, rows);
    if (got !== expected) {
      throw new Error(`identity ${label}: ${stored} → ${got} (esperado ${expected})`);
    }
  }

  const probes = uniqueProbeNamesForLiveState("drax", "WB-7770");
  if (probes.join(",") !== "drax,WB-7770") {
    throw new Error(`probes 7770: ${probes.join(",")}`);
  }

  if (campaignRowSharesSelectionIdentity([walkup5401, n1261, drax], walkup2102)) {
    throw new Error("walkup/2102 não pode ser tratado como já selecionado só porque existe walkup-5401");
  }

  const wb9224 = identityRowFromEvoFields({
    instanceKey: "wb-9224",
    displayName: "WB-9224",
    phone: "5197979224",
  });
  if (campaignRowSharesSelectionIdentity([walkup5401], wb9224)) {
    throw new Error("WB-9224 não pode ser o mesmo chip que WB-5401");
  }
  const walkupProfileA = identityRowFromEvoFields({
    instanceKey: "walkup-5401",
    displayName: "Walkup",
    phone: "5198335401",
  });
  const walkupProfileB = identityRowFromEvoFields({
    instanceKey: "wb-9224",
    displayName: "Walkup",
    phone: "5197979224",
  });
  if (campaignRowSharesSelectionIdentity([walkupProfileA], walkupProfileB)) {
    throw new Error("perfil WhatsApp Walkup não pode unir chips diferentes");
  }
}
