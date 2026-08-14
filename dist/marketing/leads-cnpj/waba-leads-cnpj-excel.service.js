"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractMobilePhonesForEvo = extractMobilePhonesForEvo;
exports.expandLeadsByMobileForEvo = expandLeadsByMobileForEvo;
exports.buildLeadsCnpjExcelBuffer = buildLeadsCnpjExcelBuffer;
exports.sanitizeExportBaseName = sanitizeExportBaseName;
exports.isEvoBrazilMobileDigits = isEvoBrazilMobileDigits;
const XLSX = __importStar(require("xlsx"));
const evo_instance_phone_service_1 = require("../../instances/evo-instance-phone.service");
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
];
/**
 * Remove DDI 55 sem confundir com DDD 55 (RS).
 * Nacional válido: 10 ou 11 dígitos começando por DDD 11–99.
 */
function toBrazilNationalDigits(rawDigits) {
    let digits = String(rawDigits || "").replace(/\D/g, "");
    if (!digits)
        return "";
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
function extractMobilePhonesForEvo(raw) {
    const text = String(raw || "").trim();
    if (!text)
        return [];
    const parts = text
        .split(/[/|;,\n]+|\s+e\s+/i)
        .map((p) => p.trim())
        .filter(Boolean);
    const chunks = [];
    for (const part of parts.length ? parts : [text]) {
        const digitGroups = String(part).match(/\d[\d\s().-]{7,}\d/g) || [];
        if (digitGroups.length) {
            for (const g of digitGroups)
                chunks.push(g.replace(/\D/g, ""));
        }
        else {
            const only = part.replace(/\D/g, "");
            if (only)
                chunks.push(only);
        }
    }
    const seen = new Set();
    const out = [];
    for (const digits of chunks) {
        let national = toBrazilNationalDigits(digits);
        if (national.length < 10 || national.length > 11)
            continue;
        if (!/^[1-9]\d/.test(national))
            continue;
        // Móvel antigo: DDD + 8 dígitos (6–9…) → insere o 9 após o DDD.
        if (national.length === 10 && /^[1-9]\d[6-9]\d{7}$/.test(national)) {
            national = `${national.slice(0, 2)}9${national.slice(2)}`;
        }
        // Celular atual: DDD + 9 + 8 dígitos
        if (national.length !== 11 || national.charAt(2) !== "9")
            continue;
        if (!/^[1-9]\d9\d{8}$/.test(national))
            continue;
        const evo = (0, evo_instance_phone_service_1.normalizeEvoWhatsAppNumber)(national);
        // Esperado: 55 + 11 nacionais = 13 dígitos
        if (!evo || evo.length !== 13 || !evo.startsWith("55") || evo.charAt(4) !== "9")
            continue;
        if (seen.has(evo))
            continue;
        seen.add(evo);
        out.push(evo);
    }
    return out;
}
/**
 * 1 linha por celular (EVO). Sem celular reconhecido → mantém 1 linha com
 * Telefone vazio (evita mandar fixo/máscara inválida para disparo).
 */
function expandLeadsByMobileForEvo(leads) {
    const rows = [];
    for (const lead of leads) {
        const rawTel = String(lead.telefone || "").trim();
        const mobiles = extractMobilePhonesForEvo(rawTel);
        if (!mobiles.length) {
            rows.push({ ...lead, telefone: "" });
            continue;
        }
        for (const telefone of mobiles) {
            rows.push({ ...lead, telefone });
        }
    }
    return rows;
}
function buildLeadsCnpjExcelBuffer(leads) {
    const rows = leads.map((lead) => ({
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
function sanitizeExportBaseName(name) {
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
function isEvoBrazilMobileDigits(raw) {
    const d = String(raw || "").replace(/\D/g, "");
    return d.length === 13 && d.startsWith("55") && d.charAt(4) === "9" && /^55[1-9]\d9\d{8}$/.test(d);
}
