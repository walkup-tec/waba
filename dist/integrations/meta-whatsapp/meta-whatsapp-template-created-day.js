"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.localCalendarDateKey = localCalendarDateKey;
exports.shiftedLocalDateKey = shiftedLocalDateKey;
exports.templateMatchesCreatedDay = templateMatchesCreatedDay;
/** Chave de calendário local (YYYY-MM-DD) para o filtro Hoje/Ontem da lista. */
function localCalendarDateKey(input) {
    const date = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(date.getTime()))
        return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
function shiftedLocalDateKey(daysFromToday, now = new Date()) {
    const date = new Date(now.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + daysFromToday);
    return localCalendarDateKey(date);
}
function templateMatchesCreatedDay(createdAt, dayKey) {
    const key = String(dayKey || "").trim();
    if (!key)
        return true;
    const raw = String(createdAt || "").trim();
    if (!raw)
        return false;
    return localCalendarDateKey(raw) === key;
}
