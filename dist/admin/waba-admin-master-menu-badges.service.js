"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WabaAdminMasterMenuBadgesService = void 0;
const waba_billing_order_repository_1 = require("../billing/waba-billing-order.repository");
const waba_campaign_intake_repository_1 = require("../disparos/waba-campaign-intake.repository");
const waba_subscriber_repository_1 = require("../subscribers/waba-subscriber.repository");
const waba_support_ticket_repository_1 = require("../support/waba-support-ticket.repository");
const waba_system_user_repository_1 = require("../users/waba-system-user.repository");
const waba_admin_master_menu_badges_repository_1 = require("./waba-admin-master-menu-badges.repository");
const isAfterSeenAt = (itemAt, seenAt) => {
    const at = String(itemAt ?? "").trim();
    if (!at || !seenAt)
        return false;
    const itemMs = new Date(at).getTime();
    const seenMs = new Date(seenAt).getTime();
    if (Number.isNaN(itemMs) || Number.isNaN(seenMs))
        return false;
    return itemMs > seenMs;
};
class WabaAdminMasterMenuBadgesService {
    constructor(seenRepository = new waba_admin_master_menu_badges_repository_1.WabaAdminMasterMenuBadgesRepository(), subscriberRepository = new waba_subscriber_repository_1.WabaSubscriberRepository(), intakeRepository = new waba_campaign_intake_repository_1.WabaCampaignIntakeRepository(), userRepository = new waba_system_user_repository_1.WabaSystemUserRepository(), orderRepository = new waba_billing_order_repository_1.WabaBillingOrderRepository(), ticketRepository = new waba_support_ticket_repository_1.WabaSupportTicketRepository()) {
        this.seenRepository = seenRepository;
        this.subscriberRepository = subscriberRepository;
        this.intakeRepository = intakeRepository;
        this.userRepository = userRepository;
        this.orderRepository = orderRepository;
        this.ticketRepository = ticketRepository;
    }
    getBadges(masterEmail) {
        const seen = this.seenRepository.getSeenMap(masterEmail);
        return {
            "admin-assinantes": this.countNewSubscribers(seen["admin-assinantes"] ?? null),
            "admin-campanhas": this.countNewCampaigns(seen["admin-campanhas"] ?? null),
            "admin-usuarios": this.countNewUsers(seen["admin-usuarios"] ?? null),
            "admin-financeiro": this.countNewFinanceiroItems(seen["admin-financeiro"] ?? null),
            "admin-chamados": this.countNewOpenTickets(seen["admin-chamados"] ?? null),
        };
    }
    markSeen(masterEmail, menuKey) {
        if (!waba_admin_master_menu_badges_repository_1.MASTER_MENU_BADGE_KEYS.includes(menuKey)) {
            throw new Error("Menu inválido para badge master.");
        }
        this.seenRepository.markSeen(masterEmail, menuKey, new Date().toISOString());
    }
    bootstrapSeenIfEmpty(masterEmail) {
        const seen = this.seenRepository.getSeenMap(masterEmail);
        const hasAny = waba_admin_master_menu_badges_repository_1.MASTER_MENU_BADGE_KEYS.some((key) => Boolean(seen[key]));
        if (hasAny)
            return;
        const now = new Date().toISOString();
        for (const key of waba_admin_master_menu_badges_repository_1.MASTER_MENU_BADGE_KEYS) {
            this.seenRepository.markSeen(masterEmail, key, now);
        }
    }
    getBadgesForMaster(masterEmail) {
        this.bootstrapSeenIfEmpty(masterEmail);
        return this.getBadges(masterEmail);
    }
    getBadgesPayloadForMaster(masterEmail) {
        this.bootstrapSeenIfEmpty(masterEmail);
        return {
            badges: this.getBadges(masterEmail),
            seenAt: this.seenRepository.getSeenMap(masterEmail),
        };
    }
    countNewSubscribers(seenAt) {
        return this.subscriberRepository.list().filter((item) => isAfterSeenAt(item.createdAt, seenAt))
            .length;
    }
    countNewCampaigns(seenAt) {
        return this.intakeRepository.listAll().filter((item) => isAfterSeenAt(item.createdAt, seenAt))
            .length;
    }
    countNewUsers(seenAt) {
        return this.userRepository.list().filter((item) => isAfterSeenAt(item.createdAt, seenAt)).length;
    }
    countNewFinanceiroItems(seenAt) {
        return this.orderRepository
            .list()
            .filter((order) => order.product === "waba-disparos")
            .filter((order) => order.status === "pending_payment")
            .filter((order) => isAfterSeenAt(order.createdAt, seenAt)).length;
    }
    countNewOpenTickets(seenAt) {
        return this.ticketRepository
            .list()
            .filter((ticket) => ticket.status === "open")
            .filter((ticket) => isAfterSeenAt(ticket.submittedAt || ticket.createdAt, seenAt)).length;
    }
}
exports.WabaAdminMasterMenuBadgesService = WabaAdminMasterMenuBadgesService;
