import { reviewPushMessageWithOpenAi } from "../push/waba-push-openai.service";
import {
  dismissPushAlert,
  listPushHistory,
  sendPushMessage,
} from "../push/waba-push-delivery.service";
import { getPushCommunityConfig, updatePushCommunityConfig } from "../push/waba-push-community.service";
import type { WabaPushAudience, WabaPushUserRole } from "../push/waba-push.types";

function parseAudiences(raw: unknown): WabaPushAudience[] {
  const allowed = new Set<WabaPushAudience>(["subscribers", "users", "community", "email"]);
  const values = Array.isArray(raw) ? raw : [];
  return values
    .map((value) => String(value || "").trim() as WabaPushAudience)
    .filter((value) => allowed.has(value));
}

function parseUserRoles(raw: unknown): WabaPushUserRole[] {
  const allowed = new Set<WabaPushUserRole>(["operacional", "suporte"]);
  const values = Array.isArray(raw) ? raw : [];
  return values
    .map((value) => String(value || "").trim() as WabaPushUserRole)
    .filter((value) => allowed.has(value));
}

export class WabaAdminPushService {
  async reviewMessage(input: { title?: string; text: string }) {
    return reviewPushMessageWithOpenAi(input);
  }

  async publishMessage(input: {
    title?: string;
    originalText: string;
    reviewedText: string;
    audiences: WabaPushAudience[];
    userRoles?: WabaPushUserRole[];
    createdByEmail: string;
  }) {
    return sendPushMessage({
      title: String(input.title || "Comunicado WABA").trim(),
      originalText: String(input.originalText || "").trim(),
      reviewedText: String(input.reviewedText || "").trim(),
      audiences: parseAudiences(input.audiences),
      userRoles: parseUserRoles(input.userRoles),
      createdByEmail: input.createdByEmail,
    });
  }

  listHistory(limit = 30) {
    return listPushHistory(limit);
  }

  getCommunityConfig() {
    return getPushCommunityConfig();
  }

  saveCommunityConfig(input: {
    communityAnnouncementGroupJid?: string;
    communityEvoInstance?: string;
    communityInviteLink?: string;
  }) {
    return updatePushCommunityConfig(input);
  }

  dismissAlert(pushId: string, email: string) {
    return dismissPushAlert(pushId, email);
  }
}
