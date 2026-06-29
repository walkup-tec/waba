"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaAdminPushService = void 0;
const waba_push_openai_service_1 = require("../push/waba-push-openai.service");
const waba_push_delivery_service_1 = require("../push/waba-push-delivery.service");
const waba_push_community_service_1 = require("../push/waba-push-community.service");
const waba_push_media_service_1 = require("../push/waba-push-media.service");
function parseAudiences(raw) {
    const allowed = new Set(["subscribers", "users", "community", "email"]);
    const values = Array.isArray(raw) ? raw : [];
    return values
        .map((value) => String(value || "").trim())
        .filter((value) => allowed.has(value));
}
function parseUserRoles(raw) {
    const allowed = new Set(["master", "operacional", "suporte"]);
    const values = Array.isArray(raw) ? raw : [];
    return values
        .map((value) => String(value || "").trim())
        .filter((value) => allowed.has(value));
}
class WabaAdminPushService {
    async reviewMessage(input) {
        return (0, waba_push_openai_service_1.reviewPushMessageWithOpenAi)(input);
    }
    async publishMessage(input) {
        const audiences = parseAudiences(input.audiences);
        const image = input.image?.id ? input.image : null;
        return (0, waba_push_delivery_service_1.sendPushMessage)({
            title: String(input.title || "Comunicado WABA").trim(),
            originalText: String(input.originalText || "").trim(),
            reviewedText: String(input.reviewedText || "").trim(),
            audiences,
            userRoles: parseUserRoles(input.userRoles),
            createdByEmail: input.createdByEmail,
            image,
        });
    }
    uploadImage(file) {
        return (0, waba_push_media_service_1.savePushImageAttachment)({
            buffer: file.buffer,
            fileName: file.originalname,
            mimeType: file.mimetype,
        });
    }
    listHistory(limit = 30) {
        return (0, waba_push_delivery_service_1.listPushHistory)(limit);
    }
    getCommunityConfig() {
        return (0, waba_push_community_service_1.getPushCommunityConfig)();
    }
    async loadCommunityConfigForAdmin() {
        return (0, waba_push_community_service_1.loadPushCommunityConfigForAdmin)();
    }
    saveCommunityConfig(input) {
        return (0, waba_push_community_service_1.updatePushCommunityConfig)(input);
    }
    dismissAlert(pushId, email) {
        return (0, waba_push_delivery_service_1.dismissPushAlert)(pushId, email);
    }
}
exports.WabaAdminPushService = WabaAdminPushService;
