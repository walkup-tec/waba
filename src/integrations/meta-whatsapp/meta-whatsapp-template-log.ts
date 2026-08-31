const PREFIX = "[META][TEMPLATE]";

function sanitize(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (/secret|token|authorization|access_token|app_secret|verify|encryption/i.test(key)) continue;
    out[key] = value;
  }
  return out;
}

export function logMetaTemplate(
  step: "LIST" | "CREATE" | "SYNC" | "WEBHOOK" | "ERROR",
  meta: Record<string, unknown> = {},
): void {
  const line = `${PREFIX}[${step}]`;
  if (step === "ERROR") {
    console.error(line, sanitize(meta));
    return;
  }
  console.info(line, sanitize(meta));
}
