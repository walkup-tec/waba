/**
 * Botão silencioso injetado só no POST Graph.
 * Tipo Meta: QUICK_REPLY ("Personalizado" no Gerenciador).
 * Docs: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components/
 * Agrupamento obrigatório: todos os não-QR juntos, todos os QR juntos.
 * Ordem WABA: botão do usuário (URL/PHONE) primeiro, depois Bloquear.
 */

export const META_SILENT_BLOCK_BUTTON_TEXT = "Bloquear";

export const META_SILENT_BLOCK_BUTTON = {
  type: "QUICK_REPLY",
  text: META_SILENT_BLOCK_BUTTON_TEXT,
} as const;

const MAX_TEMPLATE_BUTTONS = 10;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function isSilentBlockButton(raw: unknown): boolean {
  const row = asRecord(raw);
  return (
    String(row.type || "").trim().toUpperCase() === "QUICK_REPLY" &&
    String(row.text || "").trim().toLowerCase() === META_SILENT_BLOCK_BUTTON_TEXT.toLowerCase()
  );
}

function groupButtonsForMeta(buttons: Record<string, unknown>[]): Record<string, unknown>[] {
  const nonQr = buttons.filter((item) => String(item.type || "").trim().toUpperCase() !== "QUICK_REPLY");
  const qr = buttons.filter((item) => String(item.type || "").trim().toUpperCase() === "QUICK_REPLY");
  return [...nonQr, ...qr];
}

export function appendSilentBlockButton(
  components: Record<string, unknown>[],
): Record<string, unknown>[] {
  const silent: Record<string, unknown> = {
    type: META_SILENT_BLOCK_BUTTON.type,
    text: META_SILENT_BLOCK_BUTTON.text,
  };
  const next = components.map((item) => ({ ...item }));
  const index = next.findIndex((item) => String(item.type || "").trim().toUpperCase() === "BUTTONS");
  if (index < 0) {
    next.push({ type: "BUTTONS", buttons: [silent] });
    return next;
  }
  const existing = Array.isArray(next[index].buttons) ? next[index].buttons : [];
  const withoutSilent = existing
    .filter((item) => !isSilentBlockButton(item))
    .map((item) => asRecord(item));
  const userButtons = withoutSilent.slice(0, MAX_TEMPLATE_BUTTONS - 1);
  next[index] = {
    ...next[index],
    buttons: groupButtonsForMeta([...userButtons, silent]),
  };
  return next;
}

export function stripSilentBlockButtonsFromPublicComponents(components: unknown): unknown {
  if (!Array.isArray(components)) return components;
  const next = components
    .map((item) => {
      const row = asRecord(item);
      if (String(row.type || "").trim().toUpperCase() !== "BUTTONS") return item;
      const buttons = Array.isArray(row.buttons) ? row.buttons.filter((button) => !isSilentBlockButton(button)) : [];
      if (!buttons.length) return null;
      return { ...row, buttons };
    })
    .filter((item) => item != null);
  return next;
}
