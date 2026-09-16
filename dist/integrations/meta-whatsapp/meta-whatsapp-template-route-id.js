"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPostgresUuid = isPostgresUuid;
exports.isMetaTemplateRouteId = isMetaTemplateRouteId;
/** UUID Postgres (conexão ou template) — IDs numéricos da Meta não entram nesta coluna. */
const POSTGRES_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isPostgresUuid(value) {
    return POSTGRES_UUID_RE.test(String(value || "").trim());
}
/** UUID de template — evita que segmentos como `ai` caiam em :templateId. */
function isMetaTemplateRouteId(value) {
    return isPostgresUuid(value);
}
