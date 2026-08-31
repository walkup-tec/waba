# Briefing técnico — Leads PJ / Casa dos Dados (últimas ~10h) + prompt GPT

Data: 2026-08-23  
Ambiente: produção `waba_disparador` (Docker Swarm / Easypanel / Xvfb)  
Portal: Casa dos Dados (Playwright Chromium)  
Campanha-alvo: Corban (`portal:corban`, CNAE `6619302`, Ativa, secundária, celular, maxPages 1000)

---

## Objetivo de negócio (comportamento esperado)

```
Login → aplicar filtros (CNAE + situação + toggles)
→ Pesquisar → portal lista páginas (~20 CNPJs/página)
→ Copiar página 1 → próxima → copiar → … até ~1000 páginas
→ Pool → enrich ReceitaWS → Excel
```

Requisitos duros do usuário:
- Sem travar
- Sem fechar Chromium no meio
- Sem refazer CNAE/login a cada falha operacional
- Múltiplas extrações possíveis (soft-cap 2)

---

## Arquitetura relevante

| Camada | Arquivo | Papel |
|--------|---------|--------|
| Service | `waba-leads-cnpj.service.ts` | Jobs, pool, checkpoint, soft-cap, enrich queue |
| Adapter | `waba-leads-cnpj-casadosdados.adapter.ts` | Playwright: login, filtros, CNAE, paginação, cópia |
| Deploy | Dockerfile `COPY dist ./dist` | **Produção NÃO compila `src`** — marker só vale se `dist/` for commitado |
| Marker | `GET /health` → `deployMarker` | Confirmar código vivo |

Constraint: Chromium em container + Xvfb; DOM pesado do portal → `Target crashed` / renderer kill.

---

## Linha do tempo: problemas → soluções

### 1) Muitos Chromiums → crash
- **Problema:** N listas em paralelo → Page crashed / browser closed.
- **Solução 1:** Mutex 1 Chromium (estável, lento demais).
- **Solução 2:** Paralelo ilimitado “como V02” (voltou a crashar).
- **Solução 3 (vigente):** Soft-cap **máx. 2** + stagger 20s entre launches.

### 2) Renderer / DOM pesado
- **Problema:** Após Pesquisar, `locator('body').filter(hasText)` + `innerText` completo → crash ~página 8; pool 140 congelado.
- **Solução:** Flags Chromium leves; wait via `waitForFunction` em sample 8k de `main`; cards via `evaluate` leve; sem scrollIntoView no Pesquisar; retries classificando crash vs operacional.

### 3) Raspagem parcial → enrich cedo
- **Problema:** Portal ~8070 empresas; pool parou em 140 e foi para ReceitaWS.
- **Solução:** Partial scrape guard — retomada sem cards não limpa checkpoint; endpoint `resume-scrape`; (depois revertido parcialmente no v7: página vazia não deve mais forçar reconnect).

### 4) Delete incompleto
- **Problema:** Excluir lista deixava slot Chromium / merge async recriando pool.
- **Solução:** Force-release slot + `purgedCampaignKeys` + abort checkpoint se lista excluída.

### 5) Stall watchdog 90s (crítico)
- **Problema:** Sem mudança em `progressMessage` por 90s → fecha Chromium → login+CNAE de novo em loop.
- **Solução:** Stall close **off** por default; keepalive 25s; pulse em “aguardando resultados”; browser.close só no `finally`.

### 6) Checkpoint fantasma + paginação Xvfb
- **Problema:** `posicionando passo N/25 (UI 5→11)` com pool 0; jump Playwright lento; falha → reinício total.
- **Solução:** Pool 0 + ckpt>1 → força pág. 1; salto DOM nativo; falha de posição → página 1 (dedupe).

### 7) Hang no CNAE
- **Problema:** Horas em `selecionando CNAE 6619302…` com keepalive mascando.
- **Solução:** CNAE em fases + timeout duro; se falhar, fecha modal e segue (não hang infinito).

### 8) Hang em “aplicando demais filtros”
- **Problema:** Após CNAE ok, minutos percorrendo campos vazios no Xvfb.
- **Solução:** Só campos com valor; switches `true` em um `evaluate`; situação só as pedidas.

### 9) Página vazia / next fail → reabre portal (CNAE de novo)
- **Problema:** Throw em página vazia → wrapper “falha operacional” → Chromium novo → CNAE → “aguardando resultados”.
- **Solução v7:** Empty page = reread + advance; wrapper só reconecta em Target crash; paginação retry na mesma sessão; cópia incompleta mantém checkpoint.

### 10) Deploy enganoso
- **Problema:** Push `src` sem `dist` → Redeploy “ok” mas `/health` marker antigo.
- **Solução operacional:** Sempre commit `dist/` + validar `deployMarker` após Redeploy.

### 11) Estado atual (pós-v7, residual)
- Marker live: `DEPLOY-2026-08-23-1955-leads-pj-single-session-copy-v7`
- Corban: `scraping` · `Pesquisando: clicando Pesquisar… (navegador aberto — persistindo)` · **pool 0**
- Chromium permanece aberto (desejado), mas o **clique em Pesquisar parece hang** (não chega a “aguardando resultados” / “Copiando: página N”).

---

## Conflitos entre patches (atenção GPT)

| Patch A | Patch B | Tensão |
|---------|---------|--------|
| Stall 90s fecha browser | Keep browser até fim | Stall desligado — hang pode ficar “vivo” para sempre |
| Empty page → throw (partial guard) | Empty page → advance (v7) | v7 prevalece; reconnect só em crash |
| Resume jump até pág. N | Checkpoint fantasma pool 0 | Força start=1 se pool vazio |
| Soft-cap 2 | 1 sessão longa 1000 págs | OK se 1 job; 2 jobs longos competem por CPU/RAM |

---

## Prompt pronto para colar no GPT

```text
Você é um engenheiro sênior de automação web (Playwright + Chromium headless/Xvfb em Docker). Preciso de uma SOLUÇÃO DEFINITIVA (arquitetura + mudanças concretas de código), não de patches incrementais.

# Contexto do produto
Sistema WABA (Node/Express) com módulo Marketing → Leads PJ.
Fluxo: Playwright abre Casa dos Dados → login → filtros (CNAE etc.) → Pesquisar → copia CNPJ+Razão Social página a página (~20/página, até 1000 páginas) → pool → enrich ReceitaWS → Excel.

Produção: container Docker Swarm (Easypanel), Chromium sob Xvfb, soft-cap máximo 2 scrapes simultâneos.
Dockerfile copia `dist/` — produção NÃO transpila TypeScript; código vivo exige `dist` commitado + Redeploy + validar GET /health.deployMarker.

Arquivos-chave:
- src/marketing/leads-cnpj/waba-leads-cnpj.service.ts (orquestração, pool, checkpoint, soft-cap)
- src/marketing/leads-cnpj/waba-leads-cnpj-casadosdados.adapter.ts (Playwright)

Campanha exemplo Corban: CNAE 6619302, situacao Ativa, incluirAtividadeSecundaria=true, somenteCelular=true, maxPages=1000. Portal retorna milhares de empresas (~8070).

# Comportamento desejado (contrato)
1) Uma sessão Chromium por job: login → filtros → CNAE → Pesquisar UMA vez.
2) Loop estável: ler cards da página → arquivar no pool/checkpoint → clicar próxima → repetir até fim (~1000) OU 3 páginas vazias seguidas OU teto UI Oruga.
3) NÃO fechar Chromium por “demora” de filtro/pesquisa.
4) NÃO reabrir portal / refazer CNAE por página vazia ou falha leve de paginação.
5) Só reabrir Chromium se Target crashed / browser disconnected; aí retomar da checkpoint.nextPage SEM perder pool.
6) Nunca enviar para enrich com pool parcial se a cópia ainda não terminou (a menos que usuário cancele).
7) UI de progresso deve refletir fase real (não só keepalive cosmético).

# Problemas reais das últimas ~10 horas (e o que já tentamos)

A) N Chromiums paralelos → Target crashed / container sob pressão
   → mutex 1 (lento) → paralelo ilimitado (crash) → soft-cap 2 + stagger 20s (atual)

B) DOM pesado: locator body.filter(hasText) / innerText completo após Pesquisar → crash ~página 8, pool 140
   → waitForFunction em sample 8k; cards via evaluate leve; sem scrollIntoView no Pesquisar

C) Retomada vazia limpava checkpoint e ia para enrich com 140 de ~8070
   → partial scrape guard + resume-scrape API

D) Delete deixava slot Chromium / merge async recriando pool
   → forceRelease + purgedCampaignKeys

E) Watchdog stall 90s fechava Chromium no meio do CNAE/Pesquisar → loop login+CNAE
   → stall OFF; keepalive 25s; browser.close só no finally

F) Checkpoint fantasma (ex.: página 11) com pool 0 + jump Playwright lento no Xvfb
   → força start page 1 se pool 0; salto DOM nativo; se jump falha, copia da 1

G) Hang infinito em “selecionando CNAE…”
   → CNAE em fases + timeout; se falhar, segue sem hang

H) Hang longo em “aplicando demais filtros” com campos vazios
   → só preenche campos com valor; toggles true em um evaluate

I) Página vazia / next fail → throw → wrapper reabria portal → CNAE de novo
   → v7: empty = reread+advance; reconnect só em crash; cópia incompleta mantém checkpoint

J) Deploy: push src sem dist → marker antigo em produção

K) ESTADO ATUAL (ainda quebrado): marker v7 live, mas job Corban fica em
   “Pesquisando: clicando Pesquisar… (navegador aberto — persistindo)” com pool=0.
   Keepalive mascara; clique Playwright em Pesquisar parece hangar além do timeout;
   não chega a “aguardando resultados” nem “Copiando: página N”.

# Tensões entre patches
- Stall off evita reconnect loop, mas hang pode durar “para sempre” (keepalive mente que está vivo).
- Partial-guard (throw em empty) conflitava com “nunca reconectar”; v7 prioriza sessão única.
- Soft-cap 2 + sessão de 1000 páginas = pressão de CPU/RAM se 2 jobs longos.

# O que eu quero de você
1) Diagnóstico da causa raiz mais provável do hang atual em “clicando Pesquisar” sob Xvfb/Playwright.
2) Desenho de uma arquitetura DEFINITIVA do scraper (máquina de estados clara: LOGIN → FILTERS → SEARCH → COPY_LOOP → DONE/CRASH_RECOVER), com timeouts duros por fase e progresso real (não só keepalive).
3) Estratégia de paginação robusta no Oruga (nav[data-oruga=pagination]): next, jump, detecção de fim, sem depender de locator body pesado.
4) Política clara de recovery: quando manter a mesma Page; quando novo Browser; como retomar sem refazer CNAE se cookies/sessão portal permitirem (ou por que não dá).
5) Pseudocódigo / checklist de mudanças nos 2 arquivos TypeScript acima (mínimas, sem rewrite total desnecessário).
6) Plano de validação observável: quais progressMessages e métricas (poolPending, checkpoint.nextPage) devem aparecer a cada etapa até página 50+ sem CNAE de novo.
7) Riscos (Cloudflare, modal CNAE, soft-cap, memória) e mitigação.

Restrições:
- Não sugerir “só use a API oficial” como única solução (hoje a coleta é via UI; API é opt-in raro).
- Não sugerir docker service update --force Traefik / reiniciar host como fix do scraper.
- Preferir evaluate/DOM click leve no Xvfb; evitar Playwright locators que reavaliam DOM inteiro.
- Soft-cap 2 permanece regra de negócio.
- Responda em português, estruturado, com prioridade do que implementar primeiro.
```

---

## Keywords
leads-pj, casadosdados, playwright, xvfb, chromium-crash, cnae, pagination, soft-cap, stall-watchdog, deploy-marker-dist, briefing-gpt
