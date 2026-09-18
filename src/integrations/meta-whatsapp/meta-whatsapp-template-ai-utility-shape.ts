import type { MetaTemplateAiModelOutput, MetaTemplateAiOption } from "./meta-whatsapp-template-ai.types";
import { META_TEMPLATE_AI_OPTION_BUTTONS } from "./meta-whatsapp-template-ai-shell";

const MARKETING_LEAK =
  /\b(aproveite|imperdível|última chance|desconto|oferta exclusiva|compre agora|assine agora|contrate agora|acesse agora)\b/gi;

const PARA_LINES = [
  "Para consultar a atualização da sua solicitação, use o link abaixo.",
  "Para ver os detalhes do resultado, use o link abaixo.",
  "Para acompanhar as informações atualizadas, use o link abaixo.",
];

const REPLY_LINES = [
  "Para consultar a atualização da sua solicitação, responda esta mensagem.",
  "Para ver os detalhes do resultado, responda esta mensagem.",
  "Para acompanhar as informações atualizadas, responda esta mensagem.",
];

const UTILITY_STATUS_RE =
  /\b(confirma[cç][aã]o|status\s+confirmado|confirmad|aprovad|conclu[ií]d|atualizad|atualiza[cç]|liberad)\b/i;

const UTILITY_STATUS_INJECT = [
  "A solicitação foi atualizada.",
  "O status está confirmado.",
  "A solicitação foi concluída e liberada.",
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

function ensureUtilityStatusAnchor(text: string, optionIndex: number): string {
  if (UTILITY_STATUS_RE.test(text)) return text;
  const clause = UTILITY_STATUS_INJECT[optionIndex] || UTILITY_STATUS_INJECT[0];
  const lines = text.split(/\n/);
  const paraIdx = lines.findIndex((line) => /^\s*para\b/i.test(line));
  if (paraIdx >= 0) {
    lines.splice(paraIdx, 0, clause);
    return lines.join("\n");
  }
  return `${text}\n${clause}`;
}

export function shapeMetaUtilityOptionBody(
  body: string,
  variableType: string,
  optionIndex: number,
  hasLinkButton = true,
): string {
  const greeting = variableType === "nenhuma" ? "Olá." : "Olá, {{1}}.";
  let text = compactSpaces(String(body || "").replace(MARKETING_LEAK, ""));
  text = stripLeadingGreeting(text);
  if (variableType === "nenhuma") {
    text = compactSpaces(text.replace(/\{\{\d+\}\}/g, ""));
  }
  text = ensureInformamosQue(text);
  if (!hasLinkButton) {
    text = text.replace(/use o link abaixo/gi, "responda esta mensagem");
  }
  if (!hasPurposePara(text)) {
    const lines = hasLinkButton ? PARA_LINES : REPLY_LINES;
    const para = lines[optionIndex] || lines[0];
    text = `${text.replace(/[.!?]?$/, ".")}\n${para}`;
  }
  text = ensureUtilityStatusAnchor(text, optionIndex);
  return compactSpaces(`${greeting}\n${text}`);
}

function syncVariableExamples(body: string, variableType: string, examples: string[]): string[] {
  if (variableType === "nenhuma") return [];
  const indexes = [...new Set([...String(body || "").matchAll(/\{\{(\d+)\}\}/g)].map((item) => Number(item[1])))].sort(
    (a, b) => a - b,
  );
  const fallback = variableType === "numero" ? "11999999999" : "Maria";
  return indexes.map((_, index) => String(examples[index] || "").trim() || fallback);
}

export function shapeMetaUtilityAiOutput(
  result: MetaTemplateAiModelOutput,
  variableType: string,
  hasLinkButton = true,
): MetaTemplateAiModelOutput {
  return {
    ...result,
    options: result.options.map((option, index) => {
      const body = shapeMetaUtilityOptionBody(option.body, variableType, index, hasLinkButton);
      const shaped: MetaTemplateAiOption = {
        ...option,
        body,
        buttonText: META_TEMPLATE_AI_OPTION_BUTTONS[index] || META_TEMPLATE_AI_OPTION_BUTTONS[0],
        variableExamples: syncVariableExamples(body, variableType, option.variableExamples),
      };
      return shaped;
    }),
  };
}
