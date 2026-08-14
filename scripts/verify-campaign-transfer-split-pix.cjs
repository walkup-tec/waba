"use strict";

/**
 * Valida regra: transferência de campanha atualiza PIX do fornecedor eleito no settlement.
 * Espelha resolveSupplierForCampaignIntake + syncCampaignSupplierSettlementForIntake.
 */

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

function resolveSupplierForCampaignIntake(intake, suppliers, subscriberSegment) {
  const assignedEmail = normalizeEmail(intake.assignedOperacionalEmail);
  const assignedId = String(intake.assignedSupplierId || "").trim();
  if (!assignedEmail && !assignedId) return null;

  const apiKind = intake.apiKind === "alternativa" ? "alternativa" : "oficial";
  const supplierSegment = subscriberSegment === "bets" ? "bets" : "outros";

  if (assignedEmail) {
    const byEmail =
      suppliers.find(
        (row) =>
          row.active &&
          normalizeEmail(row.systemUserEmail) === assignedEmail &&
          row.apiKind === apiKind &&
          row.segment === supplierSegment,
      ) ??
      suppliers.find(
        (row) =>
          row.active &&
          normalizeEmail(row.systemUserEmail) === assignedEmail &&
          row.apiKind === apiKind,
      ) ??
      null;
    if (byEmail) return byEmail;
  }

  if (assignedId) {
    return suppliers.find((row) => row.id === assignedId) ?? null;
  }
  return null;
}

function syncCampaignSupplierSettlement(intake, settlement, suppliers, subscriberSegment) {
  const supplier = resolveSupplierForCampaignIntake(intake, suppliers, subscriberSegment);
  if (!supplier?.pixKey) return null;

  const lineIndex = settlement.lines.findIndex((line) => line.lineKind === "supplier");
  if (lineIndex < 0) return null;

  const line = settlement.lines[lineIndex];
  if (line.payoutStatus === "paid" || line.payoutStatus === "processing") {
    return settlement;
  }

  const participantEmail = supplier.systemUserEmail || "";
  const needsUpdate =
    line.participantId !== supplier.id ||
    line.pixKey !== supplier.pixKey ||
    line.participantEmail !== participantEmail;

  if (!needsUpdate) return settlement;

  const operatorChanged = line.participantId !== supplier.id;
  const updatedLines = [...settlement.lines];
  updatedLines[lineIndex] = {
    ...line,
    participantId: supplier.id,
    participantLabel: supplier.name,
    participantEmail,
    pixKey: supplier.pixKey,
    payoutStatus: line.payoutStatus === "failed" ? "pending" : line.payoutStatus,
    ...(operatorChanged
      ? {
          asaasTransferId: undefined,
          payoutExternalReference: undefined,
        }
      : {}),
  };

  return {
    ...settlement,
    supplierId: supplier.id,
    supplierName: supplier.name,
    lines: updatedLines,
  };
}

const suppliers = [
  {
    id: "sup-walkup",
    name: "Walkup",
    apiKind: "oficial",
    segment: "outros",
    systemUserEmail: "walkup@example.com",
    pixKey: "pix-walkup@mail.com",
    active: true,
  },
  {
    id: "sup-eduardo",
    name: "Eduardo",
    apiKind: "oficial",
    segment: "outros",
    systemUserEmail: "eduardo@example.com",
    pixKey: "11999998888",
    active: true,
  },
];

const intakeInitial = {
  id: "camp-1",
  apiKind: "oficial",
  assignedOperacionalEmail: "walkup@example.com",
  assignedSupplierId: "sup-walkup",
};

const resolvedInitial = resolveSupplierForCampaignIntake(intakeInitial, suppliers, "outros");
assert(resolvedInitial?.id === "sup-walkup", "fornecedor inicial deve ser Walkup");
assert(resolvedInitial?.pixKey === "pix-walkup@mail.com", "PIX inicial Walkup");

const intakeTransferred = {
  ...intakeInitial,
  assignedOperacionalEmail: "eduardo@example.com",
  assignedSupplierId: "sup-eduardo",
};

const resolvedAfterTransfer = resolveSupplierForCampaignIntake(
  intakeTransferred,
  suppliers,
  "outros",
);
assert(resolvedAfterTransfer?.id === "sup-eduardo", "após transferência deve ser Eduardo");
assert(resolvedAfterTransfer?.pixKey === "11999998888", "PIX após transferência Eduardo");

const settlementBeforeTransfer = {
  orderId: "campaign-supplier:camp-1",
  supplierId: "sup-walkup",
  supplierName: "Walkup",
  lines: [
    {
      lineKind: "supplier",
      participantId: "sup-walkup",
      participantLabel: "Walkup",
      participantEmail: "walkup@example.com",
      pixKey: "pix-walkup@mail.com",
      payoutStatus: "pending",
      amountCents: 5000,
    },
  ],
};

const settlementSynced = syncCampaignSupplierSettlement(
  intakeTransferred,
  settlementBeforeTransfer,
  suppliers,
  "outros",
);

assert(settlementSynced?.supplierId === "sup-eduardo", "settlement supplierId atualizado");
assert(
  settlementSynced?.lines[0].pixKey === "11999998888",
  "settlement PIX atualizado para operador eleito",
);
assert(
  settlementSynced?.lines[0].participantId === "sup-eduardo",
  "settlement participantId atualizado",
);

const settlementPaid = syncCampaignSupplierSettlement(
  intakeTransferred,
  {
    ...settlementBeforeTransfer,
    lines: [{ ...settlementBeforeTransfer.lines[0], payoutStatus: "paid" }],
  },
  suppliers,
  "outros",
);
assert(
  settlementPaid?.lines[0].pixKey === "pix-walkup@mail.com",
  "settlement pago não deve alterar PIX",
);

const intakeManualId = {
  id: "camp-2",
  apiKind: "oficial",
  assignedOperacionalEmail: "eduardo@example.com",
  assignedSupplierId: "manual-eduardo-oficial-outros",
};

const resolvedManual = resolveSupplierForCampaignIntake(intakeManualId, suppliers, "outros");
assert(resolvedManual?.id === "sup-eduardo", "ID manual deve resolver fornecedor pelo e-mail");

console.log("verify-campaign-transfer-split-pix: OK");
