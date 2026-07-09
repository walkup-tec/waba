/** Serializa POSTs concorrentes com a mesma chave (clientRequestId ou fingerprint). */
const submissionLocks = new Map<string, Promise<void>>();

export const withCampaignIntakeSubmissionLock = async <T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> => {
  const normalized = String(key || "").trim();
  if (!normalized) return fn();

  while (submissionLocks.has(normalized)) {
    await submissionLocks.get(normalized);
  }

  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  submissionLocks.set(normalized, gate);
  try {
    return await fn();
  } finally {
    submissionLocks.delete(normalized);
    release();
  }
};

export const buildCampaignIntakeSubmissionFingerprint = (input: {
  campaignName: string;
  regionDdd: string;
  plannedSendCount: number;
  apiKind: string;
  imageByteLength: number;
  spreadsheetByteLength: number;
}): string => {
  const parts = [
    String(input.campaignName || "").trim().toLowerCase(),
    String(input.regionDdd || "").trim(),
    String(Math.max(0, Math.round(Number(input.plannedSendCount || 0)))),
    String(input.apiKind || "").trim().toLowerCase(),
    String(Math.max(0, Math.round(Number(input.imageByteLength || 0)))),
    String(Math.max(0, Math.round(Number(input.spreadsheetByteLength || 0)))),
  ];
  return parts.join("|");
};

export const resolveCampaignIntakeDuplicateWindowMs = (): number => {
  const raw = process.env.WABA_CAMPAIGN_INTAKE_DUPLICATE_WINDOW_MS;
  if (raw !== undefined && String(raw).trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 30_000) return Math.min(600_000, Math.round(n));
  }
  return 300_000;
};
