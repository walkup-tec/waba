export type BotTypingHint = {
  type?: string;
  text?: string;
};

let waitImpl: (ms: number) => Promise<void> = (ms) =>
  ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

export function setBotTypingWaitForTests(fn: ((ms: number) => Promise<void>) | null): void {
  waitImpl = fn || ((ms) => (ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve()));
}

/** Tempo dos 3 pontinhos antes do envio. Mídia/link ficam um pouco mais. */
export function botTypingDelayMs(input: BotTypingHint = {}): number {
  const type = String(input.type || "text").trim().toLowerCase();
  if (type === "video" || type === "document" || type === "audio" || type === "cta_url") {
    return 1800;
  }
  const len = String(input.text || "").trim().length;
  return Math.max(1200, Math.min(4000, 900 + len * 35));
}

export async function waitBotTyping(ms: number): Promise<void> {
  await waitImpl(Math.max(0, Math.floor(Number(ms) || 0)));
}
