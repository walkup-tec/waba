const PREFIX = "[META][AUTOMATION]";

export type MetaAutomationLogStep =
  | "RECEIVED"
  | "MATCH"
  | "SKIP"
  | "SEND"
  | "HUMAN_TAKEOVER"
  | "ERROR";

function sanitize(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (/secret|token|authorization|access_token|app_secret|verify|encryption|textContent|body|payload/i.test(key)) {
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function logMetaAutomation(
  step: MetaAutomationLogStep,
  meta: Record<string, unknown> = {},
): void {
  const line = `${PREFIX}[${step}]`;
  if (step === "ERROR") {
    console.error(line, sanitize(meta));
    return;
  }
  console.info(line, sanitize(meta));
}
