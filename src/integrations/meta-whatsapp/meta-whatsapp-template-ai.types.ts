export type MetaTemplateAiRisk = "LOW" | "MEDIUM" | "HIGH";
export type MetaTemplateAiCategory = "UTILITY" | "MARKETING";

export type MetaTemplateAiIssue = {
  severity: "INFO" | "WARNING" | "BLOCKING";
  excerpt: string;
  reason: string;
  suggestion: string;
};

export type MetaTemplateAiOption = {
  name: string;
  body: string;
  variableExamples: string[];
  rationale: string;
};

export type MetaTemplateAiModelOutput = {
  recommendedCategory: MetaTemplateAiCategory;
  utilityCompatibility: number;
  riskLevel: MetaTemplateAiRisk;
  eligibleForUtility: boolean;
  reason: string;
  issues: MetaTemplateAiIssue[];
  suggestions: string[];
  options: MetaTemplateAiOption[];
  disclaimer: string;
};

export type MetaTemplateAiPublicResult = MetaTemplateAiModelOutput & {
  analysisId: string | null;
  connectionId: string;
  wabaId: string;
  language: string;
  model: string;
  policyVersion: string;
  analyzedAt: string;
};
