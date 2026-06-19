import type { WabaDispatchesApiKind } from "../disparos/waba-dispatches-api-kind";

export type DisparosApiCreditsBucket = {
  contractedShipments: number;
  consumedShipments: number;
  remainingShipments: number;
  pendingBonusShipments: number;
};

export const emptyDisparosApiCreditsBucket = (): DisparosApiCreditsBucket => ({
  contractedShipments: 0,
  consumedShipments: 0,
  remainingShipments: 0,
  pendingBonusShipments: 0,
});

export type DisparosCreditsByApi = Record<WabaDispatchesApiKind, DisparosApiCreditsBucket>;

export const emptyDisparosCreditsByApi = (): DisparosCreditsByApi => ({
  oficial: emptyDisparosApiCreditsBucket(),
  alternativa: emptyDisparosApiCreditsBucket(),
});
