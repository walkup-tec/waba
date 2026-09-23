import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyGotoFailure,
  createSessionAbortGate,
  isChromiumTargetCrash,
  isKeepaliveProgressMessage,
  isPortalAntiBotBlock,
  isPortalChallengeHint,
  LeadsScrapeError,
  resolveLeadsPhaseStallMs,
} from "./waba-leads-cnpj-casadosdados.adapter";
import { resolveCasaDosDadosUserAgent } from "./waba-leads-cnpj-browser-runtime";
import {
  shouldResumeZeroCopyPortalList,
  shouldStayOnPortalScrapeForThisList,
  scrapeResumePriority,
  resolveMaxConcurrentScrapes,
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

describe("Leads PJ anti-bot Cloudflare", () => {
  it("reconhece desafio Just a moment / Turnstile / Ray ID", () => {
    assert.equal(isPortalChallengeHint({ title: "Just a moment..." }), true);
    assert.equal(isPortalChallengeHint({ title: "Um momento…" }), true);
    assert.equal(
      isPortalChallengeHint({ url: "https://portal.casadosdados.com.br/cdn-cgi/challenge-platform" }),
      true,
    );
    assert.equal(
      isPortalChallengeHint({ body: "Enable JavaScript and cookies to continue. Ray ID: abc" }),
      true,
    );
    assert.equal(isPortalChallengeHint({ title: "Pesquisa", url: "/plataforma/pesquisa" }), false);
  });

  it("trata bloqueio anti-bot como recover de Chromium, não falha permanente", () => {
    assert.equal(
      isPortalAntiBotBlock(
        new Error(
          'Portal Casa dos Dados ainda em verificação anti-bot (login). title=Just a moment...; url=https://portal.casadosdados.com.br/entrar',
        ),
      ),
      true,
    );
    assert.equal(isPortalAntiBotBlock(new Error("ANTI_BOT: turnstile")), true);
    assert.equal(isPortalAntiBotBlock(new Error("Timeout 30000ms exceeded")), false);
  });

  it("monta User-Agent Chrome alinhado à versão do Chromium", () => {
    assert.match(
      resolveCasaDosDadosUserAgent("127.0.6533.17"),
      /Chrome\/127\.0\.0\.0 Safari\/537\.36/,
    );
  });
});

describe("Leads PJ fase presa", () => {
  it("não trata pulso de keepalive como progresso real", () => {
    assert.equal(
      isKeepaliveProgressMessage("FILTERS: abrindo tela de pesquisa… — 1258s"),
      true,
    );
    assert.equal(
      isKeepaliveProgressMessage("COPY: retomada rápida → pág. 382 (storageState; sem CNAE)…"),
      false,
    );
  });

  it("limita o stall de fase entre 30s e 180s", () => {
    const ms = resolveLeadsPhaseStallMs();
    assert.equal(ms >= 30_000, true);
    assert.equal(ms <= 180_000, true);
  });

  it("aborta a Promise da sessão mesmo sem o Playwright rejeitar", async () => {
    const gate = createSessionAbortGate();
    const hung = new Promise<string>(() => undefined);
    const raced = Promise.race([hung, gate.promise]);
    const err = new LeadsScrapeError(
      "PHASE_STALL",
      "new-browser",
      "FILTERS: abrindo tela de pesquisa… preso 90s",
    );
    assert.equal(gate.abort(err), true);
    assert.equal(gate.abort(err), false);
    await assert.rejects(raced, (caught: unknown) => {
      assert.equal(caught instanceof LeadsScrapeError, true);
      assert.equal((caught as LeadsScrapeError).code, "PHASE_STALL");
      assert.equal((caught as LeadsScrapeError).recovery, "new-browser");
      return true;
    });
  });

  it("trata PHASE_STALL como recover de Chromium", () => {
    assert.equal(isChromiumTargetCrash(new Error("PHASE_STALL preso 90s")), true);
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

describe("Leads PJ fila de Chromium", () => {
  it("prioriza cópia na pág. 381 sobre LOGIN zerado", () => {
    assert.equal(
      scrapeResumePriority({ scrapeCheckpoint: { nextPage: 382, collectedCount: 8423 } }) >
        scrapeResumePriority({ scrapeCheckpoint: { nextPage: 1, collectedCount: 0 } }),
      true,
    );
  });

  it("abre várias listas em paralelo (default 4; teto 1–2 vira 4)", () => {
    const prevMax = process.env.CASADOSDADOS_MAX_CONCURRENT_SCRAPES;
    delete process.env.CASADOSDADOS_MAX_CONCURRENT_SCRAPES;
    try {
      assert.equal(resolveMaxConcurrentScrapes(), 4);
      process.env.CASADOSDADOS_MAX_CONCURRENT_SCRAPES = "2";
      assert.equal(resolveMaxConcurrentScrapes(), 4);
      process.env.CASADOSDADOS_MAX_CONCURRENT_SCRAPES = "6";
      assert.equal(resolveMaxConcurrentScrapes(), 6);
    } finally {
      if (prevMax === undefined) delete process.env.CASADOSDADOS_MAX_CONCURRENT_SCRAPES;
      else process.env.CASADOSDADOS_MAX_CONCURRENT_SCRAPES = prevMax;
    }
  });
});
