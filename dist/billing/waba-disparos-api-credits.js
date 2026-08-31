"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyDisparosCreditsByApi = exports.emptyDisparosApiCreditsBucket = void 0;
const emptyDisparosApiCreditsBucket = () => ({
    contractedShipments: 0,
    consumedShipments: 0,
    remainingShipments: 0,
    pendingBonusShipments: 0,
});
exports.emptyDisparosApiCreditsBucket = emptyDisparosApiCreditsBucket;
const emptyDisparosCreditsByApi = () => ({
    oficial: (0, exports.emptyDisparosApiCreditsBucket)(),
    alternativa: (0, exports.emptyDisparosApiCreditsBucket)(),
});
exports.emptyDisparosCreditsByApi = emptyDisparosCreditsByApi;
