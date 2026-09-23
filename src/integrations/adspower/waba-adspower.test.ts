import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  findWabaProfileClash,
  normalizeAdsPowerIngestItem,
  timingSafeEqualText,
} from "./waba-adspower.service";

describe("AdsPower ingest", () => {
  it("normaliza user_id da Local API", () => {
    const row = normalizeAdsPowerIngestItem({
      user_id: "h1yynkm",
      name: "Cliente Odontologia",
      serial_number: "12",
      group_name: "WABA",
      last_open_time: 1710000000,
    });
    assert.equal(row?.userId, "h1yynkm");
    assert.equal(row?.name, "Cliente Odontologia");
    assert.equal(row?.groupName, "WABA");
    assert.equal(Boolean(row?.lastOpenTime), true);
  });

  it("compara token de ingest em tempo constante", () => {
    assert.equal(timingSafeEqualText("abc123", "abc123"), true);
    assert.equal(timingSafeEqualText("abc123", "abc124"), false);
    assert.equal(timingSafeEqualText("", "x"), false);
  });

  it("impede o mesmo WABA em dois perfis", () => {
    const clash = findWabaProfileClash(
      [
        {
          userId: "p1",
          serialNumber: "1",
          name: "Perfil 1",
          groupId: "",
          groupName: "",
          remark: "",
          ipCountry: "",
          lastOpenTime: null,
          ingestedAt: "",
          connectionId: null,
          wabaId: "waba-a",
          phoneNumberId: null,
          displayPhoneNumber: null,
          verifiedName: null,
        },
        {
          userId: "p2",
          serialNumber: "2",
          name: "Perfil 2",
          groupId: "",
          groupName: "",
          remark: "",
          ipCountry: "",
          lastOpenTime: null,
          ingestedAt: "",
          connectionId: null,
          wabaId: null,
          phoneNumberId: null,
          displayPhoneNumber: null,
          verifiedName: null,
        },
      ],
      "p2",
      "waba-a",
    );
    assert.equal(clash?.userId, "p1");
  });
});

describe("AdsPower menu FARM BM", () => {
  it("expõe a aba Perfis AdsPower na seção FARM BM", () => {
    const html = readFileSync(path.join(__dirname, "../../../index.html"), "utf8");
    assert.match(html, /data-menu-key="whatsapp-adspower"/);
    assert.match(html, /data-menu-section="farm-bm"/);
    assert.match(html, /id="tab-whatsapp-adspower"/);
    assert.match(html, /Perfis AdsPower/);
    assert.match(html, /wabaStartAdsPower/);
    assert.match(html, /id="waba-adspower-sync"/);
  });
});
