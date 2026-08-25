const PREFIX = "[META][WEBHOOK]";

function sanitizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (/secret|token|authorization|access_token|app_secret|verify/i.test(key)) continue;
    if (/body|payload|text|message_body|content/i.test(key)) continue;
    out[key] = value;
  }
  return out;
}

export function logMetaWebhook(
  step: "VERIFY" | "SIGNATURE" | "RECEIVED" | "DUPLICATE" | "PROCESSED" | "ERROR",
  meta: Record<string, unknown> = {},
): void {
  const line = `${PREFIX}[${step}]`;
  if (step === "ERROR") {
    console.error(line, sanitizeMeta(meta));
    return;
  }
  console.info(line, sanitizeMeta(meta));
}
