"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.acceptPushMessage = acceptPushMessage;
exports.deliverPushMessageById = deliverPushMessageById;
exports.sendPushMessage = sendPushMessage;
exports.getPushMessageById = getPushMessageById;
exports.listPushAlertsForAuth = listPushAlertsForAuth;
exports.dismissPushAlert = dismissPushAlert;
exports.listPushHistory = listPushHistory;
const waba_subscriber_repository_1 = require("../subscribers/waba-subscriber.repository");
const waba_system_user_repository_1 = require("../users/waba-system-user.repository");
const waba_mail_service_1 = require("../mail/waba-mail.service");
const waba_mail_templates_1 = require("../mail/waba-mail.templates");
const waba_push_community_service_1 = require("./waba-push-community.service");
const waba_push_openai_service_1 = require("./waba-push-openai.service");
const waba_push_repository_1 = require("./waba-push.repository");
const pushRepository = new waba_push_repository_1.WabaPushRepository();
const subscriberRepository = new waba_subscriber_repository_1.WabaSubscriberRepository();
const systemUserRepository = new waba_system_user_repository_1.WabaSystemUserRepository();
const DEDUPE_WINDOW_MS = 90000;
let preparePushChain = Promise.resolve();
const pushInFlightFingerprints = new Set();
function runPreparePushLocked(fn) {
    const next = preparePushChain.then(() => Promise.resolve().then(fn));
    preparePushChain = next.then(() => undefined, () => undefined);
    return next;
}
function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
}
function resolveStaffRecipients(roles) {
    const allowed = new Set(roles.length ? roles : ["operacional", "suporte"]);
    return systemUserRepository
        .list()
        .filter((user) => allowed.has(user.role))
        .map((user) => normalizeEmail(user.email))
        .filter((email) => email.includes("@"));
}
function resolveSubscriberRecipients() {
    return subscriberRepository
        .list()
        .map((row) => normalizeEmail(row.email))
        .filter((email) => email.includes("@"));
}
function resolveDefaultUserRoles(userRoles) {
    return userRoles?.length ? userRoles : ["operacional", "suporte"];
}
function resolveEmailRecipients(audiences, userRoles) {
    if (!audiences.includes("email"))
        return [];
    const emails = new Set();
    const wantsSubscribers = audiences.includes("subscribers");
    const wantsUsers = audiences.includes("users");
    const broadcastEmailOnly = !wantsSubscribers && !wantsUsers;
    if (wantsSubscribers || broadcastEmailOnly) {
        for (const email of resolveSubscriberRecipients())
            emails.add(email);
    }
    if (wantsUsers || broadcastEmailOnly) {
        for (const email of resolveStaffRecipients(resolveDefaultUserRoles(userRoles))) {
            emails.add(email);
        }
    }
    return Array.from(emails);
}
function buildPushFingerprint(input) {
    return [
        normalizeEmail(input.createdByEmail),
        String(input.title || "").trim().toLowerCase(),
        String(input.reviewedText || "").trim(),
        [...input.audiences].sort().join(","),
        [...input.userRoles].sort().join(","),
        String(input.image?.id || ""),
    ].join("||");
}
function findRecentDuplicate(input) {
    const cutoff = Date.now() - DEDUPE_WINDOW_MS;
    const audienceKey = [...input.audiences].sort().join(",");
    const rolesKey = [...input.userRoles].sort().join(",");
    const imageId = String(input.image?.id || "");
    const titleKey = String(input.title || "").trim().toLowerCase();
    return (pushRepository
        .listMessages(20)
        .find((row) => {
        if (normalizeEmail(row.createdByEmail) !== normalizeEmail(input.createdByEmail))
            return false;
        if (new Date(row.createdAt).getTime() < cutoff)
            return false;
        if (String(row.title || "").trim().toLowerCase() !== titleKey)
            return false;
        if (row.reviewedText !== input.reviewedText)
            return false;
        if ([...row.audiences].sort().join(",") !== audienceKey)
            return false;
        if ([...row.userRoles].sort().join(",") !== rolesKey)
            return false;
        if (String(row.image?.id || "") !== imageId)
            return false;
        return row.status === "sent" || row.status === "partial" || row.status === "sending";
    }) ?? null);
}
async function deliverEmails(title, text, recipients, imageUrl) {
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    if (!recipients.length)
        return { sent, skipped, failed };
    if (!waba_mail_service_1.wabaMailService.isConfigured()) {
        return { sent: 0, skipped: recipients.length, failed: 0 };
    }
    const subject = String(title || "Comunicado WABA").trim() || "Comunicado WABA";
    const template = (0, waba_mail_templates_1.buildPushAnnouncementTemplate)({
        title: subject,
        message: text,
        imageUrl,
    });
    const outcomes = await Promise.all(recipients.map(async (toEmail) => {
        const normalized = normalizeEmail(toEmail);
        if (!normalized.includes("@"))
            return "skip";
        try {
            await waba_mail_service_1.wabaMailService.send({ to: normalized, subject: template.subject, html: template.html });
            return "sent";
        }
        catch (error) {
            console.error(`[push] falha e-mail para ${normalized}:`, error);
            return "failed";
        }
    }));
    sent = outcomes.filter((row) => row === "sent").length;
    failed = outcomes.filter((row) => row === "failed").length;
    return { sent, skipped, failed };
}
function validatePushInput(input) {
    const audiences = Array.from(new Set((input.audiences || []).filter((value) => !!value)));
    if (!audiences.length) {
        throw new Error("Selecione ao menos um destino para o push.");
    }
    const hasNonCommunityAudience = audiences.some((audience) => audience === "subscribers" || audience === "users" || audience === "email");
    if (!input.reviewedText && !input.image) {
        throw new Error("Informe a mensagem ou uma imagem para o push.");
    }
    if (!input.reviewedText && hasNonCommunityAudience) {
        throw new Error("Informe o texto para assinantes, usuários e e-mail. A imagem é enviada apenas à comunidade WhatsApp.");
    }
    if (input.image && !audiences.includes("community")) {
        throw new Error("A imagem só pode ser enviada quando o destino Comunidade WhatsApp estiver marcado.");
    }
    if (audiences.includes("community") && !String(input.title || "").trim()) {
        throw new Error("Informe o título para publicar na comunidade WhatsApp.");
    }
    return audiences;
}
function preparePushMessage(input) {
    const image = input.image?.id ? input.image : null;
    const pushTitle = String(input.title || "Comunicado").trim() || "Comunicado";
    const reviewedText = (0, waba_push_openai_service_1.sanitizeReviewedPushText)(String(input.reviewedText || input.originalText || "").trim());
    const audiences = validatePushInput({ title: pushTitle, audiences: input.audiences, reviewedText, image });
    const userRoles = input.userRoles || [];
    const fingerprint = buildPushFingerprint({
        title: pushTitle,
        reviewedText,
        audiences,
        userRoles,
        createdByEmail: input.createdByEmail,
        image,
    });
    if (pushInFlightFingerprints.has(fingerprint)) {
        const duplicate = findRecentDuplicate({
            title: pushTitle,
            reviewedText,
            audiences,
            userRoles,
            createdByEmail: input.createdByEmail,
            image,
        }) ?? null;
        if (duplicate)
            return { deduplicated: true, message: duplicate };
    }
    const duplicate = findRecentDuplicate({
        title: pushTitle,
        reviewedText,
        audiences,
        userRoles,
        createdByEmail: input.createdByEmail,
        image,
    });
    if (duplicate) {
        return { deduplicated: true, message: duplicate };
    }
    pushInFlightFingerprints.add(fingerprint);
    const now = new Date().toISOString();
    const pendingMessage = {
        id: pushRepository.createId(),
        title: pushTitle,
        originalText: String(input.originalText || "").trim(),
        reviewedText,
        image,
        audiences,
        userRoles,
        status: "sending",
        createdByEmail: normalizeEmail(input.createdByEmail),
        createdAt: now,
        sentAt: now,
        deliveryResults: {},
        dismissedBy: [],
    };
    pushRepository.save(pendingMessage);
    return { deduplicated: false, message: pendingMessage, fingerprint };
}
async function deliverPreparedPushMessage(messageId, fingerprint) {
    try {
        const current = pushRepository.getById(messageId);
        if (!current || current.status !== "sending")
            return;
        const deliveryResults = {};
        let hasFailure = false;
        const audiences = current.audiences;
        const userRoles = current.userRoles || [];
        if (audiences.includes("subscribers")) {
            deliveryResults.subscribers = { targeted: resolveSubscriberRecipients().length };
        }
        if (audiences.includes("users")) {
            const roles = resolveDefaultUserRoles(userRoles);
            deliveryResults.users = {
                targeted: resolveStaffRecipients(roles).length,
                roles,
            };
        }
        const parallelTasks = [];
        if (audiences.includes("community")) {
            parallelTasks.push((0, waba_push_community_service_1.sendPushToWhatsAppCommunity)(current.title, current.reviewedText, current.image).then((community) => {
                deliveryResults.community = {
                    ok: community.ok,
                    detail: community.detail,
                    groupJid: community.groupJid,
                };
                if (!community.ok)
                    hasFailure = true;
            }));
        }
        if (audiences.includes("email")) {
            const recipients = resolveEmailRecipients(audiences, userRoles);
            parallelTasks.push(deliverEmails(current.title, current.reviewedText, recipients, null).then((email) => {
                deliveryResults.email = email;
                if (email.failed > 0)
                    hasFailure = true;
            }));
        }
        if (parallelTasks.length)
            await Promise.all(parallelTasks);
        pushRepository.save({
            ...current,
            status: hasFailure ? "partial" : "sent",
            sentAt: current.sentAt || new Date().toISOString(),
            deliveryResults,
        });
    }
    catch (error) {
        const current = pushRepository.getById(messageId);
        if (current) {
            pushRepository.save({
                ...current,
                status: "failed",
                sentAt: current.sentAt || new Date().toISOString(),
                deliveryResults: {
                    ...(current.deliveryResults || {}),
                    community: {
                        ok: false,
                        detail: error instanceof Error ? error.message : "Falha inesperada no envio do push.",
                    },
                },
            });
        }
        console.error(`[push] falha ao entregar push ${messageId}:`, error);
    }
    finally {
        pushInFlightFingerprints.delete(fingerprint);
    }
}
async function acceptPushMessage(input) {
    return runPreparePushLocked(async () => {
        const prepared = preparePushMessage(input);
        if (prepared.deduplicated) {
            return { message: prepared.message, deduplicated: true };
        }
        return {
            message: prepared.message,
            deduplicated: false,
            accepted: true,
            fingerprint: String(prepared.fingerprint || ""),
        };
    });
}
function deliverPushMessageById(messageId, fingerprint) {
    void deliverPreparedPushMessage(messageId, fingerprint);
}
async function sendPushMessage(input) {
    const accepted = await acceptPushMessage(input);
    if (accepted.deduplicated || !accepted.fingerprint) {
        return accepted;
    }
    await deliverPreparedPushMessage(accepted.message.id, accepted.fingerprint);
    const finalMessage = pushRepository.getById(accepted.message.id) || accepted.message;
    return { message: finalMessage, deduplicated: false };
}
function getPushMessageById(id) {
    return pushRepository.getById(id);
}
function listPushAlertsForAuth(auth) {
    const email = normalizeEmail(auth.email);
    if (!email.includes("@"))
        return [];
    const isSubscriber = auth.role === "subscriber";
    const isStaff = auth.role === "master" || auth.role === "operacional" || auth.role === "suporte";
    if (!isSubscriber && !isStaff)
        return [];
    const staffRole = auth.role === "master" || auth.role === "operacional" || auth.role === "suporte"
        ? auth.role
        : null;
    return pushRepository
        .listMessages(100)
        .filter((row) => row.status === "sent" || row.status === "partial")
        .filter((row) => {
        const dismissed = new Set((row.dismissedBy || []).map(normalizeEmail));
        if (dismissed.has(email))
            return false;
        if (isSubscriber && row.audiences.includes("subscribers"))
            return true;
        if (!isStaff || !row.audiences.includes("users"))
            return false;
        const roles = resolveDefaultUserRoles(row.userRoles || []);
        return staffRole ? roles.includes(staffRole) : false;
    })
        .slice(0, 3)
        .map((row) => ({
        id: row.id,
        title: row.title,
        message: row.reviewedText,
        sentAt: row.sentAt || row.createdAt,
        imageUrl: null,
    }));
}
function dismissPushAlert(pushId, email) {
    return pushRepository.dismissForUser(pushId, email);
}
function listPushHistory(limit = 30) {
    return pushRepository.listMessages(limit).map((row) => ({
        ...row,
        image: row.image?.id ? row.image : null,
    }));
}
