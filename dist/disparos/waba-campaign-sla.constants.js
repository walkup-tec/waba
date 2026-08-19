"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAMPAIGN_FAILOVER_DEADLINE_HOURS = exports.CAMPAIGN_FAILOVER_DEADLINE_MS = exports.CAMPAIGN_START_DEADLINE_HOURS = exports.CAMPAIGN_START_DEADLINE_MS = void 0;
/** Prazo visual de atendimento (alertas / ícone de atraso). */
exports.CAMPAIGN_START_DEADLINE_MS = 24 * 60 * 60 * 1000;
exports.CAMPAIGN_START_DEADLINE_HOURS = 24;
/** Após este prazo desde a eleição do fornecedor, reeleição automática. */
exports.CAMPAIGN_FAILOVER_DEADLINE_MS = 32 * 60 * 60 * 1000;
exports.CAMPAIGN_FAILOVER_DEADLINE_HOURS = 32;
