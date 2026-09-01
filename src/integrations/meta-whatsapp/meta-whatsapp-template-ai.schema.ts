import Ajv, { type ErrorObject } from "ajv";
import type { MetaTemplateAiModelOutput } from "./meta-whatsapp-template-ai.types";

export const META_TEMPLATE_AI_SCHEMA_NAME = "meta_utility_template_assistant";

export const META_TEMPLATE_AI_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    recommendedCategory: { type: "string", enum: ["UTILITY", "MARKETING"] },
    utilityCompatibility: { type: "integer", minimum: 0, maximum: 100 },
    riskLevel: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    eligibleForUtility: { type: "boolean" },
    reason: { type: "string", minLength: 1, maxLength: 1_200 },
    issues: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          severity: { type: "string", enum: ["INFO", "WARNING", "BLOCKING"] },
          excerpt: { type: "string", maxLength: 500 },
          reason: { type: "string", minLength: 1, maxLength: 800 },
          suggestion: { type: "string", maxLength: 800 },
        },
        required: ["severity", "excerpt", "reason", "suggestion"],
      },
    },
    suggestions: {
      type: "array",
      maxItems: 10,
      items: { type: "string", minLength: 1, maxLength: 600 },
    },
    options: {
      type: "array",
      minItems: 0,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string", pattern: "^[a-z0-9_]{1,512}$" },
          body: { type: "string", minLength: 1, maxLength: 1_024 },
          variableExamples: {
            type: "array",
            maxItems: 10,
            items: { type: "string", minLength: 1, maxLength: 200 },
          },
          rationale: { type: "string", minLength: 1, maxLength: 600 },
        },
        required: ["name", "body", "variableExamples", "rationale"],
      },
    },
    disclaimer: { type: "string", minLength: 1, maxLength: 500 },
  },
  required: [
    "recommendedCategory",
    "utilityCompatibility",
    "riskLevel",
    "eligibleForUtility",
    "reason",
    "issues",
    "suggestions",
    "options",
    "disclaimer",
  ],
};

const ajv = new Ajv({ allErrors: true, strict: true });
const validate = ajv.compile<MetaTemplateAiModelOutput>(META_TEMPLATE_AI_OUTPUT_SCHEMA);

export function validateMetaTemplateAiOutput(value: unknown): MetaTemplateAiModelOutput {
  if (validate(value)) {
    if (value.eligibleForUtility && (value.recommendedCategory !== "UTILITY" || value.options.length !== 3)) {
      throw new Error("Resposta da IA inconsistente para Utility.");
    }
    if (!value.eligibleForUtility && value.options.length !== 0) {
      throw new Error("A IA não pode disfarçar Marketing como Utility.");
    }
    return value;
  }
  const detail = (validate.errors || [])
    .slice(0, 4)
    .map((item: ErrorObject) => `${item.instancePath || "/"} ${item.message || "inválido"}`)
    .join("; ");
  throw new Error(`Resposta estruturada da IA inválida${detail ? `: ${detail}` : "."}`);
}
