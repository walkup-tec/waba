import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyGotoFailure,
  isChromiumTargetCrash,
} from "./waba-leads-cnpj-casadosdados.adapter";
import {
  shouldResumeZeroCopyPortalList,
  shouldStayOnPortalScrapeForThisList,
} from "./waba-leads-cnpj.service";

describe("Leads PJ Chromium crash", () => {
  it("classifica ERR_ABORTED e frame detached como retry de goto", () => {
    assert.equal(
      classifyGotoFailure(
        "page.goto: net::ERR_ABORTED; maybe frame was detached?\n navigating to https://portal.casadosdados.com.br/plataforma/pesquisa",
      ),
      "retry",
    );
    assert.equal(
      classifyGotoFailure("Navigation is interrupted by another navigation"),
      "retry",
    );
    assert.equal(classifyGotoFailure("page.evaluate: Target crashed"), "hard-dead");
    assert.equal(classifyGotoFailure("Timeout 30000ms exceeded"), "throw");
  });

  it("reconhece crash de renderer para reconectar o Chromium", () => {
    assert.equal(isChromiumTargetCrash(new Error("page.evaluate: Target crashed")), true);
    assert.equal(isChromiumTargetCrash(new Error("page.goto: net::ERR_ABORTED")), true);
    assert.equal(
      isChromiumTargetCrash(new Error("RENDERER_UNRESPONSIVE: goto pesquisa")),
      true,
    );
    assert.equal(isChromiumTargetCrash(new Error("Timeout 30000ms exceeded")), false);
  });
});

describe("Leads PJ retomada de cópia zerada", () => {
  it("retoma failed/queued/draft sem scrapeCompleted (Odontologia/Corbans/cópia)", () => {
    assert.equal(
      shouldResumeZeroCopyPortalList({ status: "failed", scrapeCompleted: false }),
      true,
    );
    assert.equal(
      shouldResumeZeroCopyPortalList({ status: "queued", scrapeCompleted: false }),
      true,
    );
    assert.equal(
      shouldResumeZeroCopyPortalList({ status: "draft", scrapeCompleted: false }),
      true,
    );
    assert.equal(
      shouldResumeZeroCopyPortalList({ status: "ready", scrapeCompleted: false }),
      false,
    );
    assert.equal(
      shouldResumeZeroCopyPortalList({ status: "queued", scrapeCompleted: true }),
      false,
    );
    assert.equal(
      shouldResumeZeroCopyPortalList({
        status: "queued",
        skipPortalScrape: true,
        scrapeCompleted: false,
      }),
      false,
    );
  });

  it("não pula a raspagem desta lista só porque outra linha da campanha já copiou", () => {
    assert.equal(
      shouldStayOnPortalScrapeForThisList({
        source: "portal",
        skipPortalScrape: false,
        scrapeCompleted: false,
      }),
      true,
    );
    assert.equal(
      shouldStayOnPortalScrapeForThisList({
        source: "portal",
        skipPortalScrape: true,
        scrapeCompleted: false,
      }),
      false,
    );
    assert.equal(
      shouldStayOnPortalScrapeForThisList({
        source: "portal",
        skipPortalScrape: false,
        scrapeCompleted: true,
      }),
      false,
    );
  });
});
