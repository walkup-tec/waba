import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyGotoFailure,
  classifySearchWaitOutcome,
  collectCnpjTokensFromText,
  createSessionAbortGate,
  isChromiumTargetCrash,
  isKeepaliveProgressMessage,
  isPortalAntiBotBlock,
  isPortalChallengeHint,
  isPortalSearchEmptyText,
  isSearchAckProgress,
  LeadsScrapeError,
  PORTAL_PAGINATION_SELECTOR,
  resolveLeadsPhaseStallMs,
  shouldBlockSearchWithoutCnae,
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

describe("Leads PJ SEARCH classify/ACK", () => {
  it("não trata modal CNAE (só dialogs) como ACK de pesquisa", () => {
    const before = {
      url: "https://portal.casadosdados.com.br/plataforma/pesquisa",
      searchButtonDisabled: false,
      loadingNodes: 0,
      pagination: false,
      cnpjNodes: 0,
      dialogs: 1,
    };
    assert.equal(
      isSearchAckProgress(before, { ...before, dialogs: 2 }),
      false,
    );
    assert.equal(
      isSearchAckProgress(before, { ...before, loadingNodes: 1 }),
      true,
    );
    assert.equal(
      isSearchAckProgress(before, { ...before, cnpjNodes: 3 }),
      true,
    );
    assert.equal(
      isSearchAckProgress(before, { ...before, pagination: true }),
      true,
    );
    assert.equal(
      isSearchAckProgress(before, { ...before, emptyHint: true }),
      true,
    );
  });

  it("classifica vazio, bloqueio, resultados e idle", () => {
    assert.equal(
      classifySearchWaitOutcome({
        cnpjNodes: 0,
        pagination: false,
        loadingNodes: 0,
        emptyHint: true,
        blocked: false,
      }),
      "empty",
    );
    assert.equal(
      classifySearchWaitOutcome({
        cnpjNodes: 0,
        pagination: false,
        loadingNodes: 0,
        emptyHint: false,
        blocked: false,
        interceptedTotal: 0,
      }),
      "empty",
    );
    assert.equal(
      classifySearchWaitOutcome({
        cnpjNodes: 0,
        pagination: false,
        loadingNodes: 0,
        emptyHint: false,
        blocked: true,
      }),
      "blocked",
    );
    assert.equal(
      classifySearchWaitOutcome({
        cnpjNodes: 8,
        pagination: true,
        loadingNodes: 0,
        emptyHint: false,
        blocked: false,
      }),
      "results",
    );
    assert.equal(
      classifySearchWaitOutcome({
        cnpjNodes: 0,
        pagination: false,
        loadingNodes: 2,
        emptyHint: false,
        blocked: false,
      }),
      "searching",
    );
    assert.equal(
      classifySearchWaitOutcome({
        cnpjNodes: 0,
        pagination: false,
        loadingNodes: 0,
        emptyHint: false,
        blocked: false,
      }),
      "idle",
    );
  });

  it("reconhece texto de zero empresas sem confundir com 0 selecionados do CNAE", () => {
    assert.equal(isPortalSearchEmptyText("Pesquisa retornou 0 empresas"), true);
    assert.equal(isPortalSearchEmptyText("Nenhum resultado encontrado"), true);
    assert.equal(isPortalSearchEmptyText("0 selecionados"), false);
    assert.equal(isPortalSearchEmptyText("Atividade Principal (CNAE)"), false);
  });

  it("conta CNPJ com máscara e 14 dígitos sem pontuação", () => {
    assert.deepEqual(collectCnpjTokensFromText("94.361.474/0001-02 - LCT"), ["94.361.474/0001-02"]);
    assert.deepEqual(collectCnpjTokensFromText("empresa 94361474000102 ativa"), ["94361474000102"]);
  });

  it("bloqueia SEARCH quando o CNAE pedido não foi aplicado", () => {
    assert.equal(
      shouldBlockSearchWithoutCnae({ atividadePrincipalCnae: "6619302", cnaeApplied: false }),
      true,
    );
    assert.equal(
      shouldBlockSearchWithoutCnae({ atividadePrincipalCnae: "6619302", cnaeApplied: true }),
      false,
    );
    assert.equal(
      shouldBlockSearchWithoutCnae({ atividadePrincipalCnae: "", cnaeApplied: false }),
      false,
    );
  });

  it("mantém o seletor Oruga e inclui fallback de paginação", () => {
    assert.match(PORTAL_PAGINATION_SELECTOR, /data-oruga="pagination"/);
    assert.match(PORTAL_PAGINATION_SELECTOR, /pagination-list/);
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
