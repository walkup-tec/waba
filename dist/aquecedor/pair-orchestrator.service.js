"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.explainDirectedBlock = exports.buildSelectionRecord = void 0;
exports.pickNextDirectedExchange = pickNextDirectedExchange;
const relationship_manager_service_1 = require("./relationship-manager.service");
Object.defineProperty(exports, "buildSelectionRecord", { enumerable: true, get: function () { return relationship_manager_service_1.buildSelectionRecord; } });
Object.defineProperty(exports, "explainDirectedBlock", { enumerable: true, get: function () { return relationship_manager_service_1.explainDirectedBlock; } });
/**
 * Fachada do ciclo: delega ao RelationshipManager (rotatividade + saldo).
 */
function pickNextDirectedExchange(owner, eligibleInstanceNames, options = {}) {
    return (0, relationship_manager_service_1.pickNextRelationship)(owner, eligibleInstanceNames, options);
}
