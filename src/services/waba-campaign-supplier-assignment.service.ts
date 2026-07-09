import { WabaFinanceiroSplitService } from "../billing/waba-financeiro-split.service";
import type { SplitSupplier } from "../billing/waba-financeiro-split.repository";
import {
  resolveIntakeApiKindFromIntake,
  type WabaDispatchesApiKind,
} from "../disparos/waba-dispatches-api-kind";
import {
  WabaCampaignIntakeRepository,
  type WabaCampaignAssignmentHistoryEntry,
  type WabaCampaignIntake,
} from "../disparos/waba-campaign-intake.repository";
import { publishSystemAlertForMasters } from "../push/waba-push-delivery.service";
import { WabaSubscriberRepository } from "../subscribers/waba-subscriber.repository";
import type { WabaSubscriberSegment } from "../subscribers/waba-subscriber-segment";
import { WabaSystemUserService } from "../users/waba-system-user.service";
import type { WabaSystemUserOperacionalSegment } from "../users/waba-system-user.repository";
import { notifyOperacionalStaffOnCampaignAssigned } from "../mail/waba-operacional-campaign-notify.service";

export const CAMPAIGN_START_OVERDUE_MS = 24 * 60 * 60 * 1000;
export const CAMPAIGN_REASSIGN_DEADLINE_MS = 30 * 60 * 60 * 1000;

export type CampaignAssignmentReason = WabaCampaignAssignmentHistoryEntry["reason"];

const normalizeEmail = (value: string): string => String(value || "").trim().toLowerCase();

const toOperacionalSegment = (segment: WabaSubscriberSegment): WabaSystemUserOperacionalSegment =>
  segment === "bets" ? "bets" : "outros";

export class WabaCampaignSupplierAssignmentService {
  constructor(
    private readonly intakeRepository = new WabaCampaignIntakeRepository(),
    private readonly subscriberRepository = new WabaSubscriberRepository(),
    private readonly systemUserService = new WabaSystemUserService(),
    private readonly splitService = new WabaFinanceiroSplitService(),
  ) {}

  resolveSubscriberSegmentForIntake(intake: WabaCampaignIntake): WabaSubscriberSegment {
    const subscriber = this.subscriberRepository.getByEmail(intake.ownerEmail);
    return subscriber?.segment ?? "outros";
  }

  resolveIntakeApiKind(intake: WabaCampaignIntake): WabaDispatchesApiKind {
    return resolveIntakeApiKindFromIntake(intake);
  }

  listCandidateSuppliers(intake: WabaCampaignIntake): SplitSupplier[] {
    const apiKind = this.resolveIntakeApiKind(intake);
    const segment = toOperacionalSegment(this.resolveSubscriberSegmentForIntake(intake));
    return this.splitService.listActiveSuppliersForPlanSegment(apiKind, segment);
  }

  private listTriedOperacionalEmails(intake: WabaCampaignIntake): Set<string> {
    const tried = new Set<string>();
    for (const entry of intake.assignmentHistory ?? []) {
      const email = normalizeEmail(entry.operacionalEmail);
      if (email) tried.add(email);
    }
    const current = normalizeEmail(intake.assignedOperacionalEmail ?? "");
    if (current) tried.add(current);
    return tried;
  }

  pickNextSupplier(intake: WabaCampaignIntake, excludeEmails?: Set<string>): SplitSupplier | null {
    const tried = excludeEmails ?? this.listTriedOperacionalEmails(intake);
    const candidates = this.listCandidateSuppliers(intake);
    for (const supplier of candidates) {
      const email = normalizeEmail(supplier.systemUserEmail);
      if (!email || tried.has(email)) continue;
      const operacional = this.systemUserService.getByEmail(email);
      if (!operacional || operacional.role !== "operacional") continue;
      const apiKind = this.resolveIntakeApiKind(intake);
      const segment = toOperacionalSegment(this.resolveSubscriberSegmentForIntake(intake));
      if (operacional.operacionalDispatchesApi !== apiKind) continue;
      if ((operacional.operacionalSegment ?? "outros") !== segment) continue;
      return supplier;
    }
    return null;
  }

  private buildHistoryEntry(
    supplier: SplitSupplier,
    reason: CampaignAssignmentReason,
  ): WabaCampaignAssignmentHistoryEntry {
    return {
      at: new Date().toISOString(),
      supplierId: supplier.id,
      operacionalEmail: normalizeEmail(supplier.systemUserEmail),
      reason,
    };
  }

  assignToSupplier(
    intake: WabaCampaignIntake,
    supplier: SplitSupplier,
    reason: CampaignAssignmentReason,
  ): WabaCampaignIntake {
    const operacionalEmail = normalizeEmail(supplier.systemUserEmail);
    if (!operacionalEmail) {
      throw new Error("Fornecedor sem usuário operacional vinculado.");
    }
    const operacional = this.systemUserService.getByEmail(operacionalEmail);
    const name = String(operacional?.fullName || supplier.name || operacionalEmail).trim();
    const now = new Date().toISOString();
    const history = [...(intake.assignmentHistory ?? [])];
    history.push(this.buildHistoryEntry({ ...supplier, name }, reason));

    const updated = this.intakeRepository.updateById(intake.id, {
      assignedOperacionalEmail: operacionalEmail,
      assignedSupplierId: supplier.id,
      assignedAt: now,
      assignmentHistory: history,
      updatedAt: now,
    });
    if (!updated) throw new Error("Não foi possível atribuir a campanha.");
    return updated;
  }

  ensureInitialAssignment(intake: WabaCampaignIntake): WabaCampaignIntake {
    if (normalizeEmail(intake.assignedOperacionalEmail ?? "")) return intake;
    const supplier = this.pickNextSupplier(intake, new Set());
    if (!supplier) return intake;
    return this.assignToSupplier(intake, supplier, "initial");
  }

  async reassignCampaign(
    intakeId: string,
    reason: Exclude<CampaignAssignmentReason, "initial">,
  ): Promise<{ intake: WabaCampaignIntake; reassigned: boolean; exhausted: boolean }> {
    const intake = this.intakeRepository.getById(intakeId);
    if (!intake) throw new Error("Campanha não encontrada.");
    if (intake.status !== "generated") {
      throw new Error("Somente campanhas aguardando configuração podem ser reatribuídas.");
    }

    const tried = this.listTriedOperacionalEmails(intake);
    const next = this.pickNextSupplier(intake, tried);
    if (!next) {
      await this.maybeSendMasterOverdueAlert(intake);
      return { intake, reassigned: false, exhausted: true };
    }

    const updated = this.assignToSupplier(intake, next, reason);
    const notify = await notifyOperacionalStaffOnCampaignAssigned(updated);
    this.intakeRepository.updateById(updated.id, {
      operacionalNotifyAudit: notify,
      updatedAt: new Date().toISOString(),
    });
    const finalIntake = this.intakeRepository.getById(updated.id) ?? updated;
    return { intake: finalIntake, reassigned: true, exhausted: false };
  }

  resolveAssignmentAnchorAt(intake: WabaCampaignIntake): string {
    return String(intake.assignedAt || intake.createdAt || "").trim();
  }

  isStartOverdue(intake: WabaCampaignIntake): boolean {
    const status = intake.status;
    if (status === "completed" || status === "cancelled" || status === "error_reported") {
      return false;
    }
    const anchorMs = new Date(this.resolveAssignmentAnchorAt(intake)).getTime();
    if (Number.isNaN(anchorMs)) return false;
    const deadlineMs = anchorMs + CAMPAIGN_START_OVERDUE_MS;
    if (status === "generated") return Date.now() > deadlineMs;
    if (status === "in_progress") {
      const startedMs = new Date(String(intake.startedAt ?? "")).getTime();
      if (!Number.isNaN(startedMs)) return startedMs > deadlineMs;
      return Date.now() > deadlineMs;
    }
    return false;
  }

  isReassignDue(intake: WabaCampaignIntake): boolean {
    if (intake.status !== "generated") return false;
    const anchorMs = new Date(this.resolveAssignmentAnchorAt(intake)).getTime();
    if (Number.isNaN(anchorMs)) return false;
    return Date.now() > anchorMs + CAMPAIGN_REASSIGN_DEADLINE_MS;
  }

  async maybeSendMasterOverdueAlert(intake: WabaCampaignIntake): Promise<void> {
    if (!this.isReassignDue(intake)) return;
    if (intake.masterOverdueAlertSentAt) return;
    if (!normalizeEmail(intake.assignedOperacionalEmail ?? "")) return;

    const operacional = this.systemUserService.getByEmail(intake.assignedOperacionalEmail ?? "");
    const operacionalLabel = String(operacional?.fullName || intake.assignedOperacionalEmail).trim();
    const title = "Campanha em atraso";
    const message = `${intake.campaignName} - ${operacionalLabel}`;

    publishSystemAlertForMasters({ title, message });
    this.intakeRepository.updateById(intake.id, {
      masterOverdueAlertSentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async processDueReassignments(limit = 50): Promise<{ scanned: number; reassigned: number; alerts: number }> {
    let scanned = 0;
    let reassigned = 0;
    let alerts = 0;
    const cap = Math.max(1, Math.min(200, Math.floor(limit)));

    for (const row of this.intakeRepository.listAll()) {
      if (scanned >= cap) break;
      let intake = row;
      if (!normalizeEmail(intake.assignedOperacionalEmail ?? "")) {
        intake = this.ensureInitialAssignment(intake);
      }
      if (intake.status !== "generated") continue;
      scanned += 1;

      if (!this.isReassignDue(intake)) continue;

      const tried = this.listTriedOperacionalEmails(intake);
      const next = this.pickNextSupplier(intake, tried);
      if (next) {
        const result = await this.reassignCampaign(intake.id, "timeout_30h");
        if (result.reassigned) reassigned += 1;
      } else {
        const before = intake.masterOverdueAlertSentAt;
        await this.maybeSendMasterOverdueAlert(intake);
        if (!before) alerts += 1;
      }
    }

    return { scanned, reassigned, alerts };
  }

  matchesAssignedOperacional(intake: WabaCampaignIntake, staffEmail: string): boolean {
    const assigned = normalizeEmail(intake.assignedOperacionalEmail ?? "");
    if (!assigned) return true;
    return assigned === normalizeEmail(staffEmail);
  }
}

const CAMPAIGN_ASSIGNMENT_TICK_MS = 10 * 60 * 1000;
let assignmentTickRunning = false;

export function startCampaignSupplierAssignmentScheduler() {
  const tick = () => {
    if (assignmentTickRunning) return;
    assignmentTickRunning = true;
    new WabaCampaignSupplierAssignmentService()
      .processDueReassignments(80)
      .then((result) => {
        if (result.reassigned > 0 || result.alerts > 0) {
          console.log(
            `[Campanhas] fila fornecedores: ${result.reassigned} reatribuída(s), ${result.alerts} alerta(s) master.`,
          );
        }
      })
      .catch((error) => {
        console.error("[Campanhas] tick reatribuição fornecedores:", error);
      })
      .finally(() => {
        assignmentTickRunning = false;
      });
  };

  tick();
  setInterval(tick, CAMPAIGN_ASSIGNMENT_TICK_MS);
  console.log(
    `[Campanhas] reatribuição por prioridade (30h) a cada ${Math.round(CAMPAIGN_ASSIGNMENT_TICK_MS / 60000)} min.`,
  );
}
