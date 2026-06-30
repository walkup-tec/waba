export type WabaPushAudience = "subscribers" | "users" | "community" | "email";

export type WabaPushUserRole = "master" | "operacional" | "suporte";

export type WabaPushImageAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type WabaPushStatus = "draft" | "sent" | "partial" | "failed";

export type WabaPushDeliveryResults = {
  subscribers?: { targeted: number };
  users?: { targeted: number; roles: WabaPushUserRole[] };
  community?: { ok: boolean; detail: string; groupJid?: string };
  email?: { sent: number; skipped: number; failed: number };
};

export type WabaPushMessage = {
  id: string;
  title: string;
  originalText: string;
  reviewedText: string;
  image: WabaPushImageAttachment | null;
  audiences: WabaPushAudience[];
  userRoles: WabaPushUserRole[];
  status: WabaPushStatus;
  createdByEmail: string;
  createdAt: string;
  sentAt: string | null;
  deliveryResults: WabaPushDeliveryResults | null;
  dismissedBy: string[];
};

export type WabaPushConfig = {
  communityInviteLink: string;
  communityAnnouncementGroupJid: string;
  communityEvoInstance: string;
  updatedAt: string;
};

/** Instância Evolution admin da comunidade WhatsApp (override: WABA_PUSH_COMMUNITY_EVO_INSTANCE). */
export function resolveDefaultPushCommunityEvoInstance(): string {
  const fromEnv = String(process.env.WABA_PUSH_COMMUNITY_EVO_INSTANCE || "").trim();
  if (fromEnv) return fromEnv;
  return "Drax Sistemas 5181077770";
}

export function resolvePushCommunityEvoInstanceFallbacks(): string[] {
  const fromEnv = String(process.env.WABA_PUSH_COMMUNITY_EVO_INSTANCE_FALLBACKS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (fromEnv.length) return fromEnv;
  return ["Drax Sistemas 5181077770", "drax-oficial"];
}

export const LEGACY_WRONG_PUSH_COMMUNITY_INSTANCES = new Set([
  "walkup",
  "drax sistemas 5181076973",
]);

export type WabaPushAlertView = {
  id: string;
  title: string;
  message: string;
  sentAt: string;
  imageUrl?: string | null;
};
