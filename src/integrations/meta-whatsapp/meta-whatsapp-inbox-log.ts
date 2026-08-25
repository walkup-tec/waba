const PREFIX = "[META][INBOX]";

function sanitize(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (/secret|token|authorization|access_token|app_secret|verify|encryption/i.test(key)) continue;
    out[key] = value;
  }
  return out;
}

export function logMetaInbox(
  step: "LIST" | "THREAD" | "READ" | "STATUS" | "ASSIGN" | "SEND" | "ERROR",
  meta: Record<string, unknown> = {},
): void {
  const line = `${PREFIX}[${step}]`;
  if (step === "ERROR") {
    console.error(line, sanitize(meta));
    return;
  }
  console.info(line, sanitize(meta));
}
