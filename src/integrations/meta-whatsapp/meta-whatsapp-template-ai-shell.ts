import { MetaWhatsappError } from "./meta-whatsapp-errors";
import { placeholderIndexes } from "./meta-whatsapp-template-validate";
import type { MetaTemplateAiOption } from "./meta-whatsapp-template-ai.types";

/** Mesmas opções do select de botão do Mensageiro (API Alternativa). */
export const META_TEMPLATE_AI_BUTTON_LABELS = [
  "Quero saber mais",
  "Mais informações",
  "Solicitar agora",
  "Me inscrever",
  "Comprar agora",
] as const;

export type MetaTemplateAiVariableType = "nenhuma" | "nome" | "numero";
export type MetaTemplateAiMediaFormat = "NONE" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";

const VARIABLE_TYPES = new Set<MetaTemplateAiVariableType>(["nenhuma", "nome", "numero"]);
const MEDIA_FORMATS = new Set<MetaTemplateAiMediaFormat>([
  "NONE",
  "IMAGE",
  "VIDEO",
  "DOCUMENT",
  "LOCATION",
]);
const BUTTON_LABELS = new Set<string>(META_TEMPLATE_AI_BUTTON_LABELS);
const MEDIA_NEEDS_HANDLE = new Set<MetaTemplateAiMediaFormat>(["IMAGE", "VIDEO", "DOCUMENT"]);

/** HEADER de texto fixo. A Meta aceita um HEADER: este texto, ou mídia. */
export const META_TEMPLATE_AI_FIXED_HEADER_TEXT = "Informação de utilidade";

export type MetaTemplateAiShell = {
  modelName: string;
  variableType: MetaTemplateAiVariableType;
  mediaFormat: MetaTemplateAiMediaFormat;
  headerText: string;
  buttonText: string;
  buttonUrl: string;
  headerHandle: string;
};

export function sanitizeMetaTemplateName(raw: string): string {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 500);
}

export function templateNameForOption(modelName: string, index: number): string {
  const base = sanitizeMetaTemplateName(modelName);
  if (!base) throw new MetaWhatsappError("template_invalid");
  return `${base}_${index + 1}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function requireStaticHttpsUrl(raw: string): string {
  const url = String(raw || "").trim();
  if (!url || url.length > 2_000 || placeholderIndexes(url).length) {
    throw new MetaWhatsappError("template_url_https");
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new MetaWhatsappError("template_url_https");
  }
  if (parsed.protocol !== "https:") throw new MetaWhatsappError("template_url_https");
  return url;
}

export function parseMetaTemplateAiShell(input: Record<string, unknown> | undefined): MetaTemplateAiShell {
  const body = asRecord(input);
  const modelName = sanitizeMetaTemplateName(String(body.modelName || body.model_name || ""));
  const variableType = String(body.variableType || body.variable_type || "nome")
    .trim()
    .toLowerCase() as MetaTemplateAiVariableType;
  const mediaFormat = String(body.mediaFormat || body.media_format || "NONE")
    .trim()
    .toUpperCase() as MetaTemplateAiMediaFormat;
  const headerText = META_TEMPLATE_AI_FIXED_HEADER_TEXT;
  const buttonText = String(body.buttonText || body.button_text || "").trim();
  const buttonUrl = requireStaticHttpsUrl(String(body.buttonUrl || body.button_url || ""));
  const headerHandle = String(body.headerHandle || body.header_handle || "").trim();
  if (!modelName || !VARIABLE_TYPES.has(variableType) || !MEDIA_FORMATS.has(mediaFormat)) {
    throw new MetaWhatsappError("template_invalid");
  }
  if (!BUTTON_LABELS.has(buttonText) || buttonText.length > 25) {
    throw new MetaWhatsappError("template_invalid");
  }
  if (MEDIA_NEEDS_HANDLE.has(mediaFormat) && !headerHandle) {
    throw new MetaWhatsappError("template_media_required");
  }
  return {
    modelName,
    variableType,
    mediaFormat,
    headerText,
    buttonText,
    buttonUrl,
    headerHandle: MEDIA_NEEDS_HANDLE.has(mediaFormat) ? headerHandle : "",
  };
}

function exampleForVariable(shell: MetaTemplateAiShell, provided: string | undefined): string {
  if (shell.variableType === "numero") {
    const digits = String(provided || "").replace(/\D/g, "");
    return digits || "11999999999";
  }
  const text = String(provided || "").trim();
  return text || "Maria";
}

export function stripTemplatePlaceholders(text: string): string {
  return String(text || "")
    .replace(/\{\{\d+\}\}/g, "")
    .replace(/[ \t]+([,.;:!?])/g, "$1")
    .replace(/,(?=[.!?])/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^[ \t]+/gm, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function componentsFromAiOptionAndShell(
  option: MetaTemplateAiOption,
  shell: MetaTemplateAiShell,
): Record<string, unknown>[] {
  const bodyText = shell.variableType === "nenhuma"
    ? stripTemplatePlaceholders(option.body)
    : option.body;
  const placeholders = shell.variableType === "nenhuma" ? [] : placeholderIndexes(bodyText);
  if (placeholders.some((value, index) => value !== index + 1)) {
    throw new Error("Variáveis não sequenciais.");
  }
  if (!bodyText) throw new MetaWhatsappError("template_invalid");
  const examples = placeholders.map((_, index) => exampleForVariable(shell, option.variableExamples[index]));
  const components: Record<string, unknown>[] = [];
  if (MEDIA_NEEDS_HANDLE.has(shell.mediaFormat)) {
    components.push({
      type: "HEADER",
      format: shell.mediaFormat,
      example: { header_handle: [shell.headerHandle] },
    });
  } else if (shell.mediaFormat === "LOCATION") {
    components.push({ type: "HEADER", format: "LOCATION" });
  } else if (shell.headerText) {
    components.push({ type: "HEADER", format: "TEXT", text: shell.headerText });
  }
  components.push({
    type: "BODY",
    text: bodyText,
    ...(examples.length ? { example: { body_text: [examples] } } : {}),
  });
  components.push({
    type: "BUTTONS",
    buttons: [
      {
        type: "URL",
        text: shell.buttonText,
        url: shell.buttonUrl,
      },
    ],
  });
  return components;
}
