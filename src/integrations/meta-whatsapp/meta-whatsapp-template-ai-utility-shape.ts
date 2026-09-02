import type { MetaTemplateAiModelOutput, MetaTemplateAiOption } from "./meta-whatsapp-template-ai.types";
import { META_TEMPLATE_AI_OPTION_BUTTONS } from "./meta-whatsapp-template-ai-shell";

const MARKETING_LEAK =
  /\b(aproveite|imperdível|última chance|desconto|oferta exclusiva|compre agora|assine agora|contrate agora|acesse agora)\b/gi;

const PARA_LINES = [
  "Para consultar a atualização da sua solicitação, use o link abaixo.",
  "Para ver os detalhes do resultado, use o link abaixo.",
  "Para acompanhar as informações atualizadas, use o link abaixo.",
];

function compactSpaces(text: string): string {
  return String(text || "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripLeadingGreeting(text: string): string {
  return text.replace(/^olá(?:\s*,\s*\{\{\d+\}\})?[.\s]*/i, "").trim();
}

function ensureInformamosQue(text: string): string {
  if (/^informamos que\b/i.test(text)) return text;
  const core = compactSpaces(text);
  if (!core) return "Informamos que há uma atualização referente à sua solicitação.";
  return `Informamos que ${core.charAt(0).toLowerCase()}${core.slice(1)}`;
}

function hasPurposePara(text: string): boolean {
  return /(?:^|\n|[.!?]\s+)para\b/i.test(text) || /\bpara (consultar|ver|acompanhar|mais)\b/i.test(text);
}

export function shapeMetaUtilityOptionBody(
  body: string,
  variableType: string,
  optionIndex: number,
): string {
  const greeting = variableType === "nenhuma" ? "Olá." : "Olá, {{1}}.";
  let text = compactSpaces(String(body || "").replace(MARKETING_LEAK, ""));
  text = stripLeadingGreeting(text);
  if (variableType === "nenhuma") {
    text = compactSpaces(text.replace(/\{\{\d+\}\}/g, ""));
  }
  text = ensureInformamosQue(text);
  if (!hasPurposePara(text)) {
    const para = PARA_LINES[optionIndex] || PARA_LINES[0];
    text = `${text.replace(/[.!?]?$/, ".")}\n${para}`;
  }
  return compactSpaces(`${greeting}\n${text}`);
}

export function shapeMetaUtilityAiOutput(
  result: MetaTemplateAiModelOutput,
  variableType: string,
): MetaTemplateAiModelOutput {
  return {
    ...result,
    options: result.options.map((option, index) => {
      const shaped: MetaTemplateAiOption = {
        ...option,
        body: shapeMetaUtilityOptionBody(option.body, variableType, index),
        buttonText: META_TEMPLATE_AI_OPTION_BUTTONS[index] || META_TEMPLATE_AI_OPTION_BUTTONS[0],
      };
      return shaped;
    }),
  };
}
