"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushMessage = sendPushMessage;
exports.listPushAlertsForAuth = listPushAlertsForAuth;
exports.dismissPushAlert = dismissPushAlert;
exports.listPushHistory = listPushHistory;
const waba_subscriber_repository_1 = require("../subscribers/waba-subscriber.repository");
const waba_system_user_repository_1 = require("../users/waba-system-user.repository");
const waba_mail_service_1 = require("../mail/waba-mail.service");
const waba_mail_templates_1 = require("../mail/waba-mail.templates");
const waba_push_community_service_1 = require("./waba-push-community.service");
const waba_push_repository_1 = require("./waba-push.repository");
const pushRepository = new waba_push_repository_1.WabaPushRepository();
const subscriberRepository = new waba_subscriber_repository_1.WabaSubscriberRepository();
const systemUserRepository = new waba_system_user_repository_1.WabaSystemUserRepository();
function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
}
function resolveStaffRecipients(roles) {
    const allowed = new Set(roles.length ? roles : ["operacional", "suporte"]);
    return systemUserRepository
        .list()
        .filter((user) => user.role !== "master" && allowed.has(user.role))
        .map((user) => normalizeEmail(user.email))
        .filter((email) => email.includes("@"));
}
function resolveSubscriberRecipients() {
    return subscriberRepository
        .list()
        .map((row) => normalizeEmail(row.email))
        .filter((email) => email.includes("@"));
}
function resolveEmailRecipients(audiences, userRoles) {
    const emails = new Set();
    if (audiences.includes("subscribers") || audiences.includes("email")) {
        for (const email of resolveSubscriberRecipients())
            emails.add(email);
    }
    if (audiences.includes("users") || audiences.includes("email")) {
        for (const email of resolveStaffRecipients(userRoles))
            emails.add(email);
    }
    if (audiences.includes("email")) {
        const master = systemUserRepository.list().find((user) => user.role === "master");
        if (master?.email)
            emails.add(normalizeEmail(master.email));
    }
    return Array.from(emails);
}
async function deliverEmails(title, text, recipients) {
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    if (!recipients.length)
        return { sent, skipped, failed };
    if (!waba_mail_service_1.wabaMailService.isConfigured()) {
        return { sent: 0, skipped: recipients.length, failed: 0 };
    }
    const subject = String(title || "Comunicado WABA").trim() || "Comunicado WABA";
    const template = (0, waba_mail_templates_1.buildPushAnnouncementTemplate)({ title: subject, message: text });
    for (const toEmail of recipients) {
        try {
            await waba_mail_service_1.wabaMailService.send({ to: toEmail, subject: template.subject, html: template.html });
            sent += 1;
        }
        catch (error) {
            console.error(`[push] falha e-mail para ${toEmail}:`, error);
            failed += 1;
        }
    }
    return { sent, skipped, failed };
}
async function sendPushMessage(input) {
    const audiences = Array.from(new Set((input.audiences || []).filter((value) => !!value)));
    if (!audiences.length) {
        throw new Error("Selecione ao menos um destino para o push.");
    }
    const reviewedText = String(input.reviewedText || input.originalText || "").trim();
    if (!reviewedText) {
        throw new Error("Mensagem revisada vazia.");
    }
    const deliveryResults = {};
    let hasFailure = false;
    if (audiences.includes("subscribers")) {
        deliveryResults.subscribers = { targeted: resolveSubscriberRecipients().length };
    }
    if (audiences.includes("users")) {
        const roles = input.userRoles?.length ? input.userRoles : ["operacional", "suporte"];
        deliveryResults.users = {
            targeted: resolveStaffRecipients(roles).length,
            roles,
        };
    }
    if (audiences.includes("community")) {
        const community = await (0, waba_push_community_service_1.sendPushToWhatsAppCommunity)(reviewedText);
        deliveryResults.community = {
            ok: community.ok,
            detail: community.detail,
            groupJid: community.groupJid,
        };
        if (!community.ok)
            hasFailure = true;
    }
    if (audiences.includes("email")) {
        const recipients = resolveEmailRecipients(audiences, input.userRoles || []);
        const email = await deliverEmails(input.title, reviewedText, recipients);
        deliveryResults.email = email;
        if (email.failed > 0)
            hasFailure = true;
    }
    const now = new Date().toISOString();
    const message = {
        id: pushRepository.createId(),
        title: String(input.title || "Comunicado").trim() || "Comunicado",
        originalText: String(input.originalText || "").trim(),
        reviewedText,
        audiences,
        userRoles: input.userRoles || [],
        status: hasFailure ? "partial" : "sent",
        createdByEmail: normalizeEmail(input.createdByEmail),
        createdAt: now,
        sentAt: now,
        deliveryResults,
        dismissedBy: [],
    };
    return pushRepository.save(message);
}
function listPushAlertsForAuth(auth) {
    const email = normalizeEmail(auth.email);
    if (!email.includes("@"))
        return [];
    const isSubscriber = auth.role === "subscriber";
    const isStaff = auth.role === "master" || auth.role === "operacional" || auth.role === "suporte";
    if (!isSubscriber && !isStaff)
        return [];
    const staffRole = auth.role === "operacional" || auth.role === "suporte" ? auth.role : null;
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
        const roles = row.userRoles?.length
            ? row.userRoles
            : ["operacional", "suporte"];
        if (auth.role === "master")
            return true;
        return staffRole ? roles.includes(staffRole) : false;
    })
        .slice(0, 3)
        .map((row) => ({
        id: row.id,
        title: row.title,
        message: row.reviewedText,
        sentAt: row.sentAt || row.createdAt,
    }));
}
function dismissPushAlert(pushId, email) {
    return pushRepository.dismissForUser(pushId, email);
}
function listPushHistory(limit = 30) {
    return pushRepository.listMessages(limit);
}
