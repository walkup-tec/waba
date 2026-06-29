import { reviewPushMessageWithOpenAi } from "../push/waba-push-openai.service";
import {
  dismissPushAlert,
  listPushHistory,
  sendPushMessage,
} from "../push/waba-push-delivery.service";
import {
  getPushCommunityConfig,
  loadPushCommunityConfigForAdmin,
  updatePushCommunityConfig,
} from "../push/waba-push-community.service";
import { savePushImageAttachment } from "../push/waba-push-media.service";
import type { WabaPushAudience, WabaPushImageAttachment, WabaPushUserRole } from "../push/waba-push.types";

function parseAudiences(raw: unknown): WabaPushAudience[] {
  const allowed = new Set<WabaPushAudience>(["subscribers", "users", "community", "email"]);
  const values = Array.isArray(raw) ? raw : [];
  return values
    .map((value) => String(value || "").trim() as WabaPushAudience)
    .filter((value) => allowed.has(value));
}

function parseUserRoles(raw: unknown): WabaPushUserRole[] {
  const allowed = new Set<WabaPushUserRole>(["master", "operacional", "suporte"]);
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
    image?: WabaPushImageAttachment | null;
  }) {
    const audiences = parseAudiences(input.audiences);
    const image = input.image?.id ? input.image : null;
    return sendPushMessage({
      title: String(input.title || "Comunicado WABA").trim(),
      originalText: String(input.originalText || "").trim(),
      reviewedText: String(input.reviewedText || "").trim(),
      audiences,
      userRoles: parseUserRoles(input.userRoles),
      createdByEmail: input.createdByEmail,
      image,
    });
  }

  uploadImage(file: { buffer: Buffer; originalname: string; mimetype: string }): WabaPushImageAttachment {
    return savePushImageAttachment({
      buffer: file.buffer,
      fileName: file.originalname,
      mimeType: file.mimetype,
    });
  }

  listHistory(limit = 30) {
    return listPushHistory(limit);
  }

  getCommunityConfig() {
    return getPushCommunityConfig();
  }

  async loadCommunityConfigForAdmin() {
    return loadPushCommunityConfigForAdmin();
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
