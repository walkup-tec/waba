import type { WabaRequestAuth } from "../auth/waba-request-auth";
import { WabaSubscriberRepository } from "../subscribers/waba-subscriber.repository";
import { WabaSystemUserRepository } from "../users/waba-system-user.repository";
import { wabaMailService } from "../mail/waba-mail.service";
import { buildPushAnnouncementTemplate } from "../mail/waba-mail.templates";
import { sendPushToWhatsAppCommunity } from "./waba-push-community.service";
import { WabaPushRepository } from "./waba-push.repository";
import type {
  WabaPushAlertView,
  WabaPushAudience,
  WabaPushDeliveryResults,
  WabaPushMessage,
  WabaPushUserRole,
} from "./waba-push.types";

const pushRepository = new WabaPushRepository();
const subscriberRepository = new WabaSubscriberRepository();
const systemUserRepository = new WabaSystemUserRepository();

function normalizeEmail(value: string): string {
  return String(value || "").trim().toLowerCase();
}

function resolveStaffRecipients(roles: WabaPushUserRole[]): string[] {
  const allowed = new Set(roles.length ? roles : (["operacional", "suporte"] as WabaPushUserRole[]));
  return systemUserRepository
    .list()
    .filter((user) => user.role !== "master" && allowed.has(user.role as WabaPushUserRole))
    .map((user) => normalizeEmail(user.email))
    .filter((email) => email.includes("@"));
}

function resolveSubscriberRecipients(): string[] {
  return subscriberRepository
    .list()
    .map((row) => normalizeEmail(row.email))
    .filter((email) => email.includes("@"));
}

function resolveEmailRecipients(
  audiences: WabaPushAudience[],
  userRoles: WabaPushUserRole[],
): string[] {
  const emails = new Set<string>();
  if (audiences.includes("subscribers") || audiences.includes("email")) {
    for (const email of resolveSubscriberRecipients()) emails.add(email);
  }
  if (audiences.includes("users") || audiences.includes("email")) {
    for (const email of resolveStaffRecipients(userRoles)) emails.add(email);
  }
  if (audiences.includes("email")) {
    const master = systemUserRepository.list().find((user) => user.role === "master");
    if (master?.email) emails.add(normalizeEmail(master.email));
  }
  return Array.from(emails);
}

async function deliverEmails(title: string, text: string, recipients: string[]) {
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  if (!recipients.length) return { sent, skipped, failed };
  if (!wabaMailService.isConfigured()) {
    return { sent: 0, skipped: recipients.length, failed: 0 };
  }
  const subject = String(title || "Comunicado WABA").trim() || "Comunicado WABA";
  const template = buildPushAnnouncementTemplate({ title: subject, message: text });
  for (const toEmail of recipients) {
    try {
      await wabaMailService.send({ to: toEmail, subject: template.subject, html: template.html });
      sent += 1;
    } catch (error) {
      console.error(`[push] falha e-mail para ${toEmail}:`, error);
      failed += 1;
    }
  }
  return { sent, skipped, failed };
}

export async function sendPushMessage(input: {
  title: string;
  originalText: string;
  reviewedText: string;
  audiences: WabaPushAudience[];
  userRoles: WabaPushUserRole[];
  createdByEmail: string;
}): Promise<WabaPushMessage> {
  const audiences = Array.from(
    new Set((input.audiences || []).filter((value): value is WabaPushAudience => !!value)),
  );
  if (!audiences.length) {
    throw new Error("Selecione ao menos um destino para o push.");
  }
  const reviewedText = String(input.reviewedText || input.originalText || "").trim();
  if (!reviewedText) {
    throw new Error("Mensagem revisada vazia.");
  }

  const deliveryResults: WabaPushDeliveryResults = {};
  let hasFailure = false;

  if (audiences.includes("subscribers")) {
    deliveryResults.subscribers = { targeted: resolveSubscriberRecipients().length };
  }
  if (audiences.includes("users")) {
    const roles = input.userRoles?.length ? input.userRoles : (["operacional", "suporte"] as WabaPushUserRole[]);
    deliveryResults.users = {
      targeted: resolveStaffRecipients(roles).length,
      roles,
    };
  }
  if (audiences.includes("community")) {
    const community = await sendPushToWhatsAppCommunity(reviewedText);
    deliveryResults.community = {
      ok: community.ok,
      detail: community.detail,
      groupJid: community.groupJid,
    };
    if (!community.ok) hasFailure = true;
  }
  if (audiences.includes("email")) {
    const recipients = resolveEmailRecipients(audiences, input.userRoles || []);
    const email = await deliverEmails(input.title, reviewedText, recipients);
    deliveryResults.email = email;
    if (email.failed > 0) hasFailure = true;
  }

  const now = new Date().toISOString();
  const message: WabaPushMessage = {
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

export function listPushAlertsForAuth(auth: WabaRequestAuth): WabaPushAlertView[] {
  const email = normalizeEmail(auth.email);
  if (!email.includes("@")) return [];

  const isSubscriber = auth.role === "subscriber";
  const isStaff = auth.role === "master" || auth.role === "operacional" || auth.role === "suporte";
  if (!isSubscriber && !isStaff) return [];

  const staffRole =
    auth.role === "operacional" || auth.role === "suporte" ? (auth.role as WabaPushUserRole) : null;

  return pushRepository
    .listMessages(100)
    .filter((row) => row.status === "sent" || row.status === "partial")
    .filter((row) => {
      const dismissed = new Set((row.dismissedBy || []).map(normalizeEmail));
      if (dismissed.has(email)) return false;
      if (isSubscriber && row.audiences.includes("subscribers")) return true;
      if (!isStaff || !row.audiences.includes("users")) return false;
      const roles = row.userRoles?.length
        ? row.userRoles
        : (["operacional", "suporte"] as WabaPushUserRole[]);
      if (auth.role === "master") return true;
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

export function dismissPushAlert(pushId: string, email: string): boolean {
  return pushRepository.dismissForUser(pushId, email);
}

export function listPushHistory(limit = 30): WabaPushMessage[] {
  return pushRepository.listMessages(limit);
}
