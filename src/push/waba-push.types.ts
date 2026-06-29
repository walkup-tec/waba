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

export type WabaPushAlertView = {
  id: string;
  title: string;
  message: string;
  sentAt: string;
  imageUrl?: string | null;
};
