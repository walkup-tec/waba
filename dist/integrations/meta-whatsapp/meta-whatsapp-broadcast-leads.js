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
exports.META_BROADCAST_MAX_LEADS = void 0;
exports.readMetaBroadcastSheet = readMetaBroadcastSheet;
exports.guessMetaBroadcastPhoneColumn = guessMetaBroadcastPhoneColumn;
exports.guessMetaBroadcastNomeColumn = guessMetaBroadcastNomeColumn;
exports.guessMetaBroadcastNumeroColumn = guessMetaBroadcastNumeroColumn;
exports.parseMetaBroadcastLeads = parseMetaBroadcastLeads;
const XLSX = __importStar(require("xlsx"));
const waba_campaign_spreadsheet_util_1 = require("../../disparos/waba-campaign-spreadsheet.util");
const meta_whatsapp_cloud_recipient_1 = require("./meta-whatsapp-cloud-recipient");
exports.META_BROADCAST_MAX_LEADS = 5000;
const PHONE_HEADER_RE = /^(telefone|phone|celular|whatsapp|whats|mobile|tel|n[uú]mero|numero|destino)$/i;
const NAME_HEADER_RE = /^(nome|name|cliente|contato|lead)$/i;
const NUMERO_VAR_HEADER_RE = /^(n[uú]mero|numero|protocolo|pedido|os)$/i;
function cellLabel(raw) {
    return String(raw ?? "").trim().slice(0, 80);
}
function uniqueColumns(headers) {
    const seen = new Set();
    const out = [];
    for (const header of headers) {
        const name = String(header || "").trim() || "coluna";
        let next = name;
        let n = 2;
        while (seen.has(next)) {
            next = `${name}_${n}`;
            n += 1;
        }
        seen.add(next);
        out.push(next);
    }
    return out;
}
function parseTxtRows(buffer) {
    const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
    const lines = text
        .split(/\r\n|\n|\r/)
        .map((line) => line.trim())
        .filter(Boolean);
    if (!lines.length)
        return { columns: ["telefone"], rows: [] };
    const first = lines[0];
    const delimiter = first.includes(";") ? ";" : first.includes("\t") ? "\t" : first.includes(",") ? "," : "";
    if (delimiter) {
        const headers = uniqueColumns(first.split(delimiter).map((item) => item.trim()));
        const looksHeader = headers.some((item) => PHONE_HEADER_RE.test(item) || NAME_HEADER_RE.test(item));
        if (looksHeader) {
            const rows = lines.slice(1).map((line) => {
                const parts = line.split(delimiter);
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = String(parts[index] ?? "").trim();
                });
                return row;
            });
            return { columns: headers, rows };
        }
    }
    return {
        columns: ["telefone"],
        rows: lines.map((line) => ({ telefone: line })),
    };
}
function readMetaBroadcastSheet(buffer, fileName) {
    if (!buffer?.length)
        return { columns: [], rows: [] };
    if ((0, waba_campaign_spreadsheet_util_1.isCampaignLeadsTxtFileName)(fileName)) {
        return parseTxtRows(buffer);
    }
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: true });
    const sheetName = wb.SheetNames[0];
    if (!sheetName)
        return { columns: [], rows: [] };
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
    const columns = rows[0] ? Object.keys(rows[0]) : [];
    return { columns, rows };
}
function guessMetaBroadcastPhoneColumn(columns) {
    const list = columns.map((item) => String(item || "").trim()).filter(Boolean);
    const exact = list.find((item) => PHONE_HEADER_RE.test(item));
    if (exact)
        return exact;
    const fuzzy = list.find((item) => /tel|phone|whats|cel/i.test(item));
    return fuzzy || list[0] || "";
}
function guessMetaBroadcastNomeColumn(columns) {
    return columns.map((item) => String(item || "").trim()).find((item) => NAME_HEADER_RE.test(item)) || "";
}
function guessMetaBroadcastNumeroColumn(columns, phoneColumn) {
    return (columns
        .map((item) => String(item || "").trim())
        .find((item) => item !== phoneColumn && NUMERO_VAR_HEADER_RE.test(item)) || "");
}
function mappingNeeded(bodyVariables, key) {
    return bodyVariables.some((item) => item.key === key);
}
function parseMetaBroadcastLeads(input) {
    const maxLeads = Math.max(1, Math.round(Number(input.maxLeads) || exports.META_BROADCAST_MAX_LEADS));
    const phoneColumn = String(input.mapping.phoneColumn || "").trim();
    const nomeColumn = String(input.mapping.nomeColumn || "").trim();
    const numeroColumn = String(input.mapping.numeroColumn || "").trim();
    const textoColumn = String(input.mapping.textoColumn || "").trim();
    const needNome = mappingNeeded(input.bodyVariables || [], "nome");
    const needNumero = mappingNeeded(input.bodyVariables || [], "numero");
    const needTexto = mappingNeeded(input.bodyVariables || [], "texto");
    const leads = [];
    const invalid = [];
    const validSamples = [];
    const seen = new Set();
    let duplicatesRemoved = 0;
    let truncated = false;
    if (!phoneColumn) {
        return {
            leads: [],
            invalid: [{ raw: "", error: "Selecione a coluna de telefone da planilha." }],
            duplicatesRemoved: 0,
            truncated: false,
            samples: { valid: [], invalid: [{ raw: "", error: "Selecione a coluna de telefone da planilha." }] },
        };
    }
    for (const row of input.sheet.rows) {
        if (leads.length >= maxLeads) {
            truncated = true;
            break;
        }
        const rawPhone = row[phoneColumn];
        const rawLabel = cellLabel(rawPhone);
        const normalized = (0, meta_whatsapp_cloud_recipient_1.normalizeMetaSpreadsheetRecipient)(rawPhone);
        if (!normalized.ok) {
            if (rawLabel)
                invalid.push({ raw: rawLabel, error: normalized.error });
            continue;
        }
        const dedupeKey = (0, meta_whatsapp_cloud_recipient_1.metaSpreadsheetRecipientDedupeKey)(normalized.waId);
        if (seen.has(dedupeKey)) {
            duplicatesRemoved += 1;
            continue;
        }
        seen.add(dedupeKey);
        const lead = {
            waId: normalized.waId,
            status: "queued",
        };
        if (needNome)
            lead.nome = cellLabel(nomeColumn ? row[nomeColumn] : "") || undefined;
        if (needNumero)
            lead.numero = cellLabel(numeroColumn ? row[numeroColumn] : "") || normalized.waId;
        if (needTexto)
            lead.texto = cellLabel(textoColumn ? row[textoColumn] : "") || undefined;
        leads.push(lead);
        if (validSamples.length < 8)
            validSamples.push({ raw: rawLabel || normalized.waId, waId: normalized.waId });
    }
    return {
        leads,
        invalid,
        duplicatesRemoved,
        truncated,
        samples: {
            valid: validSamples,
            invalid: invalid.slice(0, 8),
        },
    };
}
