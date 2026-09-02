import { placeholderIndexes } from "./meta-whatsapp-template-validate";
import { extractSlugFromPublicShortUrl } from "../../shortener/waba-shortener.repository";

export type MetaBroadcastBodyVariable = {
  index: number;
  key: "nome" | "numero" | "texto";
  label: string;
};

export type MetaBroadcastTemplateInspect = {
  headerFormat: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION" | "NONE";
  bodyVariables: MetaBroadcastBodyVariable[];
  urlButton: {
    index: number;
    url: string;
    hasVariable: boolean;
    slug: string | null;
  } | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function guessVariableKey(bodyText: string, example: string, index: number): MetaBroadcastBodyVariable["key"] {
  const sample = String(example || "").replace(/\D/g, "");
  if (sample.length >= 8) return "numero";
  const around = bodyText.toLowerCase();
  if (index === 1 && /\bnome\b|olá,\s*\{\{1\}\}/i.test(around)) return "nome";
  if (/\bn[uú]mero\b|protocolo|pedido|os\b/.test(around) && sample.length >= 3 && /^\d/.test(example)) {
    return "numero";
  }
  if (/[a-záéíóúãõ]{2,}/i.test(example)) return "nome";
  return "texto";
}

function bodyExampleValues(example: unknown): string[] {
  const row = asRecord(example);
  const nested = row.body_text;
  if (Array.isArray(nested) && Array.isArray(nested[0])) {
    return nested[0].map((item) => String(item || "").trim());
  }
  if (Array.isArray(nested)) return nested.map((item) => String(item || "").trim());
  return [];
}

export function inspectMetaBroadcastTemplate(components: unknown): MetaBroadcastTemplateInspect {
  const list = Array.isArray(components) ? components : [];
  let headerFormat: MetaBroadcastTemplateInspect["headerFormat"] = "NONE";
  const bodyVariables: MetaBroadcastBodyVariable[] = [];
  let urlButton: MetaBroadcastTemplateInspect["urlButton"] = null;

  for (const item of list) {
    const row = asRecord(item);
    const type = String(row.type || "").trim().toUpperCase();
    if (type === "HEADER") {
      const format = String(row.format || "TEXT").trim().toUpperCase();
      if (format === "IMAGE" || format === "VIDEO" || format === "DOCUMENT" || format === "LOCATION" || format === "TEXT") {
        headerFormat = format;
      }
    }
    if (type === "BODY") {
      const text = String(row.text || "");
      const indexes = placeholderIndexes(text);
      const examples = bodyExampleValues(row.example);
      for (const index of indexes) {
        const example = String(examples[index - 1] || "").trim();
        const key = guessVariableKey(text, example, index);
        bodyVariables.push({
          index,
          key,
          label: key === "nome" ? "Variável Nome" : key === "numero" ? "Variável Número" : `Variável {{${index}}}`,
        });
      }
    }
    if (type === "BUTTONS" && Array.isArray(row.buttons)) {
      row.buttons.forEach((button, index) => {
        const btn = asRecord(button);
        if (String(btn.type || "").trim().toUpperCase() !== "URL") return;
        if (urlButton) return;
        const url = String(btn.url || "").trim();
        urlButton = {
          index,
          url,
          hasVariable: placeholderIndexes(url).length > 0,
          slug: extractSlugFromPublicShortUrl(url),
        };
      });
    }
  }

  return { headerFormat, bodyVariables, urlButton };
}
