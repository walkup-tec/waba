export function logWabaBot(
  event: string,
  data: Record<string, string | number | boolean | null | undefined>,
): void {
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(data)) {
    const k = key.toLowerCase();
    if (k.includes("token") || k.includes("secret") || k.includes("password") || k.includes("authorization")) {
      continue;
    }
    if (value === undefined) continue;
    safe[key] = value;
  }
  console.info(`[waba-bot] ${event}`, safe);
}
