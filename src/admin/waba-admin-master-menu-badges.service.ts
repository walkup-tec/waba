import { WabaBillingOrderRepository } from "../billing/waba-billing-order.repository";
import { WabaCampaignIntakeRepository } from "../disparos/waba-campaign-intake.repository";
import { WabaSubscriberRepository, type WabaSubscriber } from "../subscribers/waba-subscriber.repository";
import { WabaSupportTicketRepository } from "../support/waba-support-ticket.repository";
import { WabaSystemUserRepository } from "../users/waba-system-user.repository";
import { canViewerSeeSubscriber } from "../users/waba-subscriber-master-visibility";
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
    const byEmail = this.subscribersByEmail();
    return {
      "admin-assinantes": this.countNewSubscribers(masterEmail, seen["admin-assinantes"] ?? null, byEmail),
      "admin-campanhas": this.countNewCampaigns(masterEmail, seen["admin-campanhas"] ?? null, byEmail),
      "admin-usuarios": this.countNewUsers(seen["admin-usuarios"] ?? null),
      "admin-financeiro": this.countNewFinanceiroItems(
        masterEmail,
        seen["admin-financeiro"] ?? null,
        byEmail,
      ),
      "admin-chamados": this.countNewOpenTickets(masterEmail, seen["admin-chamados"] ?? null, byEmail),
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

  private subscribersByEmail(): Map<string, WabaSubscriber> {
    const map = new Map<string, WabaSubscriber>();
    for (const item of this.subscriberRepository.list()) {
      const email = String(item.email || "").trim().toLowerCase();
      if (email) map.set(email, item);
    }
    return map;
  }

  private viewerCanSeeOwner(
    viewerEmail: string,
    ownerEmail: string,
    byEmail: Map<string, WabaSubscriber>,
  ): boolean {
    const owner = String(ownerEmail || "").trim().toLowerCase();
    return canViewerSeeSubscriber(viewerEmail, byEmail.get(owner) ?? null);
  }

  private countNewSubscribers(
    viewerEmail: string,
    seenAt: string | null,
    byEmail: Map<string, WabaSubscriber>,
  ): number {
    return this.subscriberRepository
      .list()
      .filter((item) => this.viewerCanSeeOwner(viewerEmail, item.email, byEmail))
      .filter((item) => isAfterSeenAt(item.createdAt, seenAt)).length;
  }

  private countNewCampaigns(
    viewerEmail: string,
    seenAt: string | null,
    byEmail: Map<string, WabaSubscriber>,
  ): number {
    return this.intakeRepository
      .listAll()
      .filter((item) => this.viewerCanSeeOwner(viewerEmail, item.ownerEmail, byEmail))
      .filter((item) => isAfterSeenAt(item.createdAt, seenAt)).length;
  }

  private countNewUsers(seenAt: string | null): number {
    return this.userRepository.list().filter((item) => isAfterSeenAt(item.createdAt, seenAt)).length;
  }

  private countNewFinanceiroItems(
    viewerEmail: string,
    seenAt: string | null,
    byEmail: Map<string, WabaSubscriber>,
  ): number {
    return this.orderRepository
      .list()
      .filter((order) => order.product === "waba-disparos")
      .filter((order) => order.status === "pending_payment")
      .filter((order) => this.viewerCanSeeOwner(viewerEmail, order.ownerEmail, byEmail))
      .filter((order) => isAfterSeenAt(order.createdAt, seenAt)).length;
  }

  private countNewOpenTickets(
    viewerEmail: string,
    seenAt: string | null,
    byEmail: Map<string, WabaSubscriber>,
  ): number {
    return this.ticketRepository
      .list()
      .filter((ticket) => ticket.status === "open")
      .filter((ticket) => this.viewerCanSeeOwner(viewerEmail, ticket.ownerEmail, byEmail))
      .filter((ticket) => isAfterSeenAt(ticket.submittedAt || ticket.createdAt, seenAt)).length;
  }
}
