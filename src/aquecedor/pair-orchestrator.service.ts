import type { OwnerConversationGraph, PairPickCandidate } from "./conversation-pair.types";
import {
  buildSelectionRecord,
  explainDirectedBlock,
  pickNextRelationship,
  type RelationshipPickResult,
} from "./relationship-manager.service";

export type OrchestratorPickResult = RelationshipPickResult;

/**
 * Fachada do ciclo: delega ao RelationshipManager (rotatividade + saldo).
 */
export function pickNextDirectedExchange(
  owner: OwnerConversationGraph,
  eligibleInstanceNames: string[],
  options: { startIndex?: number } = {},
): OrchestratorPickResult | null {
  return pickNextRelationship(owner, eligibleInstanceNames, options);
}

export { buildSelectionRecord, explainDirectedBlock };
export type { PairPickCandidate, RelationshipPickResult };
