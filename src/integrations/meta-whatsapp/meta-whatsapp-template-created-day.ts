/** Chave de calendário local (YYYY-MM-DD) para o filtro Hoje/Ontem da lista. */
export function localCalendarDateKey(input: Date | string): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftedLocalDateKey(daysFromToday: number, now = new Date()): string {
  const date = new Date(now.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  return localCalendarDateKey(date);
}

export function templateMatchesCreatedDay(
  createdAt: string | null | undefined,
  dayKey: string,
): boolean {
  const key = String(dayKey || "").trim();
  if (!key) return true;
  const raw = String(createdAt || "").trim();
  if (!raw) return false;
  return localCalendarDateKey(raw) === key;
}
