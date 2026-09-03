/** UUID de template — evita que segmentos como `ai` caiam em :templateId. */
const META_TEMPLATE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isMetaTemplateRouteId(value: string): boolean {
  return META_TEMPLATE_ID_RE.test(String(value || "").trim());
}
