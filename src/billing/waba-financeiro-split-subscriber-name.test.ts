import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveSplitSettlementSubscriberName } from "./waba-financeiro-split.service";

describe("resolveSplitSettlementSubscriberName", () => {
  it("usa o nome do cadastro do assinante", () => {
    assert.equal(
      resolveSplitSettlementSubscriberName({
        customerName: "Nome no PIX",
        ownerEmail: "ana@exemplo.com",
        orderId: "0268eec5-db7d-4bde-8445-0ec719dc4761",
        subscriberFullName: "Ana Souza",
      }),
      "Ana Souza",
    );
  });

  it("cai no nome do pedido pago quando não há cadastro", () => {
    assert.equal(
      resolveSplitSettlementSubscriberName({
        customerName: "Cliente PIX",
        ownerEmail: "ana@exemplo.com",
        orderId: "0268eec5-db7d-4bde-8445-0ec719dc4761",
        subscriberFullName: "",
      }),
      "Cliente PIX",
    );
  });

  it("não usa o nome da campanha no repasse sintético do fornecedor", () => {
    assert.equal(
      resolveSplitSettlementSubscriberName({
        customerName: "Campanha Jandira",
        ownerEmail: "ana@exemplo.com",
        orderId: "campaign-supplier:abc",
        subscriberFullName: "",
      }),
      "ana@exemplo.com",
    );
  });
});
