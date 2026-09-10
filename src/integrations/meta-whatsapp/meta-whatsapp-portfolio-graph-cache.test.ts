import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearPortfolioGraphCacheForTests,
  invalidateCachedPortfolioGraph,
  readCachedPortfolioGraph,
  writeCachedPortfolioGraph,
} from "./meta-whatsapp-portfolio-graph-cache";

describe("cache Graph do portfólio", () => {
  it("devolve o último hydrate por 45s e some no invalidate", () => {
    clearPortfolioGraphCacheForTests();
    const assets = {
      portfolios: [],
      selectedConnectionId: "conn-1",
      portfolio: null,
      numbers: [],
    };
    writeCachedPortfolioGraph("tenant-port-1", assets, 1_000);
    assert.equal(readCachedPortfolioGraph("tenant-port-1", 20_000)?.selectedConnectionId, "conn-1");
    assert.equal(readCachedPortfolioGraph("tenant-port-1", 50_000), null);
    writeCachedPortfolioGraph("tenant-port-1", assets, 1_000);
    invalidateCachedPortfolioGraph("tenant-port-1");
    assert.equal(readCachedPortfolioGraph("tenant-port-1", 2_000), null);
  });
});
