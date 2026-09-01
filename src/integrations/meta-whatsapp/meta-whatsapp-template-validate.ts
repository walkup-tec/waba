import { normalizeTemplateLanguage } from "./meta-whatsapp-recipient";
import { MetaWhatsappError } from "./meta-whatsapp-errors";

const NAME_RE = /^[a-z0-9_]{1,512}$/;
const CREATE_CATEGORIES = new Set(["MARKETING", "UTILITY", "AUTHENTICATION"]);
const COMPONENT_TYPES = new Set(["HEADER", "BODY", "FOOTER", "BUTTONS"]);
const HEADER_FORMATS = new Set(["TEXT", "IMAGE", "VIDEO", "DOCUMENT", "LOCATION"]);
const BUTTON_TYPES = new Set(["QUICK_REPLY", "URL", "PHONE_NUMBER"]);

export type ValidatedTemplateCreate = {
  name: string;
  language: string;
  category: string;
  components: Record<string, unknown>[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function isMetaRestrictedTemplateButtonHost(hostname: string): boolean {
  const host = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
  return (
    host === "wa.me" ||
    host.endsWith(".wa.me") ||
    host === "whatsapp.com" ||
    host.endsWith(".whatsapp.com") ||
    host === "whatsapp.net" ||
    host.endsWith(".whatsapp.net")
  );
}

export function placeholderIndexes(text: string): number[] {
  const found = new Set<number>();
  const re = /\{\{(\d+)\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(String(text || "")))) {
    found.add(Number(match[1]));
  }
  return [...found].sort((a, b) => a - b);
}

function requireExamples(kind: "body" | "header", text: string, example: unknown): void {
  const indexes = placeholderIndexes(text);
  if (!indexes.length) return;
  const row = asRecord(example);
  if (kind === "header") {
    const values = Array.isArray(row.header_text) ? row.header_text : [];
    if (values.length < indexes.length) {
      throw new MetaWhatsappError("template_invalid");
    }
    return;
  }
  const nested = Array.isArray(row.body_text) ? row.body_text[0] : null;
  const values = Array.isArray(nested) ? nested : [];
  if (values.length < indexes.length) {
    throw new MetaWhatsappError("template_invalid");
  }
}

function sanitizeButton(raw: unknown): Record<string, unknown> {
  const row = asRecord(raw);
  const type = String(row.type || "").trim().toUpperCase();
  if (!BUTTON_TYPES.has(type)) throw new MetaWhatsappError("template_invalid");
  const text = String(row.text || "").trim();
  if (!text) throw new MetaWhatsappError("template_invalid");
  const out: Record<string, unknown> = { type, text };
  if (type === "URL") {
    const url = String(row.url || "").trim();
    if (!url) throw new MetaWhatsappError("template_invalid");
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new MetaWhatsappError("template_url_https");
    }
    if (parsed.protocol !== "https:") throw new MetaWhatsappError("template_url_https");
    if (isMetaRestrictedTemplateButtonHost(parsed.hostname)) {
      throw new MetaWhatsappError("template_url_restricted");
    }
    out.url = url;
    if (placeholderIndexes(url).length) {
      const examples = Array.isArray(row.example) ? row.example : [];
      if (!examples.length) throw new MetaWhatsappError("template_invalid");
      out.example = examples;
    } else if (row.example) {
      out.example = row.example;
    }
  }
  if (type === "PHONE_NUMBER") {
    const phone = String(row.phone_number || "").trim();
    if (!phone) throw new MetaWhatsappError("template_invalid");
    out.phone_number = phone;
  }
  return out;
}

function sanitizeComponent(raw: unknown): Record<string, unknown> {
  const row = asRecord(raw);
  const type = String(row.type || "").trim().toUpperCase();
  if (!COMPONENT_TYPES.has(type)) throw new MetaWhatsappError("template_invalid");
  if (type === "BODY") {
    const text = String(row.text || "").trim();
    if (!text) throw new MetaWhatsappError("template_invalid");
    const out: Record<string, unknown> = { type, text };
    if (placeholderIndexes(text).length) {
      if (!row.example) throw new MetaWhatsappError("template_invalid");
      requireExamples("body", text, row.example);
      out.example = row.example;
    }
    return out;
  }
  if (type === "HEADER") {
    const format = String(row.format || "TEXT").trim().toUpperCase();
    if (!HEADER_FORMATS.has(format)) throw new MetaWhatsappError("template_invalid");
    if (format === "LOCATION") return { type, format };
    if (format === "IMAGE" || format === "VIDEO" || format === "DOCUMENT") {
      const example = asRecord(row.example);
      const handles = Array.isArray(example.header_handle) ? example.header_handle : [];
      const handle = String(handles[0] || "").trim();
      if (!handle) throw new MetaWhatsappError("template_invalid");
      return { type, format, example: { header_handle: [handle] } };
    }
    const text = String(row.text || "").trim();
    if (!text) throw new MetaWhatsappError("template_invalid");
    const out: Record<string, unknown> = { type, format, text };
    if (placeholderIndexes(text).length) {
      if (!row.example) throw new MetaWhatsappError("template_invalid");
      requireExamples("header", text, row.example);
      out.example = row.example;
    }
    return out;
  }
  if (type === "FOOTER") {
    const text = String(row.text || "").trim();
    if (!text) throw new MetaWhatsappError("template_invalid");
    return { type, text };
  }
  const buttons = Array.isArray(row.buttons) ? row.buttons.slice(0, 10).map(sanitizeButton) : [];
  if (!buttons.length) throw new MetaWhatsappError("template_invalid");
  return { type, buttons };
}

export function validateTemplateCreate(input: Record<string, unknown> | undefined): ValidatedTemplateCreate {
  const body = input || {};
  const name = String(body.name || "").trim().toLowerCase();
  const language = normalizeTemplateLanguage(body.language);
  const category = String(body.category || "").trim().toUpperCase();
  if (!NAME_RE.test(name) || !language) throw new MetaWhatsappError("template_invalid");
  if (!CREATE_CATEGORIES.has(category)) throw new MetaWhatsappError("template_invalid");
  if (!Array.isArray(body.components) || !body.components.length) {
    throw new MetaWhatsappError("template_invalid");
  }
  const components = body.components.slice(0, 8).map(sanitizeComponent);
  if (!components.some((item) => item.type === "BODY")) {
    throw new MetaWhatsappError("template_invalid");
  }
  return { name, language, category, components };
}
