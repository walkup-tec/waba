import { WabaDisparosCreditsService } from "../billing/waba-disparos-credits.service";
import {
  WabaCampaignIntakeRepository,
  type WabaCampaignIntake,
} from "../disparos/waba-campaign-intake.repository";
import { WabaSubscriberRepository } from "../subscribers/waba-subscriber.repository";

export type AdminSubscriberListItem = {
  id: string;
  email: string;
  fullName: string;
  cpfCnpj: string;
  cpfCnpjFormatted: string;
  createdAt: string;
  createdAtLabel: string;
  creditsValueCents: number;
  creditsValueLabel: string;
  contractedShipments: number;
  campaignsAwaiting: number;
  campaignsCompleted: number;
};

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const formatCpfCnpj = (raw: string): string => {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return digits || "—";
};

const formatCreatedAtLabel = (iso: string): string => {
  const value = String(iso ?? "").trim();
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatMoneyFromCents = (cents: number): string => {
  const value = Number(cents || 0) / 100;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const normalizeIntakeStatus = (status: string): string =>
  String(status || "")
    .trim()
    .toLowerCase();

const isCampaignAwaiting = (intake: WabaCampaignIntake): boolean => {
  const status = normalizeIntakeStatus(intake.status);
  return status === "generated" || status === "pending_review" || status === "in_progress";
};

const isCampaignCompleted = (intake: WabaCampaignIntake): boolean =>
  normalizeIntakeStatus(intake.status) === "completed";

export class WabaAdminSubscribersService {
  constructor(
    private readonly subscriberRepository = new WabaSubscriberRepository(),
    private readonly creditsService = new WabaDisparosCreditsService(),
    private readonly intakeRepository = new WabaCampaignIntakeRepository(),
  ) {}

  listSubscribers(): AdminSubscriberListItem[] {
    const intakesByEmail = new Map<string, WabaCampaignIntake[]>();
    for (const intake of this.intakeRepository.listAll()) {
      const email = normalizeEmail(intake.ownerEmail);
      if (!email) continue;
      const bucket = intakesByEmail.get(email) ?? [];
      bucket.push(intake);
      intakesByEmail.set(email, bucket);
    }

    return this.subscriberRepository
      .list()
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((subscriber) => {
        const email = normalizeEmail(subscriber.email);
        const credits = this.creditsService.getCreditsSummary(email);
        const intakes = intakesByEmail.get(email) ?? [];

        return {
          id: subscriber.id,
          email,
          fullName: subscriber.fullName,
          cpfCnpj: subscriber.cpfCnpj,
          cpfCnpjFormatted: formatCpfCnpj(subscriber.cpfCnpj),
          createdAt: subscriber.createdAt,
          createdAtLabel: formatCreatedAtLabel(subscriber.createdAt),
          creditsValueCents: credits.contractedValueCents,
          creditsValueLabel: formatMoneyFromCents(credits.contractedValueCents),
          contractedShipments: credits.contractedShipments,
          campaignsAwaiting: intakes.filter(isCampaignAwaiting).length,
          campaignsCompleted: intakes.filter(isCampaignCompleted).length,
        };
      });
  }
}
