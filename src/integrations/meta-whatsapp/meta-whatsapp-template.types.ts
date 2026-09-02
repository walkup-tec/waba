import { stripSilentBlockButtonsFromPublicComponents } from "./meta-whatsapp-template-silent-block-button";
import { publicTemplateHeaderPreviewUrl } from "./meta-whatsapp-template-header-preview.store";

export type MetaTemplatePublic = {
  id: string;
  metaTemplateId: string | null;
  name: string;
  language: string;
  category: string | null;
  status: string | null;
  qualityScore: string | null;
  components: unknown;
  rejectedReason: string | null;
  lastSyncedAt: string | null;
  connectionId: string;
  portfolioName: string | null;
  headerPreviewUrl: string | null;
};

export type MetaTemplateRecord = Omit<MetaTemplatePublic, "portfolioName" | "headerPreviewUrl"> & {
  tenantId: string;
  wabaId: string;
  createdAt: string;
  updatedAt: string;
};

export type MetaGraphTemplate = {
  id?: string;
  name?: string;
  language?: string;
  category?: string;
  status?: string;
  quality_score?: unknown;
  rejected_reason?: string;
  components?: unknown;
};

export function qualityScoreFromGraph(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "object") {
    const score = String((value as { score?: unknown }).score || "").trim();
    return score || null;
  }
  return String(value).trim() || null;
}

export function toPublicTemplate(
  row: MetaTemplateRecord,
  portfolioName?: string | null,
): MetaTemplatePublic {
  const name = String(portfolioName || "").trim();
  return {
    id: row.id,
    metaTemplateId: row.metaTemplateId,
    name: row.name,
    language: row.language,
    category: row.category,
    status: row.status,
    qualityScore: row.qualityScore,
    components: stripSilentBlockButtonsFromPublicComponents(row.components),
    rejectedReason: row.rejectedReason,
    lastSyncedAt: row.lastSyncedAt,
    connectionId: row.connectionId,
    portfolioName: name || null,
    headerPreviewUrl: publicTemplateHeaderPreviewUrl({
      id: row.id,
      tenantId: row.tenantId,
      components: row.components,
    }),
  };
}

export function isTemplateApprovedForSend(status: string | null | undefined): boolean {
  return String(status || "").trim().toUpperCase() === "APPROVED";
}
