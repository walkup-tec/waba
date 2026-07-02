import { WabaBillingOrderRepository } from "../billing/waba-billing-order.repository";
import { WabaCampaignIntakeRepository } from "../disparos/waba-campaign-intake.repository";
import { WabaSubscriberRepository } from "../subscribers/waba-subscriber.repository";
import { WabaSupportTicketRepository } from "../support/waba-support-ticket.repository";
import { WabaSystemUserRepository } from "../users/waba-system-user.repository";
import {
  MASTER_MENU_BADGE_KEYS,
  type MasterMenuBadgeKey,
  WabaAdminMasterMenuBadgesRepository,
} from "./waba-admin-master-menu-badges.repository";

const isAfterSeenAt = (itemAt: string | null | undefined, seenAt: string | null): boolean => {
  const at = String(itemAt ?? "").trim();
  if (!at || !seenAt) return false;
  const itemMs = new Date(at).getTime();
  const seenMs = new Date(seenAt).getTime();
  if (Number.isNaN(itemMs) || Number.isNaN(seenMs)) return false;
  return itemMs > seenMs;
};

export class WabaAdminMasterMenuBadgesService {
  constructor(
    private readonly seenRepository = new WabaAdminMasterMenuBadgesRepository(),
    private readonly subscriberRepository = new WabaSubscriberRepository(),
    private readonly intakeRepository = new WabaCampaignIntakeRepository(),
    private readonly userRepository = new WabaSystemUserRepository(),
    private readonly orderRepository = new WabaBillingOrderRepository(),
    private readonly ticketRepository = new WabaSupportTicketRepository(),
  ) {}

  getBadges(masterEmail: string): Record<MasterMenuBadgeKey, number> {
    const seen = this.seenRepository.getSeenMap(masterEmail);
    return {
      "admin-assinantes": this.countNewSubscribers(seen["admin-assinantes"] ?? null),
      "admin-campanhas": this.countNewCampaigns(seen["admin-campanhas"] ?? null),
      "admin-usuarios": this.countNewUsers(seen["admin-usuarios"] ?? null),
      "admin-financeiro": this.countNewFinanceiroItems(seen["admin-financeiro"] ?? null),
      "admin-chamados": this.countNewOpenTickets(seen["admin-chamados"] ?? null),
    };
  }

  markSeen(masterEmail: string, menuKey: MasterMenuBadgeKey) {
    if (!MASTER_MENU_BADGE_KEYS.includes(menuKey)) {
      throw new Error("Menu inválido para badge master.");
    }
    this.seenRepository.markSeen(masterEmail, menuKey, new Date().toISOString());
  }

  private bootstrapSeenIfEmpty(masterEmail: string) {
    const seen = this.seenRepository.getSeenMap(masterEmail);
    const hasAny = MASTER_MENU_BADGE_KEYS.some((key) => Boolean(seen[key]));
    if (hasAny) return;
    const now = new Date().toISOString();
    for (const key of MASTER_MENU_BADGE_KEYS) {
      this.seenRepository.markSeen(masterEmail, key, now);
    }
  }

  getBadgesForMaster(masterEmail: string): Record<MasterMenuBadgeKey, number> {
    this.bootstrapSeenIfEmpty(masterEmail);
    return this.getBadges(masterEmail);
  }

  getBadgesPayloadForMaster(masterEmail: string): {
    badges: Record<MasterMenuBadgeKey, number>;
    seenAt: Partial<Record<MasterMenuBadgeKey, string>>;
  } {
    this.bootstrapSeenIfEmpty(masterEmail);
    return {
      badges: this.getBadges(masterEmail),
      seenAt: this.seenRepository.getSeenMap(masterEmail),
    };
  }

  private countNewSubscribers(seenAt: string | null): number {
    return this.subscriberRepository.list().filter((item) => isAfterSeenAt(item.createdAt, seenAt))
      .length;
  }

  private countNewCampaigns(seenAt: string | null): number {
    return this.intakeRepository.listAll().filter((item) => isAfterSeenAt(item.createdAt, seenAt))
      .length;
  }

  private countNewUsers(seenAt: string | null): number {
    return this.userRepository.list().filter((item) => isAfterSeenAt(item.createdAt, seenAt)).length;
  }

  private countNewFinanceiroItems(seenAt: string | null): number {
    return this.orderRepository
      .list()
      .filter((order) => order.product === "waba-disparos")
      .filter((order) => order.status === "pending_payment")
      .filter((order) => isAfterSeenAt(order.createdAt, seenAt)).length;
  }

  private countNewOpenTickets(seenAt: string | null): number {
    return this.ticketRepository
      .list()
      .filter((ticket) => ticket.status === "open")
      .filter((ticket) => isAfterSeenAt(ticket.submittedAt || ticket.createdAt, seenAt)).length;
  }
}
