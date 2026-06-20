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
exports.countSpreadsheetImportedRows = countSpreadsheetImportedRows;
exports.trimSpreadsheetBufferToRowCount = trimSpreadsheetBufferToRowCount;
const XLSX = __importStar(require("xlsx"));
/** Conta linhas de dados da primeira aba (mesma regra do preview no painel). */
function countSpreadsheetImportedRows(buffer) {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName)
        return 0;
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    return rows.length;
}
/** Mantém somente as primeiras `maxRows` linhas de dados da primeira aba. */
function trimSpreadsheetBufferToRowCount(buffer, maxRows) {
    const rowLimit = Math.max(0, Math.round(Number(maxRows) || 0));
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheetName = wb.SheetNames[0] || "Leads";
    const sheet = wb.Sheets[sheetName];
    const rows = sheet
        ? XLSX.utils.sheet_to_json(sheet, { defval: "" })
        : [];
    const trimmedRows = rowLimit > 0 ? rows.slice(0, rowLimit) : [];
    const nextSheet = XLSX.utils.json_to_sheet(trimmedRows);
    const nextWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(nextWorkbook, nextSheet, sheetName);
    return Buffer.from(XLSX.write(nextWorkbook, { type: "buffer", bookType: "xlsx" }));
}
