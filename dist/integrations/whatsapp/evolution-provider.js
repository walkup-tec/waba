"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvolutionProvider = void 0;
/**
 * Adaptador de contrato. Os envios Evolution de produção permanecem em
 * aquecedor/disparos/index.ts. Não usar esta classe para Cloud API.
 */
class EvolutionProvider {
    constructor() {
        this.name = "evolution";
    }
    async sendText(_input) {
        throw new Error("EvolutionProvider não envia neste fluxo. Use o caminho Evolution existente.");
    }
    async sendTemplate(_input) {
        throw new Error("EvolutionProvider não envia templates Cloud API.");
    }
}
exports.EvolutionProvider = EvolutionProvider;
