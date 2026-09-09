import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const html = readFileSync(path.join(__dirname, "../../../index.html"), "utf8");

describe("Disparo Cloud: portfólios, WABAs, números e limite diário", () => {
  it("o wizard marca vários portfólios, depois as WABAs e os números", () => {
    assert.match(html, /id="meta-tpl-broadcast-portfolios"/);
    assert.match(html, /id="meta-tpl-broadcast-wabas"/);
    assert.match(html, /function metaTplBroadcastSelectedConnectionIds/);
    assert.match(html, /function metaTplBroadcastSelectedWabaTargets/);
    assert.match(html, /function metaTplBroadcastParseDailySendLimit/);
    assert.match(html, /metaTplBroadcastPortfolioDailyCap/);
    assert.match(html, /não pode passar o limite diário/);
    assert.doesNotMatch(html, /id="meta-tpl-broadcast-portfolio"/);
    assert.match(html, /Marque os portfólios para ver as contas WABA/);
    assert.match(html, /function metaTplBroadcastRefreshWabasFromMeta/);
    assert.match(html, /templates\/wabas\?connectionId=/);
  });
});
