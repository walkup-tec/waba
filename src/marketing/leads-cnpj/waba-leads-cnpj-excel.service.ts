import * as XLSX from "xlsx";
import type { WabaLeadsCnpjLead } from "./waba-leads-cnpj.types";
import { normalizeEvoWhatsAppNumber } from "../../instances/evo-instance-phone.service";

const HEADERS = [
  "CNPJ",
  "Nome (Razão Social)",
  "Telefone",
  "E-mail",
  "Situação",
  "Data de Abertura",
  "Cidade",
  "Estado",
  "Endereço",
] as const;

/**
 * Remove DDI 55 sem confundir com DDD 55 (RS).
 * Nacional válido: 10 ou 11 dígitos começando por DDD 11–99.
 */
function toBrazilNationalDigits(rawDigits: string): string {
  let digits = String(rawDigits || "").replace(/\D/g, "");
  if (!digits) return "";
  // Só remove 55 quando sobra nacional 10/11 (evita comer DDD 55).
  while (digits.startsWith("55") && digits.length >= 12) {
    const rest = digits.slice(2);
    if (rest.length === 10 || rest.length === 11) {
      digits = rest;
      break;
    }
    if (rest.length > 11 && rest.startsWith("55")) {
      digits = rest;
      continue;
    }
    break;
  }
  return digits;
}

/**
 * Celular BR no formato usado nos disparos EVO/WhatsApp:
 * 55 + DDD + 9 + 8 dígitos (13 dígitos).
 *
 * ReceitaWS costuma devolver móvel antigo (DDD + 8, sem o 9º dígito) —
 * nesse caso inserimos o 9 após o DDD. Fixo não entra.
 * O “com/sem 9” por UF no WhatsApp é variante de JID; no Excel padronizamos
 * com o 9º dígito (oficial em todo o Brasil) para envio.
 */
export function extractMobilePhonesForEvo(raw: string): string[] {
  const text = String(raw || "").trim();
  if (!text) return [];

  const parts = text
    .split(/[/|;,\n]+|\s+e\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  for (const part of parts.length ? parts : [text]) {
    const digitGroups = String(part).match(/\d[\d\s().-]{7,}\d/g) || [];
    if (digitGroups.length) {
      for (const g of digitGroups) chunks.push(g.replace(/\D/g, ""));
    } else {
      const only = part.replace(/\D/g, "");
      if (only) chunks.push(only);
    }
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const digits of chunks) {
    let national = toBrazilNationalDigits(digits);
    if (national.length < 10 || national.length > 11) continue;
    if (!/^[1-9]\d/.test(national)) continue;

    // Móvel antigo: DDD + 8 dígitos (6–9…) → insere o 9 após o DDD.
    if (national.length === 10 && /^[1-9]\d[6-9]\d{7}$/.test(national)) {
      national = `${national.slice(0, 2)}9${national.slice(2)}`;
    }
    // Celular atual: DDD + 9 + 8 dígitos
    if (national.length !== 11 || national.charAt(2) !== "9") continue;
    if (!/^[1-9]\d9\d{8}$/.test(national)) continue;

    const evo = normalizeEvoWhatsAppNumber(national);
    // Esperado: 55 + 11 nacionais = 13 dígitos
    if (!evo || evo.length !== 13 || !evo.startsWith("55") || evo.charAt(4) !== "9") continue;
    if (seen.has(evo)) continue;
    seen.add(evo);
    out.push(evo);
  }
  return out;
}

/**
 * 1 linha por celular (EVO). Sem celular reconhecido → **omite** o CNPJ
 * (Excel e leadCount só contam quem tem telefone móvel válido).
 */
export function expandLeadsByMobileForEvo(leads: WabaLeadsCnpjLead[]): WabaLeadsCnpjLead[] {
  const rows: WabaLeadsCnpjLead[] = [];
  for (const lead of leads) {
    const rawTel = String(lead.telefone || "").trim();
    const mobiles = extractMobilePhonesForEvo(rawTel);
    if (!mobiles.length) continue;
    for (const telefone of mobiles) {
      rows.push({ ...lead, telefone });
    }
  }
  return rows;
}

export function buildLeadsCnpjExcelBuffer(leads: WabaLeadsCnpjLead[]): Buffer {
  const withPhone = leads.filter((lead) => String(lead.telefone || "").trim().length > 0);
  const rows = withPhone.map((lead) => ({
    CNPJ: lead.cnpj,
    "Nome (Razão Social)": lead.nome,
    Telefone: lead.telefone,
    "E-mail": lead.email,
    Situação: lead.situacao,
    "Data de Abertura": lead.dataAbertura,
    Cidade: lead.cidade,
    Estado: lead.estado,
    Endereço: lead.endereco,
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: [...HEADERS] });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Leads PJ");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

export function sanitizeExportBaseName(name: string): string {
  const base = String(name || "lista")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return base || "lista";
}

/** Já está no formato EVO de celular (55 + DDD + 9 + 8). */
export function isEvoBrazilMobileDigits(raw: string): boolean {
  const d = String(raw || "").replace(/\D/g, "");
  return d.length === 13 && d.startsWith("55") && d.charAt(4) === "9" && /^55[1-9]\d9\d{8}$/.test(d);
}
