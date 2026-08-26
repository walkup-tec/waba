Registro permanente do celular virtual: **`doc/DEVICE-CLOUD.md`**.

## 2026-08-26 10:28 — Alternativa botão nativo sempre + sem título em negrito
- Rótulo da IA só altera `displayText`; payload continua `sendButtons` URL
- Sem fallback `sendText` sem botão; retry com `Quero saber mais` se o rótulo da IA falhar
- Texto inteiro em `description`; botão até 20 caracteres
- Marker `DEPLOY-2026-08-26-alternativa-botao-nativo-sempre`
- LOG: `doc/LOG-2026-08-26__102200__alternativa-sem-titulo-botao-20.md`

## 2026-08-25 19:05 — Meta Tech Provider integrado no master atual (local)

- Branch local `feat/meta-tech-provider-master` sobre `origin/master` `8f05836`
- Cherry-pick `1e29b80` com conflitos resolvidos: master + wiring Meta (`/bets`+legais, marketing+Laboratório)
- Build PASS; testes Meta 121/0; **sem push / sem deploy**
- LOG: `doc/LOG-2026-08-25__190500__meta-tech-provider-master-integration.md`

## 2026-08-24 16:50 — Leads PJ pages metric v9.24

- Coluna Páginas = checkpoint Oruga (não CNPJ/20); sem rewind de checkpoint
- Retomada não adota UI ≫ piso; ERR_ABORTED → recover
- E2E dual: `scripts/e2e-leads-pj-dual.cjs`
- Marker `DEPLOY-2026-08-24-1650-leads-pj-pages-metric-v9.24`
- LOG: `doc/LOG-2026-08-24__165000__leads-pj-pages-metric-v924.md`

## 2026-08-24 16:30 — Leads PJ login/SEARCH recover v9.23

- goto com teto Node; login/SEARCH timeout → new-browser; soft-cap 2
- Marker `DEPLOY-2026-08-24-1630-leads-pj-login-search-recover-v9.23`
- LOG: `doc/LOG-2026-08-24__163000__leads-pj-login-search-recover-v923.md`

## 2026-08-24 16:10 — Leads PJ Page crashed recover v9.22

- `Page crashed` vira hard reconnect; soft-cap default 3 + stagger 8s
- Marker `DEPLOY-2026-08-24-1610-leads-pj-page-crash-recover-v9.22`
- LOG: `doc/LOG-2026-08-24__161000__leads-pj-page-crash-recover-v922.md`

## 2026-08-24 15:45 — Leads PJ raspagens paralelas v9.21

- Soft-cap default 10; Chromium dedicado por job; stagger 0
- Marker `DEPLOY-2026-08-24-1545-leads-pj-parallel-scrapes-v9.21`
- LOG: `doc/LOG-2026-08-24__154500__leads-pj-parallel-scrapes-v921.md`

## 2026-08-24 15:25 — Alternativa contact/save em background

- Cada lead: nome aleatório + `POST /contact/save` na instância, sem `await`
- Falha/timeout (2s) não barra nem atrasa o `sendButtons`
- LOG: `doc/LOG-2026-08-24__152500__alternativa-contact-save-background.md`

## 2026-08-24 15:15 — Leads PJ sem early-stop v9.20

- `portalTotal` não encolhe `pagesToFetch`; meta = maxPages
- `isPortalScrapeReallyComplete` bloqueia enrich em 104/1000
- Marker `DEPLOY-2026-08-24-1515-leads-pj-no-early-stop-v9.20`
- LOG: `doc/LOG-2026-08-24__151500__leads-pj-no-early-stop-v920.md`

## 2026-08-24 15:05 — CTA Alternativa máx. 15 caracteres

- Rótulo do botão URL (GPT + normalização) limitado a 15 caracteres
- LOG: `doc/LOG-2026-08-24__144500__alternativa-cta-variavel-optout-italico.md`

## 2026-08-24 14:45 — Alternativa CTA variável + opt-out itálico

- Mesma chamada GPT: `body` + `buttonLabel` (variação do CTA do usuário, ≤20) + `optOut`
- Opt-out no final do texto em itálico WhatsApp (`_..._`); destino do botão inalterado
- LOG: `doc/LOG-2026-08-24__144500__alternativa-cta-variavel-optout-italico.md`

## 2026-08-24 14:36 — Leads PJ resume jump v9.19

- Retomada pág. alta: hop + next com teto = distância (env não corta)
- Falha de salto ≠ renderer morto — continua da UI (dedupe pool)
- Marker `DEPLOY-2026-08-24-1436-leads-pj-resume-jump-v9.19`
- LOG: `doc/LOG-2026-08-24__143000__leads-pj-resume-jump-v919.md`

## 2026-08-24 14:05 — Alternativa: sem `**` antes do texto

- Evolution envolve `title` em `*...*`; ZWSP virava `**` na digitação.
- Title volta a ser a primeira linha real; resto em `description`.
- Marker `DEPLOY-2026-08-24-alternativa-sem-asteriscos-titulo`
- LOG: `doc/LOG-2026-08-24__140500__alternativa-sem-asteriscos-titulo.md`

## 2026-08-24 13:52 — Motor Alternativa teto 100/dia + pausa ±30%

- Teto: `ALTERNATIVA_MAX_SENDS_PER_DAY_PER_NUMBER = 100` (throttle 8h–22h ≈ 240–264s, 8/h)
- Pausa do ciclo: base 14 min com sorteio estável por ciclo em ±30% (≈ 9,8–18,2 min)
- LOG: `doc/LOG-2026-08-24__135200__alternativa-motor-teto-100-pausa-jitter.md`

## 2026-08-24 13:35 — Leads PJ resume floor v9.18

- Piso do pool na retomada rápida + recover; rejeita salto de checkpoint
- goToResultsPage sem next quando UI > alvo; sync UI após posicionar
- Marker `DEPLOY-2026-08-24-1335-leads-pj-resume-floor-v9.18`
- LOG: `doc/LOG-2026-08-24__133500__leads-pj-resume-floor-v918.md`

## 2026-08-24 13:15 — Leads PJ copy every page v9.17

- Regra: copiar todos os CNPJs de cada página visitada
- Checkpoint inflado → piso `pool/20+1`; métricas alinhadas a CNPJs/20
- COPY não avança se cards sem CNPJ parseável
- Marker `DEPLOY-2026-08-24-1315-leads-pj-copy-every-page-v9.17`
- LOG: `doc/LOG-2026-08-24__131500__leads-pj-copy-every-page-v917.md`

## 2026-08-24 13:05 — Leads PJ fast resume v9.16

- Retomada pós-crash: storageState → pesquisa → pág. N sem CNAE
- Evita loop em LOGIN:/entrar; UI Copiando na retomada
- Marker `DEPLOY-2026-08-24-1305-leads-pj-fast-resume-v9.16`
- LOG: `doc/LOG-2026-08-24__130500__leads-pj-fast-resume-v916.md`

## 2026-08-24 12:25 — Leads PJ context leak fix v9.15

- Fecha Context sempre no finally; não mata Chromium se ainda conectado
- Soft-cap 1 com browser compartilhado
- Marker `DEPLOY-2026-08-24-1225-leads-pj-context-leak-fix-v9.15`
- LOG: `doc/LOG-2026-08-24__122500__leads-pj-context-leak-fix-v915.md`

## 2026-08-24 11:45 — Leads PJ browser runtime v9.14 (A+B+C)

- Browser compartilhado (`launchServer`+`connect`); sem `browser.close` no fim do job
- Recovery em níveis; UI Copiando em soft recover; storageState em `/app/data`
- Script Swarm tmpfs `/dev/shm`; env `CASADOSDADOS_USE_DEV_SHM`
- Marker `DEPLOY-2026-08-24-1145-leads-pj-browser-runtime-v9.14`
- LOG: `doc/LOG-2026-08-24__114500__leads-pj-browser-runtime-v914.md`

## 2026-08-24 11:00 — Leads PJ auto-retoma cópia incompleta v9.13

- Boot retoma cópia se páginas &lt; 1000 e sem `scrapeCompleted`
- Lista ready (Excel) preservada; linha `· cópia portal` (`#portal-copy`)
- Marker `DEPLOY-2026-08-24-1100-leads-pj-auto-retoma-copia-v9.13`
- LOG: `doc/LOG-2026-08-24__110000__leads-pj-auto-retoma-copia-v913.md`

## 2026-08-24 10:45 — Leads PJ cópia completa antes do enrich v9.12

- Não enriquecer com raspagem incompleta (ex.: 118/1000)
- Enrich só após `scrapeCompleted`; fila ReceitaWS no pool
- Marker `DEPLOY-2026-08-24-1045-leads-pj-copia-antes-enrich-v9.12`
- LOG: `doc/LOG-2026-08-24__104500__leads-pj-copia-antes-enrich-v912.md`

## 2026-08-24 10:30 — Leads PJ download azul/verde + fila confirmada v9.11

- Fila diária já no service (lote do dia → Excel → resto no pool)
- Botão Excel: sem underline; azul pendente / verde após `downloadedAt`
- Marker `DEPLOY-2026-08-24-1030-leads-pj-download-azul-verde-v9.11`
- LOG: `doc/LOG-2026-08-24__103000__leads-pj-download-azul-verde-fila-v911.md`

## 2026-08-24 10:10 — Leads PJ histórico métricas v9.10

- Colunas: Páginas (N/M), CNPJs copiados, Higienizados
- API: `pagesDone`, `pagesTotal`, `cnpjCopied`, `leadsHigienizados`
- Marker `DEPLOY-2026-08-24-1010-leads-pj-historico-metricas-v9.10`
- LOG: `doc/LOG-2026-08-24__101000__leads-pj-historico-metricas-v910.md`

## 2026-08-24 08:18 — Leads PJ paginação rápida v9.9

- Removido `waitForPortalSearchResults` após cada “próxima” (era ~10–30s+/página)
- Avanço: click DOM + nº página/CNPJ em ≤4s; marker `…paginacao-rapida-v9.9`
- LOG: `doc/LOG-2026-08-24__081800__leads-pj-paginacao-rapida-v99.md`

## 2026-08-24 08:15 — Leads PJ coluna Pool no histórico

- Histórico: coluna **Pool** = `poolPending` (CNPJs copiados no estoque da campanha)
- **Leads** continua sendo o Excel desta lista
- LOG: `doc/LOG-2026-08-24__081500__leads-pj-coluna-pool-historico.md`

## 2026-08-24 07:30 — Leads PJ Excel somente celular v9.8

- Excel/`leadCount` só linhas com celular EVO; sem telefone omitido
- Marker `DEPLOY-2026-08-24-0730-leads-pj-excel-somente-celular-v9.8`
- LOG: `doc/LOG-2026-08-24__073000__leads-pj-excel-somente-celular-v98.md`

## 2026-08-23 23:35 — Leads PJ E2E local OK (v9.7)

- Ambiente controlado: LOGIN→CNAE→SEARCH→COPY pág.1 = **20 CNPJs**, `scrapeCompleted=true`
- Sem push produção até autorização
- Marker local `DEPLOY-2026-08-23-2330-leads-pj-cnae-cdp-safe-v9.7`
- LOG: `doc/LOG-2026-08-23__233500__leads-pj-e2e-local-sucesso-v97.md`

## 2026-08-23 23:10 — Leads PJ CDP hot-path gate v9.6

- `cdpOrReconnect` + `sleepNode`; DOM click/focus fast; UI stage SEARCH; 1ª COPY com teto CDP
- Marker `DEPLOY-2026-08-23-2310-leads-pj-cdp-hotpath-gate-v9.6`
- LOG: `doc/LOG-2026-08-23__231000__leads-pj-cdp-hotpath-gate-v96.md`

## 2026-08-23 22:50 — Leads PJ CTA fast probe v9.5

- Pré-clique SEARCH: fast CTA (sem probeSearchState pesado); timeout CDP → `new-browser`
- Marker `DEPLOY-2026-08-23-2250-leads-pj-cta-fast-probe-v9.5`
- LOG: `doc/LOG-2026-08-23__225000__leads-pj-cta-fast-probe-v95.md`

## 2026-08-23 22:40 — Leads PJ pré-CTA lite probe v9.4

- runSearchOnce sem probeSearchState completo; waitForSearchTransition com lite+Node
- Marker `DEPLOY-2026-08-23-2240-leads-pj-precta-lite-probe-v9.4`
- LOG: `doc/LOG-2026-08-23__224000__leads-pj-precta-lite-probe-v94.md`

## 2026-08-23 22:25 — Leads PJ ACK Node deadline v9.3

- waitForSearchAck com setTimeout Node + probe leve; sem page.waitForTimeout no loop
- Marker `DEPLOY-2026-08-23-2225-leads-pj-ack-node-deadline-v9.3`
- LOG: `doc/LOG-2026-08-23__222500__leads-pj-ack-node-deadline-v93.md`

## 2026-08-23 22:05 — Leads PJ CNAE modal Node timeout v9.2

- Escape + setTimeout Node; sem locator Fechar (fila CDP)
- Marker `DEPLOY-2026-08-23-2205-leads-pj-cnae-modal-node-timeout-v9.2`
- LOG: `doc/LOG-2026-08-23__220500__leads-pj-cnae-modal-node-timeout-v92.md`

## 2026-08-23 21:45 — Leads PJ search discovery v9.1

- Matcher amplo includes(pesquisar/buscar) + ancestral; SEARCH_BUTTON_NOT_FOUND + dump
- Marker `DEPLOY-2026-08-23-2145-leads-pj-search-discovery-v9.1`
- LOG: `doc/LOG-2026-08-23__214500__leads-pj-search-discovery-v91.md`

## 2026-08-23 21:00 — Leads PJ search ACK v9

- Probe/ACK + fallbacks mouse→DOM→Enter; soft errors sem reconnect no service
- Marker `DEPLOY-2026-08-23-2100-leads-pj-search-ack-v9`
- LOG: `doc/LOG-2026-08-23__210000__leads-pj-search-ack-v9.md`

## 2026-08-23 20:15 — Leads PJ state machine v8

- SEARCH mouse.click (sem locator.click); waitForSearchTransition 90s; renderer probe
- scrapeCompleted gate no enrich; marker `DEPLOY-2026-08-23-2015-leads-pj-state-machine-v8`
- LOG: `doc/LOG-2026-08-23__201500__leads-pj-state-machine-v8.md`

## 2026-08-23 20:05 — Briefing GPT Leads PJ (10h problemas/soluções)

- Consolidado A–K + prompt pronto para GPT (solução definitiva)
- LOG: `doc/LOG-2026-08-23__200500__leads-pj-briefing-gpt-definitivo.md`

## 2026-08-23 19:55 — Leads PJ: uma sessão até copiar as páginas

- Sem reconectar/refazer CNAE em página vazia; só reabre Chromium se crash.
- Marker `DEPLOY-2026-08-23-1955-leads-pj-single-session-copy-v7`
- LOG: `doc/LOG-2026-08-23__195500__leads-pj-single-session-copy-v7.md`

## 2026-08-23 19:35 — Leads PJ: pular filtros vazios

- Pós-CNAE só aplica campos/switches ativos; sem esperar filtros não usados.
- Marker `DEPLOY-2026-08-23-1935-leads-pj-skip-empty-filters-v6`
- LOG: `doc/LOG-2026-08-23__193500__leads-pj-skip-empty-filters-v6.md`

## 2026-08-23 18:25 — Leads PJ: CNAE sem hang

- Fases + timeout curto; falha não trava — segue filtros/Pesquisar.
- Marker `DEPLOY-2026-08-23-1825-leads-pj-cnae-nohang-v5`
- LOG: `doc/LOG-2026-08-23__182500__leads-pj-cnae-nohang-v5.md`

## 2026-08-23 18:05 — Leads PJ: paginação Xvfb anti-parada

- Checkpoint fantasma (pool 0) → página 1; salto DOM + fallback copiar desde 1.
- Marker `DEPLOY-2026-08-23-1805-leads-pj-pagination-xvfb-v4` (precisa `dist/` no Git).
- LOG: `doc/LOG-2026-08-23__180500__leads-pj-pagination-xvfb-v4.md`

## 2026-08-23 17:15 — Leads PJ: Chromium aberto até fim da cópia

- Stall close (90s) desligado por padrão — era ele que matava a sessão em produção (≠ V02).
- Keepalive + pulse em “aguardando resultados”; fecha browser só no fim da cópia ou exclusão.
- Marker `DEPLOY-2026-08-23-leads-pj-keep-browser-until-copy-v1`
- LOG: `doc/LOG-2026-08-23__171500__leads-pj-keep-browser-until-copy.md`

## 2026-08-21 18:02 — Troca automática de instância na campanha

- Tick substitui desconectado por conectado habilitado para disparos; Proxy off no que sai / on no que entra.
- «+ Instâncias» só sem reserva ou campanha pausada.
- Marker `DEPLOY-2026-08-21-campanha-auto-swap-instancias`
- LOG: `doc/LOG-2026-08-21__180200__campanha-auto-swap-instancias.md`

## 2026-08-21 17:20 — Campanha: open na EVO deve disparar

- Pausa automática só com mínimo de connectionState open não confirmado. Retoma sozinha. Pick via live state.
- Marker `DEPLOY-2026-08-21-campanha-open-deve-enviar`
- LOG: doc/LOG-2026-08-21__172000__campanha-open-deve-enviar.md

## 2026-08-21 14:50 — Reconexão: purge EVO (preserva foguinhos e totais)

- Clones do mesmo JID e sessão antiga são apagados na Evolution. Foguinhos e `logs_envios` ficam.
- Marker `DEPLOY-2026-08-21-evo-reconnect-purge`
- LOG: doc/LOG-2026-08-21__145000__evo-reconnect-purge.md

## 2026-08-21 10:35 — Alternativa: texto corrido (sem título em negrito)

- Evolution 2.4 envolve `title` em `*...*`. WABA não parte mais o texto em title/description.
- Marker `DEPLOY-2026-08-21-alternativa-body-sem-titulo`
- LOG: doc/LOG-2026-08-21__103500__fix-alternativa-texto-corrido.md

## 2026-08-21 10:21 — Evolution 2.4.0 no ar + 1 sendButtons

- GET `/`: `version=2.4.0`. sendButtons 201: `interactiveMessage` + `cta_url`, sem `viewOnce`.
- Conferir no celular do chip **walkup** (5197462102): texto sem URL + botão **Quero saber mais**.
- LOG: doc/LOG-2026-08-21__100500__pin-evo-2-4-rc2.md

## 2026-08-21 10:05 — Pin Evolution 2.4.0-rc2 (autorizado)

- Script `scripts/pin-evo-2-4-rc2-vps.sh` + workflow SSH. Rollback se não for 2.4 ou LICENSE_REQUIRED.
- LOG: doc/LOG-2026-08-21__100500__pin-evo-2-4-rc2.md

## 2026-08-21 10:00 — EVO 2.4.0-rc2 (semana 11/08) revertida para 2.3.7

- 20/08 11:07: imagem `evoapicloud/evolution-api:2.4.0-rc2` (Baileys 7.0.0-rc.9) — a que renderiza botão.
- 20/08 11:16: Redeploy/update Easypanel trocou para `:latest` = API 2.3.7. GET `/` em 21/08 ainda 2.3.7.
- LOG: doc/LOG-2026-08-21__100000__evo-2-4-rc2-revertida-para-2-3-7.md

## 2026-08-21 09:55 — Botão nativo Alternativa: estudo EVO/WhatsApp (sem patch WABA)

- Evolution 2.3.7 (produção) envolve `sendButtons` em `viewOnceMessage`; o WhatsApp não desenha o botão. O WABA não controla esse wrapper.
- Fix do vendor: Evolution **2.4.0-rc** (remove viewOnce + `native_flow`) ou PR #2651. Cloud API oficial tem `cta_url` (outro canal).
- Patch local que tratava viewOnce+nativeFlow como sucesso foi revertido (regressão 20/08: só imagem).
- LOG: doc/LOG-2026-08-21__095500__estudo-evo-wa-botao-nativo.md

## 2026-08-21 07:17 — Permanência do pareamento (Seguradoras)

- 11/08: campanha enviava sem desligar proxy. 12/08: tick desligava proxy nos offline; Ativar fazia proxy/set no meio do disparo
- Marker `DEPLOY-2026-08-21-alternativa-keep-pairing`
- LOG: doc/LOG-2026-08-21__071700__fix-alternativa-keep-pairing.md

## 2026-08-20 18:43 — Alternativa: texto após imagem (viewOnce)

- sendButtons em viewOnce era tratado como sucesso e o lead pending não mandava texto
- Marker `DEPLOY-2026-08-20-alternativa-image-then-text`
- LOG: doc/LOG-2026-08-20__184300__fix-alternativa-so-imagem.md

## 2026-08-20 18:06 — Alternativa: não mexer proxy no meio do disparo

- Redeploy zerava `ready` em memória → prepare fazia proxy/set + restart e derrubava o pareamento
- Marker `DEPLOY-2026-08-20-alternativa-no-proxy-mid-send`
- LOG: doc/LOG-2026-08-20__180600__fix-alternativa-pareamento-mid-send.md

## 2026-08-20 17:32 — Restaurar botão URL (payload 11/08)

- Causa: `title` ZWSP (`30004a3`) + fallback texto+link em `viewOnce`
- Restaurado payload `4a72c1d` (title real + footer vazio); sem fallback com URL
- Marker `DEPLOY-2026-08-20-alternativa-button-restore`
- LOG: doc/LOG-2026-08-20__173200__restore-alternativa-botao-1108.md

## 2026-08-20 17:19 — Alternativa: botão URL sem texto+link

- Produção enviava fallback com URL + preview WhatsApp; ghost `viewOnce` forçava isso
- sendButtons com `linkPreview: false`; se falhar, só texto sem URL
- Marker `DEPLOY-2026-08-20-alternativa-url-button`
- LOG: doc/LOG-2026-08-20__171900__fix-alternativa-botao-sem-link.md

## 2026-08-20 16:48 — Foguinhos Quente por chip (soma-9224)

- Status conectado + 3 fogos cinza: `uso-config` lento (warmth de todas as instâncias) e rename `9224`→`soma-9224`
- Marker `DEPLOY-2026-08-20-warmth-chip-lookup`
- LOG: doc/LOG-2026-08-20__164800__fix-foguinhos-warmth-chip.md

## 2026-08-20 08:10 — Dispositivos: não fechar WA no open (sem BACK em unknown)

- Causa: BACK quando classify=unknown fechava o WhatsApp na abertura → travava em Conversas com msg falsa de browser
- Fix: esperar/settle; BACK só se browser confirmado; seguir menu mesmo em unknown fraco
- Marker `DEPLOY-2026-08-20-device-cloud-wa-open-wait-no-back`
- LOG: doc/LOG-2026-08-20__081000__device-cloud-wa-open-wait-no-back.md

## 2026-08-20 07:55 — Dispositivos: menu ⋮ → Aparelhos (assertivo)

- Causa: nav por Perfil + digitação sem gate → Chrome recebia o pairingCode
- Fix: caminho oficial Meta (⋮ → Aparelhos → Conectar → Vincular nº) + classifyScreen + não digitar no browser
- Marker `DEPLOY-2026-08-20-device-cloud-menu-aparelhos-assertivo`
- LOG: doc/LOG-2026-08-20__075500__device-cloud-menu-aparelhos-assertivo.md

## 2026-08-20 07:35 — Dispositivos: warm-rail no topo + auto Vincular

- Lingueta compacta (1 linha); status + Cancelar/Inserir na faixa do chrome (não cobre o device / não fica embaixo)
- Auto: Aparelhos conectados → Vincular com número → digitar pairingCode
- Stage: sem `overflow: auto` (sem scrollbar ao lado do device); altura/footer definitivo **adiado** até fechar o fluxo
- Marker `DEPLOY-2026-08-20-device-cloud-warm-rail-topo`
- LOG: doc/LOG-2026-08-20__073500__device-cloud-warm-rail-topo.md

## 2026-08-20 07:15 — Dispositivos: status na lingueta + inserção guiada

- Status do aquecimento na lingueta (subtexto); rodapé sem mensagens de progresso
- Auto-nav/digitação pausados; botão «Inserir código no device» após pairingCode
- Marker `DEPLOY-2026-08-20-device-cloud-lingueta-status-guiado`
- LOG: doc/LOG-2026-08-20__071500__device-cloud-lingueta-status-guiado.md

## 2026-08-20 06:55 — Dispositivos: pairingCode + sem abrir Comunidades

- Causa: backend não propagava `pairingCode`; toque y=1180 abria aba Comunidades
- Fix: extract/job/poll com pairingCode; navegação via Perfil → Aparelhos conectados
- Marker `DEPLOY-2026-08-20-device-cloud-pairingcode-fix`
- LOG: doc/LOG-2026-08-20__065500__device-cloud-pairingcode-comunidades-fix.md

## 2026-08-20 06:38 — Dispositivos: pairingCode automático sem QR

- Lingueta **Adicionar ao Aquecedor**: abre tela de vinculação no device → EVO gera `pairingCode` → sistema digita no WhatsApp
- Removido QR imagem / instrução manual no painel sob o device
- Marker `DEPLOY-2026-08-20-device-cloud-pairing-auto-insert`
- LOG: doc/LOG-2026-08-20__063800__device-cloud-pairing-auto-insert.md
- Palavras-chave: pairingCode, typeDeviceCloudPairingCodeOnDevice, sem-qr

## 2026-08-19 15:18 — Dispositivos: lingueta reutiliza número do Digitar

- `getDeviceCloudRegisteredPhone` / `setDeviceCloudRegisteredPhone` — número salvo por device após **Digitar** (localStorage + memória)
- Lingueta **Adicionar ao Aquecedor** não pede número novamente; fix sintaxe `displayDeviceCloudName`
- Marker `DEPLOY-2026-08-19-device-cloud-lingueta-usa-numero-device` — redeploy Easypanel pendente
- LOG: doc/LOG-2026-08-19__151800__device-cloud-lingueta-usa-numero-device.md
- Palavras-chave: getDeviceCloudRegisteredPhone, layout.phones, Digitar, warmDeviceCloudInstance

## 2026-08-19 14:02 — Dispositivos: lingueta Aquecedor + dist sincronizado
- Lingueta **Adicionar ao Aquecedor** substitui botão Aquecer; sem Início no footer
- Estados: idle / busy / done; pulso menu Instâncias após integração
- Copy sem EVO/Evolution; device → dispositivo
- Produção servia UI antiga: faltava `dist/index.html` (Docker COPY dist)
- Marker `DEPLOY-2026-08-19-device-cloud-lingueta-tab` — redeploy Easypanel pendente
- LOGs: doc/LOG-2026-08-19__132000__device-cloud-lingueta-aquecedor.md, __135200__, __140200__, __134300__
- Palavras-chave: lingueta, device-cloud-warm-tab, dist/index.html, waba_disparador, easypanel

## 2026-08-19 12:50 — Capa de boas-vindas não saía no sendMedia
- Texto chegava; JPEG não. Capa lia só `cwd` (20s, sem URL)
- Agora: `__dirname` + `/app/media` no Docker + timeout 60s + URL pública
- Marker `DEPLOY-2026-08-19-125000-welcome-cover-sendmedia`
- LOG: doc/LOG-2026-08-19__125000__welcome-cover-sendmedia.md

## 2026-08-19 09:12 — Layout boas-vindas iPhone (corte + preview OG)
- Causa: traço `━` (U+2501) + `linkPreview` da Evolution nos dois https
- Texto ASCII + `linkPreview: false`; capa JPEG via sendMedia após ACK
- Marker `DEPLOY-2026-08-19-091200-welcome-layout-ios`
- LOG: doc/LOG-2026-08-19__091200__welcome-layout-ios.md

## 2026-08-19 08:09 — Boas-vindas WhatsApp obrigatória (fila + JID canônico)
- Não trava mais no eleito `drax`; percorre 77770 → walkup → 2477 e qualquer EVO open
- Envia o JID `exists:true`; retry em background até ACK de aparelho
- Marker `DEPLOY-2026-08-19-080900-welcome-must-arrive`
- LOG: doc/LOG-2026-08-19__080900__welcome-must-arrive.md

## 2026-08-18 14:15 — Aquecedor: ERROR outbound antigo não expulsa + purge 6635
- Classificador passou a ignorar `fromMe` com mais de 12h; ERROR recente continua `broken`
- Produção: instância EVO `6635` e cadastro do chip 5181076635 removidos; `walkup`/`1261`/`9224` intactos
- Marker `DEPLOY-2026-08-18-141500-aquecedor-outbound-recency`
- LOG: doc/LOG-2026-08-18__141500__aquecedor-outbound-recency-purge-6635.md

## 2026-08-18 13:30 — Device Cloud: capa não aparecia na galeria
- Nest JSON do Device Cloud era 100 KB; a capa em base64 não chegava no Android
- Arquivo JPEG com nome .png; WhatsApp galeria lê Pictures, não só Download
- Marker `DEPLOY-2026-08-18-133000-device-cloud-capa-gallery`
- LOG: doc/LOG-2026-08-18__133000__device-cloud-capa-gallery.md

## 2026-08-18 13:12 — Device Cloud: colar Ctrl+V no campo focado
- Copiar no PC (Ctrl+C) e colar na tela do celular (Ctrl+V)
- Marker `DEPLOY-2026-08-18-131200-device-cloud-paste` (HTML `deviceCloudLocalClipboard`)
- LOG: doc/LOG-2026-08-18__131200__device-cloud-paste-clipboard.md

## 2026-08-18 13:02 — Device Cloud: teclado do computador
- Clique na tela (borda verde) e digite no PC; Backspace apaga (DEL), não volta
- Marker `DEPLOY-2026-08-18-130200-device-cloud-local-kbd` (HTML `deviceCloudLocalKeyboard`)
- LOG: doc/LOG-2026-08-18__130200__device-cloud-local-keyboard.md

## 2026-08-18 12:41 — Device Cloud: sem botão Voltar na barra
- Toque na tela já volta no WhatsApp; o chrome Voltar apertava o layout
- Removidos botão, CSS `.device-cloud-key-back` e handler `key: back`
- Marker `DEPLOY-2026-08-18-124100-device-cloud-no-voltar` (HTML `deviceCloudNoChromeVoltar`)
- LOG: doc/LOG-2026-08-18__123500__device-cloud-remove-voltar-btn.md

## 2026-08-18 12:21 — Aquecedor: pool com connectionState vazio + chip duplicado
- `6635` (Mozart / 5181076635) fora do ciclo automático; teste manual 1261→6635 chegou
- Empty `connectionState` era ghost; índice de chip ficava com a primeira instância (`6035`)
- Marker `DEPLOY-2026-08-18-aquecedor-pool-live-open`
- LOG: doc/LOG-2026-08-18__122100__fix-aquecedor-pool-live-open.md

## 2026-08-18 12:00 — Device Cloud: roda do mouse na lista de horários
- Giro curto era swipe pequeno / palco `overflow:auto`; lista não andava
- Fix: swipe de página 320 ms na faixa da lista; capture na janela do celular
- Marker `DEPLOY-2026-08-18-device-cloud-wheel-list`
- LOG: doc/LOG-2026-08-18__120000__device-cloud-wheel-hours-list.md

## 2026-08-18 11:42 — Device Cloud: clique WABA não tocava o Android
- Causa: `tryVirtTap` no API AWS considerava sucesso o `ddc-virt-tap` em `/dev/input/event4`, que não move o Compose; o `adb shell input tap` era pulado. `keyevent BACK` (botão Voltar da barra) não usava virt-touch e funcionava.
- Fix: desligar virt-touch no tap/swipe (`adb.client.ts` + `dist`); `systemctl restart ddc-api`.
- Validado na aba Dispositivos: tap Avançar perfil→categoria; pointer no Voltar do WA categoria→perfil.
- LOG: doc/LOG-2026-08-18__114200__device-cloud-virt-tap-noop.md

## 2026-08-18 10:52 — Device Cloud: scroll do mouse na tela
- Roda do mouse vira swipe no Android; a página WABA não rola
- Marker `DEPLOY-2026-08-18-device-cloud-wheel-scroll`
- LOG: doc/LOG-2026-08-18__105200__device-cloud-wheel-scroll.md

## 2026-08-18 10:48 — Device Cloud: clique na tela virava swipe
- Causa: slop de 24px na imagem ~329px; Compose rolava em vez de clicar
- Fix: tap vs swipe por duração/distância; botões Voltar/Início na barra
- Marker `DEPLOY-2026-08-18-device-cloud-tap-not-swipe`
- LOG: doc/LOG-2026-08-18__104800__device-cloud-tap-not-swipe.md

## 2026-08-18 10:12 — Device Cloud: Abrir enviava HOME e fechava o WA
- Causa: `dismissDeviceCloudWhatsAppCrash` com `key: home` 700ms após launch
- Git/produção já estavam alinhados (rename-pencil); não havia deploy pendente
- Marker `DEPLOY-2026-08-18-device-cloud-no-home-after-launch`
- LOG: doc/LOG-2026-08-18__101200__device-cloud-home-fecha-wa.md

## 2026-08-18 10:25 — Device Cloud: cliques lentos + WhatsApp fecha
- Causa: crash JNI Kaleidoscope (ARM64 no x86) + toque esperava screenshot 1s poll
- Fix: toque sem esperar tela; fila input; poll 1,6s; launch force-stop+am start
- Marker `DEPLOY-2026-08-18-device-cloud-input-snappy`
- LOG: doc/LOG-2026-08-18__102500__device-cloud-lag-wa-crash.md

## 2026-08-17 19:45 — Device Cloud: upload imagens locais (PC → Download Android)
- WABA: multer + FormData push-media; skip body parser multipart
- Device Cloud: endpoint push-file (adb push + media scan) — commit cb12758
- Produção: redeploy Easypanel device-cloud-api + WABA pendente
- LOG: doc/LOG-2026-08-17__194500__device-cloud-upload-local-files.md

## 2026-08-17 18:55 — Device Cloud: Abrir WhatsApp fallback + upload perfil/capa
- Causa: API launch 502; WA Business em crash loop no Android teste 1
- Fix WABA: fallback launcher; botão Reiniciar; UI upload JPG/PNG/WebP (proxy push-file)
- Upload depende de `POST /devices/:id/push-file` no Device Cloud AWS (501 até lá)
- Marker `DEPLOY-2026-08-17-device-cloud-abrir-wa-upload`
- LOG: doc/LOG-2026-08-17__185500__fix-device-cloud-abrir-wa-upload.md

## 2026-08-17 16:05 — Device Cloud: Play SMS bloqueava o Avançar
- Causa: Play Services sem permissão de SMS; WhatsApp voltava à tela do número
- Fix: Avançar 690/1100 + Continuar 520,768; se o heads-up do Play aparecer, conceder SMS e repetir
- Validado no Android teste 1: tela **Confirmar seu número** (SMS 6 dígitos)
- Marker `DEPLOY-2026-08-17-device-cloud-gms-sms-avancar`
- LOG: doc/LOG-2026-08-17__160500__fix-device-cloud-gms-sms-avancar.md

## 2026-08-17 15:36 — Device Cloud: Digitar não acrescenta 03
- Causa: Avançar/Continuar com teclado aberto acertavam teclas 0 e 3
- Fix: toque em Avançar y=690 (pad aberto) e depois y=1100 (pad fechado)
- Marker `DEPLOY-2026-08-17-device-cloud-digitar-sem-03`
- LOG: doc/LOG-2026-08-17__153600__fix-device-cloud-digitar-03.md

## 2026-08-17 15:28 — Financeiro: comprovante do fornecedor na linha do pedido + PIX por entregues
- Causa: finalizar campanha criava `campaign-supplier:` e pagava `sent`
- Fix: anexar comprovante na linha original; valor = entregues (cap enviados/planejado/crédito pago)
- Marker `DEPLOY-2026-08-17-financeiro-split-fornecedor-entregues`
- LOG: doc/LOG-2026-08-17__152800__fix-financeiro-split-fornecedor-entregues.md

## 2026-08-17 15:12 — Avançar Device Cloud validado (360,1100)
- Back + swipe no Play quebravam o fluxo; Avançar era y=1060 (acima do botão)
- Toque real `360,1100` abriu o diálogo Continuar
- Marker `DEPLOY-2026-08-17-device-cloud-avancar-1100`
- LOG: doc/LOG-2026-08-17__181200__device-cloud-avancar-coords-validadas.md

## 2026-08-17 14:53 — Isolamento Device Cloud WABA vs SaaS
- Publicação futura: `https://devices.draxsistemas.com.br/`
- WABA não lista devices `SAAS ·` / `DRAX-DEVICES ·`; criações WABA usam `WABA ·`
- Tenant SSO separado fica para o SaaS; até lá o filtro de nome vale no WABA
- LOG: doc/LOG-2026-08-17__175300__device-cloud-isolamento-waba-saas.md

## 2026-08-17 14:46 — Digitar já toca Avançar/Continuar
- Play Services heads-up desviava o toque; teclado some e o Device avança sozinho
- Marker `DEPLOY-2026-08-17-device-cloud-avancar`
- LOG: doc/LOG-2026-08-17__174600__device-cloud-avancar-apos-digitar.md

## 2026-08-17 14:26 — Digitar Device Cloud: laterais do teclado
- `51982006034` virava `5820-00-4`: toques X=120/600 erravam 1,3,4,6,7,9
- Não é split de DDD; coords internas + delay 280ms
- Marker `DEPLOY-2026-08-17-device-cloud-dialpad-laterais`
- LOG: doc/LOG-2026-08-17__172600__device-cloud-dialpad-laterais.md

## 2026-08-17 14:14 — Lidos no relatório via código (480 / 518)
- SQUARE RESIDENCIAL → 480; 6 DE AGOSTO → 518 (14/08/2026)
- Override só na leitura do relatório/dashboard; JSON de produção intacto
- Marker `DEPLOY-2026-08-17-lidos-relatorio-480-518`
- LOG: doc/LOG-2026-08-17__171400__lidos-relatorio-override-codigo.md

## 2026-08-17 14:11 — Relatório 6 DE AGOSTO: Lidos = 518
- Campanha 14/08/2026 15:54 (nome corrigido; pedido anterior citava SQUARE RESIDENCIAL)
- Patch via Actions SSH: `performanceReport.read = 518`
- LOG: doc/LOG-2026-08-17__171100__6-de-agosto-lidos-518.md

## 2026-08-17 14:08 — Relatório SQUARE RESIDENCIAL: Lidos = 480
- Campanha 14/08/2026 15:54; relatório finalizado é somente leitura na UI
- Patch em produção via Actions SSH em `waba-campaign-intakes.json` (`performanceReport.read`)
- LOG: doc/LOG-2026-08-17__170800__square-residencial-lidos-480.md

## 2026-08-17 13:28 — Marker redeploy Device Cloud (dialpad)
- Marker `DEPLOY-2026-08-17-1628-device-cloud-dialpad` (`src` + `dist`)
- Serve para validar `/health` após o próximo Redeploy (evitar archive GitHub 429: usar fonte Git/clone)
- LOG: doc/LOG-2026-08-17__162800__deploy-marker-device-cloud-redeploy.md

## 2026-08-17 10:27 — Campanhas: relatório visível com saldo zerado
- Assinante sem créditos continua vendo lista e relatórios (API Oficial e Alternativa)
- Alerta de créditos só na criação de nova campanha (card compacto, sem overlay na tela inteira)
- Gate usa saldo da API da aba atual (`oficial` / `alternativa`)
- Marker `DEPLOY-2026-08-17-campanhas-relatorio-saldo-zero`
- LOG: doc/LOG-2026-08-17__094600__campanhas-relatorio-sem-creditos-view.md

## 2026-08-17 07:30 — Dispositivos flutuantes na aba
- Celular permanece na aba Dispositivos, arrastável, sem sobrepor outros menus
- Excluir tira da tela (não destrói o Redroid)
- Marker `DEPLOY-2026-08-17-dispositivos-flutuante`
- LOG: doc/LOG-2026-08-17__073000__ui-dispositivos-flutuante.md

## 2026-08-14 18:15 — Dispositivos: tela do celular e toque real
- Removidos Voltar/Início/Avançar, DDI, Digitar e o guia; tela 253×460 → 329×598 (+30%)
- Clique no WhatsApp exigia uinput (`ddc-virt-tap`); `adb input tap` não chega nos widgets
- Marker `DEPLOY-2026-08-14-dispositivos-tela-celular`
- LOG: doc/LOG-2026-08-14__181500__fix-dispositivos-tela-celular.md

## 2026-08-14 14:55 — Mínimo API Alternativa R$ 200
- Checkout PIX deixava de aceitar o pacote de R$ 200 (mínimo global era R$ 300)
- Marker `DEPLOY-2026-08-14-min-credito-alternativa-200`
- LOG: doc/LOG-2026-08-14__fix-min-credito-alternativa-200.md

## 2026-08-14 14:45 — Gerar PIX do checkout de créditos
- Clique no botão era engolido (z-index/FAB) ou o botão ficava disabled sem aviso
- Marker `DEPLOY-2026-08-14-gerar-pix-click`
- LOG: doc/LOG-2026-08-14__fix-gerar-pix-click.md

## 2026-08-14 14:15 — Dispositivos: fluxo WhatsApp habitual
- SMS só após Avançar/confirmar no app; dígitos um a um; abre WA Business
- Marker `DEPLOY-2026-08-14-device-cloud-wa-natural`
- LOG: doc/LOG-2026-08-14__ui-device-cloud-wa-natural.md

## 2026-08-14 14:05 — Dispositivos: tela +20%
- Wrap 420px → 504px; screenshot max-height 72vh → 86vh
- Marker `DEPLOY-2026-08-14-device-cloud-screen-20`
- LOG: doc/LOG-2026-08-14__ui-device-cloud-screen-20.md

## 2026-08-14 13:55 — Dispositivos: inputs no tema escuro
- Nome e número WhatsApp usam tokens `--bg-card-alt` / `--text` (sem fundo branco)
- Marker `DEPLOY-2026-08-14-device-cloud-inputs-dark`
- LOG: doc/LOG-2026-08-14__ui-device-cloud-inputs-dark.md

## 2026-08-14 13:40 — Split do pedido segue o operacional da campanha vigente
- Cancelar/gerar outra campanha atualiza fornecedor/PIX no Financeiro (não só no campaign-supplier)
- Overview sincroniza linhas skipped/pending | `npm run verify:campaign-transfer-split-pix`
- Marker `DEPLOY-2026-08-14-split-supplier-elected-sync`
- LOG: doc/LOG-2026-08-14__fix-split-pedido-operador-eleito.md

## 2026-08-14 12:05 — Split PIX ao transferir campanha entre operacionais
- Repasse fornecedor usa operador eleito (e-mail + plano + segmento), não só assignedSupplierId
- Sync settlement pending/failed ao transferir | `npm run verify:campaign-transfer-split-pix`
- Marker `DEPLOY-2026-08-14-campaign-transfer-split-pix`
- LOG: doc/LOG-2026-08-14__fix-campaign-transfer-split-pix.md

## 2026-08-14 11:50 — Financeiro: Walkup PIX pago não aparecia falha
- Causa: externalReference > 100 chars no retry Asaas; sync não reconciliava DONE
- Fix refs compactas + sync failed/processing | `npm run verify:split-external-ref`
- LOG: doc/LOG-2026-08-14__fix-split-pix-walkup-false-failed.md

## 2026-08-14 11:45 — Boas-vindas: failover após 3 ACK ERROR no 7770
- Após 3 ACK ERROR no eleito → secundário/terciário; retry background mantém contador
- `npm run verify:welcome-routing` | marker `DEPLOY-2026-08-14-welcome-ack-failover-3`
- LOG: doc/LOG-2026-08-14__welcome-ack-failover-3.md

## 2026-08-14 11:25 — Fornecedores: persistência ordem prioridade
- Swap automático ao mudar prioridade (evita 400 por duplicata no PUT split-config)
- `npm run verify:supplier-priority` | marker `DEPLOY-2026-08-14-supplier-priority-persist`
- LOG: doc/LOG-2026-08-14__fix-supplier-priority-persist.md

## 2026-08-14 11:15 — Marker Criar Dispositivo
- Marker: DEPLOY-2026-08-14-criar-dispositivo
- Shell cache SW v4 para a aba nova aparecer após Redeploy

## 2026-08-14 10:55 — Deploy bundle boas-vindas + verify script
- Marker: DEPLOY-2026-08-14-welcome-eleito-pausa-failover-offline
- `npm run verify:welcome-routing`

## 2026-08-14 10:40 — Dispositivos: um botão + tela Android
- WABA faz SSO e proxy no backend; aba só tem Criar Dispositivo
- Marker: DEPLOY-2026-08-14-device-cloud-one-button
- LOG: doc/LOG-2026-08-14__104000__dispositivos-um-botao-tela-android.md

## 2026-08-14 10:12 — Dispositivos abre Device Cloud Web
- Iframe automático + fallback api-devices → devices
- Marker: DEPLOY-2026-08-14-device-cloud-web-iframe
- LOG: doc/LOG-2026-08-14__101200__waba-dispositivos-iframe-web.md

## 2026-08-14 09:58 — Boas-vindas: failover só se eleito desconectado
- Pausa humana mantém 5181077770; secundário só se primário offline
- Marker: DEPLOY-2026-08-14-welcome-failover-if-disconnected

## 2026-08-14 09:55 — Boas-vindas só pelo número eleito (sem failover)
- Pausa humana/Preparando não troca para 5197462102; repete no 5181077770
- Marker: DEPLOY-2026-08-14-welcome-primary-only-no-failover
- LOG: doc/LOG-2026-08-14__095500__welcome-primary-only-no-failover.md

## 2026-08-14 09:45 — Modal reenviar boas-vindas async (202)
- Endpoint responde 202 imediatamente; envio e ACK em background
- Marker: DEPLOY-2026-08-14-resend-welcome-async-ui
- LOG: doc/LOG-2026-08-14__094500__fix-resend-welcome-modal-async.md

## 2026-08-14 08:15 — Boas-vindas WhatsApp: ACK + failover
- sendText HTTP 2xx não basta; exige DELIVERY_ACK/READ/PLAYED; ERROR tenta próxima instância
- Marker: DEPLOY-2026-08-14-welcome-whatsapp-ack-failover
- LOG: doc/LOG-2026-08-14__081500__welcome-whatsapp-ack-failover.md

## 2026-08-13 08:49 — Fix aba Dispositivos vazia
- `setActiveTab` não exibia `#tab-dispositivos` (ficava `tab-hidden`)
- Marker: DEPLOY-2026-08-13-device-cloud-tab-show
- LOG: doc/LOG-2026-08-13__084958__fix-dispositivos-tab-show.md

## 2026-08-12 16:30 — DRAX Device Cloud MVP + menu Dispositivos
- Novo repo `drax-device-cloud` (Nest/Next/Redroid); WABA menu Aquecedor→Dispositivos (production + mozart.pmo)
- SSO `POST /device-cloud/sso`; marker DEPLOY-2026-08-12-device-cloud-menu-sso
- LOG: doc/LOG-2026-08-12__163000__device-cloud-mvp-menu-sso.md

## 2026-08-12 15:00 — + Instâncias troca bloqueados + Proteção ativa
- Ao adicionar número, remove 1 offline/bloqueado (1:1); Proxy nos novos / off nos removidos
- Tag «Proteção ativa» baseada só nas instâncias conectadas com proxy confirmada
- Marker: DEPLOY-2026-08-12-swap-blocked-proxy-tag
- LOG: doc/LOG-2026-08-12__150000__swap-blocked-instancias-proxy-tag.md

## 2026-08-12 14:01 — Boas-vindas ignora Preparando/pausa humana + retry
- `ignoreAquecedorLifecycle` + `backgroundRetryKey` nas boas-vindas (assinante/equipe)
- Fallback qualquer EVO open se hints offline; aquecedor/campanha continuam filtrando lifecycle
- Marker: DEPLOY-2026-08-12-welcome-bypass-lifecycle
- LOG: doc/LOG-2026-08-12__140130__welcome-bypass-lifecycle-retry.md
- Palavras-chave: `boas-vindas`, `ignoreAquecedorLifecycle`, `pausa humana`, `preparando`

## 2026-08-12 11:00 — Proxy off no offline + botão + Instâncias
- Desliga Proxy ao detectar instância offline (pausa saúde/sessão)
- UI mostra «+ Instâncias» com qualquer desconectado; auto-add cura ratio ≥50%
- Novas instâncias: Proxy ligada via prepare já existente
- Marker: DEPLOY-2026-08-12-proxy-offline-add-instancias
- LOG: doc/LOG-2026-08-12__110000__proxy-offline-add-instancias.md

## 2026-08-12 10:52 — Motivo real da pausa + tags live (connectionState)
- Tags de campanha usam connectionState (não fetchInstances mentiroso)
- pauseReason gravado em pausa proxy/sessão; fallback deixa de dizer «manual»
- Marker: DEPLOY-2026-08-12-pausa-motivo-tags-live
- LOG: doc/LOG-2026-08-12__105200__pausa-motivo-tags-live.md

## 2026-08-11 16:21 — Ativar campanha no 1º clique + anti duplo clique
- Hydrate leve (`lightLeads`) no `POST .../estado`; timeout UI 60s
- Toggle em `pointerdown` + lock (`toggleBusy` / inflight / disabled)
- Marker: DEPLOY-2026-08-11-ativar-campanha-primeiro-clique
- LOG: doc/LOG-2026-08-11__162100__ativar-campanha-primeiro-clique.md

## 2026-08-11 14:35 — Motivo real da pausa de campanha
- `runtimeStage.detail` deixa de ser genérico («Pausa Manual») e informa saúde/créditos/ativação
- Campo `pauseReason` na memória local; tick/créditos/parar-envios gravam o motivo
- LOG: doc/LOG-2026-08-11__143500__campanha-motivo-real-pausa.md

## 2026-08-11 13:10 — Limite mensagem IA 280 caracteres
- Prompt do Mensageiro: máximo 280 (antes 400)
- Marker: DEPLOY-2026-08-11-mensagem-ia-280
- LOG: doc/LOG-2026-08-11__131000__limite-mensagem-ia-280.md

## 2026-08-11 10:08 — Proteção ativa + ativar no 1º clique
- Tag no card só com Proxy confirmada (`/proxy/find` ou set recente)
- Ativar não espera prepare; prepare em background
- Marker: DEPLOY-2026-08-11-protecao-ativa-ativar-1-clique
- LOG: doc/LOG-2026-08-11__100800__protecao-ativa-ativar-1-clique.md

## 2026-08-11 09:38 — Campanha Alternativa: Proxy obrigatória
- Liga Proxy ao selecionar/ativar; desliga no finished/exclusão se ninguém mais segura o número
- Marker: DEPLOY-2026-08-11-campanha-proxy-obrigatoria
- LOG: doc/LOG-2026-08-11__093800__campanha-proxy-obrigatoria.md

## 2026-08-10 21:05 — Aquecedor: warmth por chip + identidade chip
- Warmth: aliases/idade/volume vitalício por número; sem teto punitivo; pisos lifetime
- Envio/grafo/turnos já por chip (`identityMode=chip`)
- Marker: DEPLOY-2026-08-10-aquecedor-warmth-por-chip
- LOG: doc/LOG-2026-08-10__210500__aquecedor-warmth-por-chip.md
- Palavras-chave: warmth, foguinhos, chip, 6973, 2477

## 2026-08-10 20:51 — Aquecedor: identidade por número do chip
- Regra: lógica de envio/grafo/turnos/stats usam chip canônico, não nome da instância
- Migração `identityMode=chip`; turn manager alinhado aos eventos por chip
- Marker: DEPLOY-2026-08-10-aquecedor-identidade-chip
- LOG: doc/LOG-2026-08-10__205115__aquecedor-identidade-chip.md
- Palavras-chave: aquecedor, chip, identidade, rename, conversation-graph

## 2026-08-10 20:36 — Aquecedor: justiça de volume entre números
- Causa: ping-pong A↔B dominava; participação por número era fraca (só “hoje”)
- Fix: peso vitalício + não forçar resposta em par quente se há números frios
- Marker: DEPLOY-2026-08-10-aquecedor-justica-volume-numeros
- LOG: doc/LOG-2026-08-10__203641__aquecedor-justica-volume-numeros.md

## 2026-08-10 18:45 — Mensageiro abas Imagem + variação 1080×1080
- 4 imagens obrigatórias; round-robin; envio imagem → ACK → texto; sendMedia base64-first
- LOG: doc/LOG-2026-08-10__184500__mensageiro-abas-imagem-1080-variacao.md
- Palavras-chave: mensageiro, imagem, 1080, sendMedia, messengerImages

## 2026-08-10 18:11 — Remover base de mensagens (planilha) no Mensageiro
- messageMode sempre IA; /disparos/templates* → 410; UI planilha de mensagens removida
- LOG: doc/LOG-2026-08-10__181124__remove-base-mensagens-planilha-alternativa.md
- Palavras-chave: base de mensagens, planilha, messageMode, templates/import

## 2026-08-10 15:56 — Resumo Enviados = sentCount das campanhas
- Bug: Resumo só somava campanhas completed/finished (pausada ficava 0)
- Fix: somar sentCount de todas; API conta leads sent em memória
- LOG: doc/LOG-2026-08-10__155612__fix-resumo-enviados-campanha.md

## 2026-08-10 15:45 — Dashboard Disparos: indicadores por API Oficial e Alternativa
- Contagem/Distribuicao/Taxas separados por API; saldo no resumo por byApi
- LOG: doc/LOG-2026-08-10__154500__dashboard-disparos-indicadores-por-api.md
## 2026-08-10 15:14 — Campanha Oficial: WhatsApp + leads Excel/TXT + min 1000
- Wizard: Seu WhatsApp (DDD, nome, logo 500x500); leads Excel/TXT; minimo 1000 envios
- Operacional: secao WhatsApp + download logo; intake API v5
- LOGs: doc/LOG-2026-08-10__150332__campanha-oficial-whatsapp-nome-logo.md ; doc/LOG-2026-08-10__151424__campanha-leads-excel-txt-min-1000.md
## 2026-07-26 10:18 — Aquecedor motor unlock (volume vs intervalo)
- Soft-skip de direções mortas no ciclo; stale par 90min; peer offline libera origem
- Testes: scripts/test-aquecedor-motor-unlock.mjs (+ deadlock + pausa humana)
- Marker: DEPLOY-2026-07-26-aquecedor-motor-unlock
- LOG: doc/LOG-2026-07-26__101800__aquecedor-motor-unlock.md

## 2026-07-25 19:05 — Aquecedor: pausa humana 3h (imune 6h pós-Preparando)
- Pausa 6h→3h; rótulo «3 horas pausa humana»
- Não aplica nas primeiras 6h após sair de Preparando (activatedAt)
- Teste: scripts/test-aquecedor-human-pause-window.mjs
- Marker: DEPLOY-2026-07-25-pausa-humana-3h
- LOG: doc/LOG-2026-07-25__190500__aquecedor-pausa-humana-3h.md

## 2026-07-25 11:45 — CONFIRMAR Passo 3: watermark stale
- Bug: max(captured, now) + minTs staleava CONFIRMAR já enviado
- Fix: graça 180s pré-start; poll paralelo findMessages∥findChats; GET deep
- Teste: scripts/test-inbound-confirm-watermark.mjs OK
- Marker: DEPLOY-2026-07-25-confirmar-prestart-grace
- LOG: doc/LOG-2026-07-25__114500__confirmar-prestart-grace.md

## 2026-07-25 11:15 — QR: EACCES instance-owners (não é EVO)
- recent-failures: EACCES open /app/data/instance-owners.json (purge docker cp root)
- Doc EVO create/connect OK; smoke create+QR OK; falha antes da EVO
- Fix writeJsonFileResilient + chown no purge + heal-waba-data-permissions
- Teste local OK (EPERM → unlink+replace)
- Marker: DEPLOY-2026-07-25-owners-eacces-resilient-write
- LOG: doc/LOG-2026-07-25__111500__owners-eacces-resilient-write.md

## 2026-07-25 10:50 — QR «EVO_API_URL» é falso positivo
- Smoke create+extract OK no container; URL já é 172.17.0.1:30181
- UI descartava detail; agora trace em /service/evo-qr-recent-failures
- Marker: DEPLOY-2026-07-25-qrcode-failure-trace
- LOG: doc/LOG-2026-07-25__105000__qrcode-evo-url-falso-positivo.md

## 2026-07-25 10:25 — QR ainda falha (marker OK): smoke + detail UI
- EVO create OK fora; WABA marker tombstone no ar; texto genérico = catch do job
- Fix: UI/detail + GET /service/evo-qr-create-smoke + marker smoke-detail
- LOG: doc/LOG-2026-07-25__102500__qrcode-smoke-detail.md

## 2026-07-25 10:02 — QRCode falha pós-purge (extract + tombstone)
- EVO create OK; painel falhava: `code` Baileys vs base64 + tombstone deletedInstances
- Fix tryExtractQrCode + clearDeletedMark no claimOnRegister + UI detalhe
- Marker: DEPLOY-2026-07-25-qrcode-extract-tombstone — Redeploy Node
- LOG: doc/LOG-2026-07-25__100200__qrcode-extract-tombstone-fix.md

## 2026-07-25 10:00 — Purge Mozart + deploy deadlock unlock
- Push `767ec28` marker pair-deadlock-unlock
- Script/workflow: purge-mozart-owner-reset (protege walkup + soma-crm)
- LOG: doc/LOG-2026-07-25__100000__purge-mozart-owner-reset.md

## 2026-07-25 09:50 — Aquecedor: deadlock saldo/anti-duplicata (print)
- Motor ativo + “nenhum envio elegível” = pick null por |saldo|=1 + lastDirection curativo
- Fix getPairDirectionAllowed: repetir sentido só se reduzir desequilíbrio
- Marker: DEPLOY-2026-07-25-aquecedor-pair-deadlock-unlock
- LOG: doc/LOG-2026-07-25__095000__aquecedor-pair-deadlock-unlock.md

## 2026-07-25 09:45 — Aquecedor ~10× abaixo do esperado (pós 16:51)
- Só 3 ENVIADO desde 24/07 16:51; 0 após 16:55 (ainda expediente) e 0 no sáb de manhã
- Esperado ~21–63 no trecho aberto; pool: 5 healthy open vs 5 broken ERROR + 8927 close
- Causas: outbound quebrado + silêncio do motor (desired/lifecycle/defer) — não só wait 5–15min
- LOG: doc/LOG-2026-07-25__094500__aquecedor-volume-10x-abaixo.md

## 2026-07-24 13:15 — Aquecedor: Em Fila some = outbound MessageUpdate=ERROR
- Teste 1× 1321→walkup: HTTP 201 + tag só na origem + MessageUpdate=ERROR (walkup OK)
- Quebradas 100% ERROR: 1321, 1261, 6011, 6635 | saudáveis: walkup, 1321-01, soma…
- Código: filtra outbound quebrado + poll findStatusMessage; não culpar destino
- Marker: DEPLOY-2026-07-24-aquecedor-outbound-ack-error — precisa push + Redeploy Node
- LOG: doc/LOG-2026-07-24__131500__aquecedor-outbound-messageupdate-error.md

## 2026-07-24 12:06 — Aquecedor: conversa pares + sucesso no destino
- Sucesso = tag no DESTINO; findChats fallback; B→A prioriza após A→B
- Anti-spam 1 send/ciclo + cooldown 15min mantidos
- Marker: DEPLOY-2026-07-24-aquecedor-conversa-pares-destino — Redeploy Node
- LOG: doc/LOG-2026-07-24__120600__aquecedor-conversa-pares-destino.md

## 2026-07-24 11:46 — Análise: por que o aquecedor quebrou esta semana
- Números novos + verify mais rígido (24/07) + variantes; malha antiga na prática funcionava
- Não enquadrar o modo antigo como “só mentia” — incidente jun/20 foi pontual
- LOG: doc/LOG-2026-07-24__114600__analise-aquecedor-quebra-semana.md

## 2026-07-24 11:18 — Anti-spam sendText (ban WhatsApp)
- Incidente: rajada de probes (~5 sendText/6 min) → block
- Aquecedor: 1 send aceito/ciclo; sem reenvio por variante; cooldown 15min se falha de entrega
- Rule: .cursor/rules/anti-spam-whatsapp-sendtext.mdc
- Marker: DEPLOY-2026-07-24-aquecedor-anti-spam-sendtext — Redeploy Node
- LOG: doc/LOG-2026-07-24__111800__anti-spam-sendtext-ban.md

## 2026-07-24 10:55 — Aquecedor: libera PROCESSANDO órfão global
- Bug: stuck release só no escopo → 6973 ficava PROCESSANDO 1600+ min
- Falha 6635→8918 = entrega real só na origem (não falso sucesso)
- Marker: DEPLOY-2026-07-24-aquecedor-release-stuck-global — Redeploy Node
- LOG: doc/LOG-2026-07-24__105500__aquecedor-release-stuck-global.md

## 2026-07-24 10:41 — Aquecedor: cooldown de par 15 min
- Era 45 min após falha de confirmação de entrega; agora 15 min
- Marker: DEPLOY-2026-07-24-aquecedor-cooldown-15min — Redeploy Node
- LOG: doc/LOG-2026-07-24__104100__aquecedor-cooldown-15min.md

## 2026-07-24 10:25 — Saúde da rede só Mozart
- UI + API `/aquecedor/network-health` exclusivos para `mozart.pmo@gmail.com` (403 para demais)
- Marker: DEPLOY-2026-07-24-saude-rede-so-mozart — Redeploy Node
- Keywords: `Saúde da rede`, `mozart.pmo`, `network-health`

## 2026-07-24 10:15 — Aquecedor: entrega variantes + cooldown + anti-duplicata
- Revert mantém instancia; órfãos reclamados; cooldown 15min (era 45); variantes BR no send/findMessages
- Marker: DEPLOY-2026-07-24-aquecedor-entrega-variantes-cooldown — Redeploy Node
- LOG: doc/LOG-2026-07-24__101500__aquecedor-entrega-variantes-cooldown.md

## 2026-07-24 08:55 — Aquecedor: falso Envio com Sucesso
- Causa: findMessages global + match de prefixo de frases repetidas; teste gravava sucesso sem prova
- Fix: só tag única; JID obrigatório; origem+destino; teste sem sucesso falso
- Marker: DEPLOY-2026-07-24-aquecedor-falso-sucesso-entrega — Redeploy Node
- LOG: doc/LOG-2026-07-24__085500__aquecedor-falso-sucesso-entrega.md

## 2026-07-24 08:00 — Aquecedor: rotatividade inteligente de pares
- RelationshipManager: volume entre pares + anti-repetição + cobertura
- Dashboard: matriz NxN, spread/desvio, histórico com motivo do score
- Marker: DEPLOY-2026-07-24-aquecedor-rotatividade-pares — Redeploy Node
- LOG: doc/LOG-2026-07-24__080000__aquecedor-rotatividade-pares.md

## 2026-07-24 07:50 — Motor aquecedor orientado a pares
- Grafo persistente + orchestrator (saldo, anti-duplicata, distribuição)
- GET /aquecedor/network-health + UI «Saúde da rede»
- Marker: DEPLOY-2026-07-24-aquecedor-motor-pares-grafo — Redeploy Node
- LOG: doc/LOG-2026-07-24__075000__aquecedor-motor-pares-grafo.md

## 2026-07-24 07:32 — Modal validação: loop card verde + reply
- UI: poll 2s, sem scroll/animação a cada tick; sem auto-restart 404; esconde banner verde na recepção
- Backend: GET refresh; send preferido + retry; não enviar ao próprio número
- Marker: DEPLOY-2026-07-24-validacao-ui-loop-reply-retry — Redeploy Node
- LOG: doc/LOG-2026-07-24__073200__fix-validacao-ui-loop-reply.md

## 2026-07-23 13:56 — Card ativas alinhado ao filtro Conectados
- Causa: card usava `isOpen` (incluía Preparando/Restrição abertas); filtro usa label `conectado`
- Fix: `updateInstancesIndicators` usa `isInstanceConnectedFilter` / `isInstanceDisconnectedFilter`
- LOG: doc/LOG-2026-07-23__135600__fix-card-ativas-vs-filtro-conectados.md

## 2026-07-23 10:20 — Purge 555182001261/1261 na EVO
- EVO: zero hits; connectionState/delete 1261 → 404 (já removida)
- Script VPS limpa data WABA: scripts/purge-wa-number-1261-vps.sh
- LOG: doc/LOG-2026-07-23__102000__purge-evo-555182001261-1261.md

## 2026-07-23 08:15 — 1261: oscilação + número via ownerJid
- EVO: close vs connecting + device_removed; number null / ownerJid ok
- Fix UI+enrich; marker DEPLOY-2026-07-23-1261-numero-status-estavel — Redeploy
- LOG: doc/LOG-2026-07-23__081500__1261-oscilacao-numero-ownerjid.md

## 2026-07-23 08:00 — Validação reply no mesmo chat do CONFIRMAR
- sendText prioriza JID do CONFIRMAR; prova só nesse chat (sem fromMe global)
- Marker: DEPLOY-2026-07-23-validacao-reply-mesmo-chat — Redeploy Node
- LOG: doc/LOG-2026-07-23__080000__validacao-reply-mesmo-chat.md

## 2026-07-23 07:52 — UI Restrição: ícone −7% / fonte −5%
- Ícone 1.35em→1.2555em; fonte 1.05rem→0.9975rem

## 2026-07-23 07:50 — Restrição: connecting ≠ ban (6973 falso positivo)
- 5181076973/6973 em connecting EVO não é restrição WA; purge tags automáticas
- Marker: DEPLOY-2026-07-23-restricao-nao-por-connecting — Redeploy Node
- LOG: doc/LOG-2026-07-23__075000__restricao-nao-por-connecting-6973.md

## 2026-07-23 07:45 — QR/Atualizar: connect-first (sem logout prévio)
- Causa: logout+restart antes do connect → timeout/Failed to fetch; EVO connect já devolve QR
- UI: botões liberados em Restrição; Atualizar também gera QR
- Marker: DEPLOY-2026-07-23-qrcode-connect-first-no-logout — exige Redeploy Node
- LOG: doc/LOG-2026-07-23__074500__qrcode-connect-first-sem-logout.md

## 2026-07-23 07:33 — Card Restrição com cores de Desconectados
- Borda/valor do summary-card-restriction: vermelho `#fca5a5` / `rgba(248,113,113)`
- Preparando permanece amarelo
- LOG: doc/LOG-2026-07-23__073300__ui-card-restricao-cores-desconectados.md

## 2026-07-23 07:31 — UI Restrição: fonte/ícone + "Restrição"
- `text-transform: none` no `.wa-restriction`; fonte 1.05rem; ícone 1.35em
- LOG: doc/LOG-2026-07-23__073100__ui-restricao-fonte-icone-maiuscula.md

## 2026-07-22 16:03 — Validação 1261 v2 forceRestart + watermark=now
- Retry reaproveitava sessão; watermark agora = max(histórico, start); UI forceRestart sempre; telefone com 9
- Marker: DEPLOY-2026-07-22-validacao-1261-force-restart-v2 — exige Redeploy
- LOG: doc/LOG-2026-07-22__160300__validacao-1261-force-restart-v2.md

## 2026-07-22 15:58 — Heal login v6 supervisor (anti-502 permanente)
- Bursts escalonados + flock wait + supervisor 20s revive unidades + cura HTTPS
- Actions/Guardião assert supervisor; Rule atualizada
- LOG: doc/LOG-2026-07-22__155800__heal-login-v6-supervisor-anti-502.md

## 2026-07-22 15:50 — Modal atualização só em Deploy/Redeploy
- Removido 502/rede/fetch como gatilho; só shuttingDown + drift deployMarker
- LOG: doc/LOG-2026-07-22__155000__modal-atualizacao-somente-deploy.md

## 2026-07-22 15:41 — Validação 1261 anti-histórico EVO (definitivo)
- EVO 1261: 11 Confirmar + 2 replies antigas; falso ok por match genérico “Validação WABA”
- Fix: watermark no start; prova só com WABA-VAL desta sessão; anti-flicker etapa 2
- Teste offline PASS no dump real; marker DEPLOY-2026-07-22-validacao-anti-historico-evo
- LOG: doc/LOG-2026-07-22__154100__validacao-1261-anti-historico-evo.md

## 2026-07-22 14:08 — Validação 1261: prova no chat + Redeploy
- Causa: FTP não reinicia Node (marker antigo no /health); success falso só com HTTP 201
- Fix: sendText com variantes BR; sucesso só com mensagem no chat; marker novo
- Obrigatório: Redeploy disparador + heal se 502; validar marker no /health
- LOG: doc/LOG-2026-07-22__140800__validacao-1261-prova-chat-redeploy.md

## 2026-07-22 13:45 — Aquecedor pares + validação 1261
- Fix: replyDue prioridade absoluta (6011 só recebia); send validação sem sucesso falso; Preparando com since=now
- LOG: doc/LOG-2026-07-22__134500__aquecedor-pares-validacao-1261.md

## 2026-07-22 13:31 — Heal login v5 confirmado ACTIVE no VPS
- install + burst OK rodada 1; watch+timer `active`; https:200
- Watch reagiu a vários `service update waba_waba_disparador` (~16:27–16:28 UTC)
- LOG anterior: doc/LOG-2026-07-22__133000__502-persiste-heal-inativo.md

## 2026-07-22 13:30 — 502 persiste pós-FTP (heal VPS)
- FTP não cura :30180; install+burst obrigatório; watch/timer devem ser active
- LOG: doc/LOG-2026-07-22__133000__502-persiste-heal-inativo.md

## 2026-07-22 13:15 — Normalizar 9º dígito móvel BR
- 5182001261 ≡ 51982001261; expand/canonicalize/match no backend
- LOG: doc/LOG-2026-07-22__131500__normalize-9-digito-br.md

## 2026-07-22 13:00 — Validação aceita CONFIRMA
- Match estrito CONFIRMAR falhava com «Confirma»; aliases + UI; número real 5182001261
- LOG: doc/LOG-2026-07-22__130000__validacao-aceita-confirma.md

## 2026-07-22 12:45 — Contingência anti-502 (heal+modal)
- Causa: Guardião baixava heals sem `install` → watch morto; overlay ignorava 502
- Fix: Guardião install heals; heal v5; UI 502→modal+reload; Actions assert active
- VPS: reinstall heal-waba-login AGORA
- LOG: doc/LOG-2026-07-22__124500__contingencia-anti-502-heal-modal.md

## 2026-07-22 12:39 — 502 pós-Redeploy (heal login)
- waba.draxsistemas Bad Gateway após Redeploy; causa :30180; burst heal-waba-login
- LOG: doc/LOG-2026-07-22__123900__502-pos-redeploy-heal-login.md

## 2026-07-22 12:28 — Fix Preparando na integração
- Create/QR força Preparando; sem createdAt não grandfather; reconcile active→preparing se EVO recente/recriada
- Contagem Preparando e exclusão do ciclo aquecedor voltam a bater
- LOG: doc/LOG-2026-07-22__122800__fix-preparando-integracao.md

## 2026-07-22 11:35 — Indicadores Preparando + Restrição Temporária
- Aba Instâncias: 2 cards no topo (contagens); chip filtro Restrição; sync dist
- LOG: doc/LOG-2026-07-22__113500__indicadores-preparando-restricao.md

## 2026-07-22 11:30 — Tag UI Restrição (connecting + 3h)
- Tag estilo Preparando: ícone WA + Restrição + countdown 3h; ações off; recheck 60min limpa se sair de connecting
- Store: whatsapp-connecting-restriction.json; enrich live + uso-config
- LOG: doc/LOG-2026-07-22__113000__tag-restricao-connecting-3h.md

## 2026-07-21 21:20 — Heal login v4 (anti-queda pós-redeploy)
- Timer 10s, burst 2s, probe 172.17.0.1, watch 1s; nunca disable login-heal; redeploy só se necessário
- VPS: reinstall obrigatório `heal-waba-login-vps.sh install`
- LOG: doc/LOG-2026-07-21__212000__heal-login-v4-anti-queda.md

## 2026-07-21 20:52 — Lista «desconectado» com QR «já conectada» (1261)
- EVO open de verdade; lista lia cache sem live enrich; background refresh sem re-render
- Fix snapshot live + 409 como sucesso + re-render; número real WA: 5182001261 (não 51982001261)
- LOG: doc/LOG-2026-07-21__205200__fix-lista-desconectado-ja-conectada-1261.md

## 2026-07-21 20:45 — Restart EVO destravou QR (create/connect)
- UI «Verifique EVO_API_URL» era falso positivo (502); create/connect travavam na Evolution
- Fix: `docker service update --force walkup_evo-walkup-api` (aprovado)
- Validação: create 201 ~5s com QR; não usar `127.0.0.1:30181` no host (hairpin) — preferir `172.17.0.1:30181`
- LOG: doc/LOG-2026-07-21__204500__evo-restart-destravou-qr-create.md

## 2026-07-21 16:18 — Guardião ATIVO (repair) no VPS; writers desligados
- Corrupção recorrente do main.yaml: culpado final = `sinal-verde-main-yaml.path` (path unit strip a cada write)
- Desligados: overlay-guards SV/Soma, heal-sinal-verde, soma-gestao-heal, traefik-permanent-*, waba-traefik-autoheal, waba-login-heal v2 antiga
- Guardião repair: strip 12 chaves SV/Soma OK; probes 200/200/200/307/200; state `clean`
- NÃO religar writers antigos; heals só nas versões guardian (publish-only)
- LOG: doc/LOG-2026-07-21__161800__guardiao-ativo-repair-writers-desligados.md

## 2026-07-21 13:54 — Guardião de Sistemas Traefik criado
- Um único writer transacional do `main.yaml`; sem HUP/force/timers concorrentes
- Strip condicionado a YAML isolado válido; Host/entryPoints/backends por allowlist
- Backup + escrita atômica + probes + rollback automático
- Registry: WABA 30180/30210/30211, Walkup 30181, SV e Soma isolados
- Heals WABA agora são publish-only e solicitam reparo ao Guardião
- Rules: projeto + global Cursor
- Testes: 3 unitários OK; Python/Shell/JSON válidos
- Ainda não instalado no VPS: publicar → `install-audit` → revisar → `activate`
- LOG: `doc/LOG-2026-07-21__135400__create-guardiao-sistemas-traefik.md`

## 2026-07-20 20:21 — Soma CRM isolado CONCLUÍDO no VPS
- `soma-crm.yaml` criado; 6 chaves Soma stripped do `main.yaml`
- Validação: disparos/bet/health **200** | SV **307** | soma **307** / health **200** | main limpo
- Guard `soma-crm-overlay-guard` timer+watch ativos
- Hosts: `app.somaconecta.com.br` + easypanel.host + backend `:30300`
- Keywords: `soma-crm.yaml`, `30300`, `app.somaconecta.com.br`

## 2026-07-20 20:20 — Traefik split Soma CRM (`soma-crm.yaml`)
- Isola `app.somaconecta.com.br` em `soma-crm.yaml` (backend `:30300`); strip do `main.yaml`
- Scripts: `fix-soma-crm-isolated-yaml-vps.sh`, `soma-crm-overlay-guard-vps.sh`, paste Hostinger
- Rule: `soma-crm-heal-pos-redeploy.mdc` + UCP Traefik
- LOG: `doc/LOG-2026-07-20__202000__traefik-split-soma-crm.yaml.md`
- Keywords: `soma-crm.yaml`, `30300`, `app.somaconecta.com.br`, `SOMA-EASYPANEL-REWRITE`

## 2026-07-20 20:15 — Traefik split WABA/SV CONCLUÍDO no VPS
- MODE=directory já existia (`/data/config` + watch)
- `sinal-verde.yaml` isolado (http.routers); 6 chaves SV removidas do `main.yaml`
- Validação: disparos/bet/health **200** | SV **307** | `main: limpo SV`
- Guard v4 ativo (`sinal-verde-overlay-guard` timer+watch) — só edita `sinal-verde.yaml`
- Scripts: `fix-sinal-verde-isolated-yaml-vps.sh` v2, split v3
- LOG: `doc/LOG-2026-07-20__200023__traefik-split-sinal-verde-waba.md`
- Keywords: `traefik-split`, `sinal-verde.yaml`, `http.routers`, `30310`

## 2026-07-20 20:00 — Traefik split: WABA vs Sinal Verde
- `sinal-verde.yaml` isolado; scripts SV **não** editam `main.yaml` (só strip se Easypanel recriar)
- Scripts: `traefik-inspect-file-provider-vps.sh`, `traefik-split-sinal-verde-yaml-vps.sh`, fix v5, guard v4
- Workflow: `.github/workflows/traefik-split-sinal-verde.yml`
- Rules: `sinal-verde-heal-pos-redeploy.mdc` + `ucp-traefik-static-dynamic.mdc`
- LOG: `doc/LOG-2026-07-20__200023__traefik-split-sinal-verde-waba.md`
- Keywords: `traefik-split`, `sinal-verde.yaml`, `file-provider-directory`, `30310`

## 2026-07-21 12:45 — Auto-heal permanente ATIVO (bets + paginadevendas)
- VPS: `waba-paginadevendas-heal-watch/.timer` + `waba-bets-heal-watch/.timer` = **active**
- Script bets publicado (`2959bf3`) — antes 404 no raw; HUP removido do script
- Redeploy agora se cura sozinho (~20–60s); os 3 sites 200
- LOG: doc/LOG-2026-07-21__124500__install-heal-bets-paginadevendas-permanente.md

## 2026-07-21 12:30 — Remover LOGO 1–6 wabadisparos
- `pv-waba-disparador` `SocialProof`: removidos placeholders LOGO 1–6
- Redeploy Easypanel `waba_paginadevendas` para publicar
- LOG: doc/LOG-2026-07-21__123000__remove-logo-placeholders-wabadisparos.md

## 2026-07-20 19:51 — Landings restauradas (502→200)
- bet + wabadisparos + health = **200** (validado de fora)
- Restore Hostinger: publish :30210/:30211 + bak/backends (script emergency-restore-landings-502)

## 2026-07-20 19:46 — Landings 502 (bet + disparos) — restore emergencial
- Público: bet + wabadisparos **502** bad-gateway; login health **200**
- Script: `scripts/emergency-restore-landings-502-vps.sh` (Hostinger — sem SSH local)
- Prefer bak: `main.yaml.bak-restore-easypanel-backends-2026-07-10-v2-20260719-234729`
- LOG: doc/LOG-2026-07-20__194600__emergency-restore-landings-502.md

## 2026-07-20 19:10 — Push UI bet + logo wabadisparos
- betwaba-connect `main` `6d6c624` — hero padding
- pv-waba-disparador `main` `d117da1` — logo +15%
- Redeploy Easypanel: `waba_bets_pv` + `waba_paginadevendas` (+ heals :30211/:30210 se 502)

## 2026-07-20 19:00 — UI bet margin + logo wabadisparos +15%
- bet: `D:\betwaba-connect` hero `pt-8 sm:pt-12 md:pt-14` (era pt-16/24/32)
- disparos: `D:\pv-waba-disparador` Logo nav `h-[2.9756rem]` (+15% vs 2.5875rem)
- Falta: redeploy Easypanel `waba_bets_pv` + `waba_paginadevendas`
- LOG: doc/LOG-2026-07-20__190000__ui-bet-margin-wabadisparos-logo.md

## 2026-07-20 18:48 — traefik-agent global (qualquer projeto Cursor)
- Skill: `C:\Users\Usuario\.cursor\skills\traefik-agent\` (`@traefik-agent`)
- Rule user alwaysApply: `C:\Users\Usuario\.cursor\rules\traefik-agent.mdc`
- WABA `AGENTS.md` aponta para o global; `traefik-incident-specialist` = legado
- Base: REGISTRY + crawler sob `E:\01A-Drax-Servidor\Waba` (quando existir)
- LOG: doc/LOG-2026-07-20__184800__create-traefik-agent-global.md

## 2026-07-19 17:47 — Soma → campanha API Alternativa
- POST /integrations/soma/alternativa-campaigns (X-Soma-Waba-Key, owner mozart)
- Campanha criada pausada; auth bypass igual ao aquecedor
- LOG: doc/LOG-2026-07-19__174734__soma-alternativa-campaigns-api.md

## 2026-07-19 11:10 — Endpoint Soma aquecedor-instances
- GET /integrations/soma/aquecedor-instances + SOMA_WABA_INTEGRATION_KEY / owner mozart.pmo@gmail.com
- LOG: doc/LOG-2026-07-19__111015__soma-aquecedor-instances-endpoint.md
# MemÃ³ria Consolidada do Projeto

Este arquivo Ã© atualizado a cada tarefa executada.

Como usar:
- Antes de iniciar mudanÃ§as, procure aqui palavras-chave do pedido.
- Se necessÃ¡rio, leia os `doc/LOG-*.md` correspondentes para detalhes.

## Caminhos (repositÃ³rios prÃ³ximos)
- **PÃ¡gina vendas SOMA (remoto)**: [github.com/walkup-tec/Pagina-vendas-soma](https://github.com/walkup-tec/Pagina-vendas-soma) â€” pasta local `D:\SOMA Promotora\Pagina-Vendas`
- **SOMA Credit Sales** (cÃ³pia de trabalho anterior, mesmo stack): `D:\SOMA Promotora\soma-credit-sales`

Ãšltima atualizaÃ§Ã£o: (gerenciado automaticamente)

## Regra de trabalho (2026-07-06, reafirmada 2026-07-07)
- **Desenvolvimento:** sempre no **V02 local** (`D:\Waba`/`E:\Waba`, branch `v02`, http://localhost:3012/version-02/)
- **Testes:** o **usuário faz os testes** localmente no V02; não iniciar servidor/testes sem pedido.
- **Produção:** só quando o usuário **avisar explicitamente** (merge `v02` → `master` + build `dist/` + deploy Easypanel)
- **Não fazer:** push em `master`, redeploy produção ou alterações em `waba_disparador` sem aviso do usuário

## Última atualização

## 2026-07-18 — Produção → localhost V02
- `.env.v02` sync de `E:\Waba` + aquecedor/background OFF
- Export SSH via Actions (`export-triggers`) + apply tarball em `data/v02`
- Endpoint `GET /admin/infra/data-snapshot` (fallback HTTP)
- Ver `doc/LOG-2026-07-18__181500__producao-para-localhost-v02.md`
- Keywords: `producao`, `localhost v02`, `data-snapshot`, `export-triggers`

## 2026-07-17 — Aquecedor: equidade contínua por rodízio LRU
- Causa: compensar apenas o menor volume fazia um par monopolizar o ciclo até alcançar os demais
- Fix: priorizar o par há mais tempo sem troca; impedir repetição imediata; volume e direção como desempates
- Validação real: enviados/recebidos atuais próximos (`Soma 40/38`, `Walkup 38/40`, `Drax 39/39`) e projeção com 2 envios em cada uma das 6 direções nos próximos 12 ciclos
- Marker: `DEPLOY-2026-07-17-aquecedor-rodizio-pares-lru`
- Ver `doc/LOG-2026-07-17__120500__aquecedor-rodizio-pares-lru.md`
- Keywords: `equidade contínua`, `rodízio LRU`, `pares`, `starvation`, `Drax`, `Walkup`, `Soma`

## 2026-07-17 — Aquecedor: Soma fora do ciclo + contador “…”
- Causa: equidade usava histórico eterno (281 trocas soma↔walkup) → score punia o par; turno do par nunca expirava
- Fix: janela equidade 24h + turno stale 6h; persistir `connectedSummary`; refresh no GET `/aquecedor/status`
- Marker: `DEPLOY-2026-07-17-aquecedor-equidade-janela-24h`
- Ver `doc/LOG-2026-07-17__101400__aquecedor-equidade-pares-soma.md`
- Keywords: `pares`, `equidade`, `soma`, `walkup`, `1321-01`, `instâncias: …`

## 2026-07-17 — Easypanel verde/amarelo pós-redeploy
- Boot 07:45:24; `/health` 200 estável; flapping = 503 no SIGTERM + Traefik
- Após verde: Iniciar Aquecedor (`aquecedorDesiredOwners=0`)
- Ver `doc/LOG-2026-07-17__074500__easypanel-verde-amarelo-pos-redeploy.md`

## 2026-07-17 — Aquecedor parou após redeploy 20:58
- Causa: `serverBootId` mro66ke4 = restart 16/07 20:58:25 BRT (Redeploy) no meio do ciclo; desired não sobreviveu
- Fix: `aquecedor-desired-owners.json` + restore no boot + flush no SIGTERM
- Marker: `DEPLOY-2026-07-17-aquecedor-desired-sobrevive-redeploy`
- Ver `doc/LOG-2026-07-17__073500__aquecedor-parou-apos-redeploy.md`
- Keywords: `redeploy`, `desired`, `serverBootId`, `20:58`

**2026-07-17 — Soma gestao Traefik:** reincidência 404/502 pós-redeploy = overlay + Host slash + publish :30300. REGISTRY `SOMA-EASYPANEL-REWRITE`. Heal: `soma-master/scripts/heal-soma-gestao-vps.sh`. Sem force Traefik.


## 2026-07-16 — Soma SIGTERM (proxy port ≠ Nitro)
- SSH local bloqueado (`Permission denied`); sem `docker service inspect`.
- Causa: app escuta **3000**; Domínio Easypanel/Traefik ainda em **80** → health falha → SIGTERM.
- Probes: `soma-promotora-app…/api/health` **502**; `app.somaconecta` **404**; WABA Traefik OK.
- Fix painel: Domínios → proxy **3000** + `/api/health`; sem force Traefik.
- LOG: `doc/LOG-2026-07-16__203800__soma-sigterm-proxy-port-mismatch.md`
- Keywords: `soma-promotora`, `SIGTERM`, `PORT=80`, `proxy 3000`, `Nitro`, `502`

## 2026-07-16 — Aquecedor dist UI + nextAllowedAt
- Causa: Easypanel usa `dist/` do Git; UI nova só estava na raiz
- Fix: commit `dist/index.html` + limpar nextAllowedAt passado no status/start
- Marker: `DEPLOY-2026-07-16-aquecedor-dist-ui-nextallowed`
- Ver `doc/LOG-2026-07-16__202800__aquecedor-dist-ui-nextallowed-fix.md`
- Keywords: `dist`, `nextAllowedAt`, `16:02`, `Easypanel`

## 2026-07-16 — Aquecedor status linha clara
- `próximo` com data completa `dd/mm/aaaa - hh:mm:ss`
- Fase: processando | em pausa | parado | ativo (não mais lastResult cru)
- Marker: `DEPLOY-2026-07-16-aquecedor-status-linha-clara`
- Ver `doc/LOG-2026-07-16__195500__aquecedor-status-linha-clara.md`
- Keywords: `aquecedor`, `status`, `próximo`, `em pausa`

## 2026-07-16 — Aquecedor Envio teste EVO
- Fix: teste usa live-open (não só active/Preparando); não mata motor; EVO `text` raiz; sucesso se HTTP aceito
- Validado: sendText soma-crm→walkup 201 + `/service/evo-integration-probe` ok
- Marker: `DEPLOY-2026-07-16-aquecedor-envio-teste-evo-fix`
- Ver `doc/LOG-2026-07-16__160500__aquecedor-envio-teste-evo-fix.md`
- Keywords: `aquecedor`, `envio-teste`, `run-once`, `sendText`, `evo`

## 2026-07-16 — Aquecedor continua após logout
- Pasta canônica: `H:\Meu Drive\Drive Profissional\Waba` (mais nova que backup `D:\Waba`)
- Bug: motor parava após deslogar; UI só retomava com sessão
- Fix: `desired=true` basta para liderar/persistir `running`; reload merge sem matar timer
- Marker: `DEPLOY-2026-07-16-aquecedor-continua-apos-logout`
- Ver `doc/LOG-2026-07-16__154958__aquecedor-continua-apos-logout.md`
- Keywords: `aquecedor`, `logout`, `desired`, `runtime-intent`, `daemon`

## 2026-07-16 — Sinal Verde: publicação guiada passo a passo
- Easypanel **verde**; domínio ainda **Parked Hostinger** (DNS, não app)
- Etapa: corrigir NS/A para IP real da VPS do Easypanel
- Keywords: `sinal-verde`, `parked`, `dns`, `hostinger`, `easypanel-verde`

## 2026-07-16 — Sinal Verde: DNS + publicação Easypanel (início)
- Domínio: `acesso-sinalverde.com` → A `@` = `2.57.91.91` (resolução OK; www via CNAME)
- Projeto Easypanel: `sinal-verde` (VPS **não** é o WABA `72.60.51.127`)
- Próximo: confirmar IP da VPS = `2.57.91.91` → adicionar domínio no serviço do app
- Ver `doc/LOG-2026-07-16__143000__sinal-verde-dns-easypanel-inicio.md`
- Keywords: `sinal-verde`, `acesso-sinalverde.com`, `easypanel`, `dns`, `2.57.91.91`

## 2026-07-14 — Deploy prod cupons lista única
- Marker: `DEPLOY-2026-07-14-cupons-lista-unica-filtro`
- Ver `doc/LOG-2026-07-14__152100__deploy-cupons-lista-unica.md`

## 2026-07-14 — Cupons lista única + filtro tipo
- Uma tabela (Ativos/Inativos) com filtro Desconto|Envios; forms lado a lado
- Ver `doc/LOG-2026-07-14__151644__cupons-lista-unica-filtro.md`

## 2026-07-14 — Deploy lista + saldo inteiro Bônus Envios
- Marker: `DEPLOY-2026-07-14-bonus-envios-lista-saldo-inteiro`
- Lista Ativos/Inativos + grant sem herdar consumo antigo
- Ver `doc/LOG-2026-07-14__145300__deploy-bonus-envios-lista-saldo.md`

## 2026-07-14 — Bônus Envios sem dívida de consumo
- Disponível = pago remanescente + bônus admin intacto; uso antigo não reduz o grant
- Ver `doc/LOG-2026-07-14__142900__bonus-envios-nao-herda-consumo.md`

## 2026-07-14 — Lista Bônus Envios Ativos/Inativos
- Tabela abaixo do form (mesmo padrão cupons): Ativos/Inativos por validade + desativação manual
- `GET/PATCH /admin/bonus-envios`; `grantActive` corta Disponível
- Ver `doc/LOG-2026-07-14__140840__bonus-envios-lista-ativos-inativos.md`

## 2026-07-14 — Deploy prod + V02 Bônus Envios
- Marker: `DEPLOY-2026-07-14-bonus-envios-admin`
- Feature admin Assinantes: creditar envios intransferíveis no Disponíveis
- Produção: push `master` + Redeploy Easypanel `waba_disparador`; validar `/health`
- V02 local: branch `v02` alinhada + `build:h` + `dev:v02`
- Keywords: bonus-envios, deploy-marker, v02

## 2026-07-14 — Bônus Envios (admin)
- Bloco **Bônus Envios** acima de Cupons (Assinantes): busca assinante + qty + plano + validade → credita no **Disponíveis**
- `POST /admin/bonus-envios` → pedido pago isolado por `ownerEmail` (`grantSource: admin-bonus-envios`)
- Validade: mesma dos cupons; `creditsValidUntil` corta saldo ao expirar
- Ver `doc/LOG-2026-07-14__131751__bonus-envios-admin-create.md`
- Keywords: bonus-envios, creditar-envios, admin-bonus-envios, creditsValidUntil

## 2026-07-13 — Bundle deploy cadastro + docs
- Marker: `DEPLOY-2026-07-13-bundle-cadastro-cors-docs`
- Empacota sessão: uptime/login-heal/tarifador/encurtador (já no master) + docs/CORS + agent Traefik
- Landing cadastro: `pv-waba-disparador` `3826a02` → redeploy `waba_paginadevendas`
- Validar: `/health` deployMarker + form em wabadisparos.com.br/#cadastro
- Keywords: bundle-cadastro-cors-docs, deploy marker
2026-07-13 (14:57 — Agente Traefik Incidentes)

**Agente Traefik Incidentes** (2026-07-13): `@traefik-incident-specialist` + Rule + `doc/traefik-causes/REGISTRY.md` + `scripts/traefik-kb-search.py` (corpus 50k em `E:\Waba\traefik-crawler\urls.txt`). Desconexão → RAG/docs → fix definitivo → registra causa. Ver `doc/LOG-2026-07-13__145700__agente-traefik-incidentes-cursor.md`.

2026-07-13 (14:52 — grant 1000 Oficial+Alternativa mozart)

**WABA — Créditos mozart.pmo (2026-07-13):** +1000 Oficial (`406b62e6…`) e +1000 Alternativa (`8eb8d2f2…`) via `grant-disparos-credits-production.cjs --api both`. Ver `doc/LOG-2026-07-13__145200__grant-1000-oficial-alternativa-mozart.md`.

2026-07-13 (14:50 — fix encurtador + salvar seção Alternativa)

**WABA — Encurtador + Salvar seção (2026-07-13):** fallbacks is.gd/TinyURL; erros detalhados; `allowPartialSave` não zera WhatsApp/números. Marker `DEPLOY-2026-07-13-fix-encurtador-salvar-secao`. Ver `doc/LOG-2026-07-13__145000__fix-encurtador-salvar-secao-alternativa.md`.

2026-07-13 (14:30 — tarifador sem faixa 100/R$30)

**WABA — Tarifador sem faixa 100 · R$ 0,03 · R$ 30 (2026-07-13):** removida da UI (Oficial/Alternativa) e do backend (`DISPAROS_TEST_PACKAGES`). Outros e Bets. Marker `DEPLOY-2026-07-13-tarifador-sem-faixa-100`. Ver `doc/LOG-2026-07-13__143000__tarifador-remove-faixa-100-r30.md`.

2026-07-13 (14:16 — Traefik crawler 50k)

**Traefik crawler 50k** (2026-07-13): `E:\Waba\traefik-crawler\urls.txt` com **50.000** URLs. Ver `doc/LOG-2026-07-13__141600__traefik-crawler-50k-urls.md`.

2026-07-13 (17:19 — anti falso alerta **em produção**)

**WABA — Deploy validado (2026-07-13):** marker `DEPLOY-2026-07-13-uptime-anti-false-alert`; `/health` 200; `:30180` 200; login rota OK. Heal watch ativo.

**WABA — Monitor anti falso alerta (2026-07-13):** confirmação 2 ticks + re-probe antes de WhatsApp; 3ª chance Traefik `:80`; probe local. Marker `DEPLOY-2026-07-13-uptime-anti-false-alert`. Ver `doc/LOG-2026-07-13__172000__uptime-anti-falso-alerta.md`.

**WABA — Login heal v2 ATIVO no srv1261237 (2026-07-13):** `waba-login-heal-watch.service` = **active**; timer 20s; burst HTTPS 200 na rodada 1. Install confirmado pelo usuário. Próximos redeploys devem auto-curar `:30180` sem login Not Found. Ver `doc/LOG-2026-07-13__171200__login-heal-watch-burst-permanente.md`.

**WABA — Login pós-deploy NÃO pode falhar (2026-07-13):** 3 camadas — `waba-login-heal-watch` (docker events→burst), timer 20s, Actions `Heal WABA Login` no push master. UI retry 404/502. **Install v2 no VPS uma vez.** Marker `DEPLOY-2026-07-13-login-heal-watch-v2`. Ver `doc/LOG-2026-07-13__171200__login-heal-watch-burst-permanente.md`.

**WABA — Login Not Found pós-redeploy (2026-07-13):** janela 502/Traefik após Redeploy; em seguida `/health` 200 marker `DEPLOY-2026-07-13-uptime-local-probe-src`, `POST /auth/login` OK (401 JSON). Hard refresh + retry; se persistir: `heal-waba-login-vps.sh run`. Ver `doc/LOG-2026-07-13__170800__login-not-found-pos-redeploy.md`.

**WABA — Monitor Fetch failed (2026-07-13):** falso negativo hairpin no container. Sites públicos 200; prod ainda em marker `DEPLOY-2026-07-11-logs-sistema-ui-dark`. Fix em src+dist: probe local `172.17.0.1:30210/30211/30180` + fallback Traefik `:80` Host. Marker `DEPLOY-2026-07-13-uptime-local-probe-src`. **Redeploy Easypanel `waba_disparador` obrigatório.** Ver `doc/LOG-2026-07-13__170500__uptime-fetch-failed-src-e-redeploy.md`.

**WABA — Monitor falso Fetch failed (2026-07-13 13:55):** sites públicos 200; container não fazia hairpin. Probe preferencial `172.17.0.1:30210/30211/30180`. Marker `DEPLOY-2026-07-13-uptime-local-probe-fix`. Ver `doc/LOG-2026-07-13__135500__uptime-fetch-failed-probe-local.md`.

**Drive principal = E:** (2026-07-13): workspace operacional em `E:\Waba` (não H: para venv/npm/crawlers). Doc: `doc/SETUP-E-DRIVE.md`. Cursor: Open Folder → `E:\Waba`.

**Traefik crawler RAG** (2026-07-13): `E:\Waba\traefik-crawler` — async, checkpoint 500, até 50k URLs → `urls.txt`. Rodar: `python main.py`. Ver `doc/LOG-2026-07-13__133500__traefik-crawler-e-drive-padrao.md`.

**WABA — V02 paridade prod (2026-07-13):** branch `v02` = master `fe46ddc` + marker `DEPLOY-2026-07-13-v02-paridade-prod-logs-handoff`. Redeploy Easypanel `waba_disparador_v02` + `/tmp/sync-v02.sh run` no VPS (dados). Testes no V02; prod só à noite. Ver `doc/LOG-2026-07-13__121500__v02-paridade-producao.md`.

**WABA — Detalhes Logs = handoff (2026-07-13):** brief para dev/agente (probe, stack, playbook, comandos); UI Ver/Copiar handoff; Excel com coluna Handoff. Marker `DEPLOY-2026-07-13-logs-handoff-tecnico`. Ver `doc/LOG-2026-07-13__120500__logs-handoff-tecnico-detalhes.md`.

**WABA — Filtros Logs (2026-07-13):** Motivo com **Todos** + opções; layout em 2 linhas (filtros / botões). Marker `DEPLOY-2026-07-13-logs-filtros-duas-linhas`. Ver `doc/LOG-2026-07-13__115500__logs-filtros-todos-duas-linhas.md`.

**WABA — Login pós-deploy (2026-07-11):** 502 por perda de `:30180`, não senha. Watchdog `heal-waba-login-vps.sh` + timer 60s; UI retry 502. **Instalar uma vez no VPS.** Marker `DEPLOY-2026-07-11-login-heal-watchdog`. Ver `doc/LOG-2026-07-11__224500__heal-login-pos-redeploy-permanente.md`.

**WABA — UI Logs Sistema (2026-07-11):** CSS alinhado ao Monitor CPU (cards/inputs/tabela escuros); tabela tinha zero estilo. Marker `DEPLOY-2026-07-11-logs-sistema-ui-dark`. Ver `doc/LOG-2026-07-11__224000__logs-sistema-ui-tema-escuro.md`.

**WABA — Login falha = 502 (2026-07-11):** `/health` HTTPS 502 Bad Gateway (não senha). Pós-redeploy: republicar `:30180` + `restore-easypanel-traefik-backends-vps.sh`. Sem SSH desta máquina — colar no Hostinger. Ver `doc/LOG-2026-07-11__223000__login-502-pos-redeploy.md`.

**WABA — Push `95732f6` (2026-07-11):** Logs Sistema só como página interna do Monitor CPU; registry sem `admin-logs-sistema`; `dist/` no commit. Marker `DEPLOY-2026-07-11-logs-dentro-monitor-cpu`. Redeploy Easypanel `waba_disparador`; validar `/health` + abas no Monitor CPU. Ver `doc/LOG-2026-07-11__222300__logs-dentro-monitor-cpu-fix-vazio.md`.

**WABA — Logs = página dentro do Monitor CPU (2026-07-11):** sem menu lateral; abas Monitor CPU | Logs Sistema. Tela vazia era HTML aninhado (`logs` dentro de `cpu` + `hidden` no pai). Build `dist/` ok; marker `DEPLOY-2026-07-11-logs-dentro-monitor-cpu`. Pendente: commit/push + Redeploy. Ver `doc/LOG-2026-07-11__222300__logs-dentro-monitor-cpu-fix-vazio.md`.

**WABA — Prod sem UI nova (2026-07-11):** código em master; falta Redeploy Easypanel `waba_disparador`. Marker `DEPLOY-2026-07-11-logs-sistema` commit `b9d7fa3`. Após deploy conferir `/health` + menu Logs Sistema; republicar `:30180` se 502. Ver `doc/LOG-2026-07-11__212500__prod-sem-logs-sistema-precisa-redeploy.md`.

**WABA — Sessão ok (2026-07-11):** usuário confirmou "pronto". Logs Sistema em master. Redeploy Easypanel se painel ainda sem menu. Ver `doc/LOG-2026-07-11__211200__encerramento-logs-sistema.md`.

**WABA — Logs Sistema (2026-07-11):** (corrigido) divisão de páginas *dentro* de Monitor CPU, não menu separado. Ver LOG `222300`.

**WABA — Motivo da queda (2026-07-10 ~22h):** heal rodou `restore-easypanel-traefik-backends` v1 → URLs overlay (`waba_paginadevendas:3000`) → 502; depois HUP → Traefik down → 000. Apps locais OK. Fix backends v2 host gateway. Ver `doc/LOG-2026-07-10__220700__502-overlay-dns-backends.md`.

**WABA — 502 por restore-easypanel (2026-07-10):** script v1 pôs `waba_paginadevendas:3000` (overlay) → 502; HUP → 000. Locais :30210/:30180 OK. Fix `2d2705c` backends v2 = `172.17.0.1` + sem HUP. Ver `doc/LOG-2026-07-10__220700__502-overlay-dns-backends.md`.

**WABA — Contingência Traefik (2026-07-10):** VPS estável 200×3 + 1/1; camadas: bootstrap 1min, 443-watchdog 45s, entrypoint-guard 3min, anti-thrash v6, uptime 5min, doc Always Online. Pendente: Cloudflare Always Online manual. Ver `doc/LOG-2026-07-10__214000__plano-contingencia-status.md` + `doc/CLOUDFLARE-ALWAYS-ONLINE-LANDINGS.md`.

**WABA — Traefik thrash 0/1 (2026-07-10):** permanent-all ligou fix.timer 20s + watches + config-guard → force em loop. Estabilizou com timers OFF; só bootstrap+443-watchdog+entrypoint-guard. Repo: `traefik-permanent-all` **v6** desliga thrash no install. Ver `doc/LOG-2026-07-10__213500__traefik-1-1-anti-thrash.md`.

**WABA — VPS install mitigação (2026-07-10):** srv1261237 — watchdog `:443` 45s OK; guard v2.2 OK (bet/disparos 200); `traefik-permanent-all` falhou curl reset GitHub — retry. Ver `doc/LOG-2026-07-10__212200__vps-install-watchdog-guard-ok.md`.

**WABA — Mitigação Traefik down (2026-07-10):** commit `e361029` — watchdog `:443` 45s (`traefik-443-watchdog-vps.sh`), autoheal v3 + bootstrap prioritário, guard v2.2 chama bootstrap se bet+disparos=000, bootstrap timer 1min, uptime default 5min/realert 30, `doc/CLOUDFLARE-ALWAYS-ONLINE-LANDINGS.md`, SW parcial em `public-pages/`. **VPS:** instalar watchdog + reinstall guard; Cloudflare Always Online manual. Ver `doc/LOG-2026-07-10__211000__mitigacao-completa-traefik-down.md`. Keywords: `traefik-443-watchdog`, Always Online, bootstrap 45s.

**WABA — Deploy Easypanel chamados (2026-07-10):** push `master` `d8e2aaf` assunto `[a331459] feat: permitir criar chamado para todos os usuarios`; marker `DEPLOY-2026-07-10-chamados-todos-usuarios`. Confirmar rebuild `waba_disparador` no Easypanel. Ver `doc/LOG-2026-07-10__130800__deploy-easypanel-chamados.md`.

**WABA — Criar chamado todos usuários (2026-07-10):** API libera qualquer autenticado; Master usa botão na tela Chamados; demais usam FAB como assinantes; mesmo modal. Marker `DEPLOY-2026-07-10-chamados-todos-usuarios`. Ver `doc/LOG-2026-07-10__124100__chamados-criar-todos-usuarios.md`. Palavras-chave: `admin-chamados-create-btn`, `canOpenSupportTickets`, `waba-support-fab`.

**WABA — Cobranças Financeiro limpas (2026-07-10):** `waba-billing-orders.json` = 3 B (`[]`); split-config 1211 B preservado.

**WABA — Purge + serviço OK (2026-07-10):** health `ok:true`; intakes/push/tickets/settlements ~36–40 B; split-config 1211 B + billing-orders 7780 B preservados. Marker `DEPLOY-2026-07-10-chamados-todos-usuarios`.

**WABA — Purge Admin menus OK (2026-07-10):** intakes/push/tickets/settlements ~36–40 B; billing-orders + split-config preservados; Supabase OK. Backup `purge-admin-menus-20260710T203516Z`. Ver `doc/LOG-2026-07-10__173600__purge-admin-menus-sucesso.md`.

**WABA — Pós-purge Admin (2026-07-10):** health mostra purge **incompleto** — intakes/push/settlements/tickets ainda com sizeBytes altos; só `disparosLocal` parece limpo. Split-config e billing-orders OK. Reaplicar com `--apply --with-supabase`. Ver `doc/LOG-2026-07-10__152200__pos-purge-admin-menus-checklist.md`.

**WABA — Purge Admin menus (2026-07-10):** escopo OK (Push = só histórico; Financeiro mantém split-config + pedidos). Script `purge-admin-menus-production.cjs` pronto. **Bloqueado:** sem chave SSH nesta máquina — aplicar via Hostinger console. Ver `doc/LOG-2026-07-10__121800__purge-admin-menus-ssh-bloqueado.md`.

**WABA — E:\Waba sync master (2026-07-09):** merge `origin/master` `4c3f0d6` (uptime diagnose); `.env.v02` e `data/v02` preservados; V02 http://localhost:3012/version-02/ OK (mail, assinantes, EVO prod). Ver `E:\Waba\doc\LOG-2026-07-09__215300__sync-e-drive-master-uptime-diagnose.md`. **Dev canônico: E:\Waba**.

**WABA — V02 local montado H: (2026-07-09):** `init:env` + `build:h` + `dev:v02` OK em http://localhost:3012/version-02/; `run-ts-dev.cjs` usa dist no Drive H:. Dados/segredos vazios — sem backup D:\\Waba. Ver `doc/LOG-2026-07-09__213900__v02-local-montado-workspace-h.md`.

**WABA — Deploy prod uptime diagnose + V02 paridade (2026-07-09):** master `0638e8d` marker `DEPLOY-2026-07-09-uptime-diagnose-playbooks`; v02 `18b3d46` marker `DEPLOY-2026-07-09-v02-paridade-prod-uptime-diagnose` (force push). Pendente: redeploy Easypanel prod + v02, sync VPS `/tmp/sync-v02.sh run`. Ver `doc/LOG-2026-07-09__212700__deploy-prod-uptime-diagnose-v02-paridade.md`.

**WABA — Uptime diagnose finalizado (2026-07-09):** fix Asaas sem alertas WhatsApp no diagnóstico; `npm run verify:uptime-diagnose`; UI botão nas luzes vermelhas (walkup only). Ver `doc/LOG-2026-07-09__212200__uptime-diagnose-finalizar-validar.md`. Palavras-chave: `uptime diagnose`, `verify:uptime-diagnose`.

**WABA — Retomada sessão (2026-07-09):** workspace em H: confirmado; pendências: commit diagnóstico uptime + setup H:, sync `.env`, remover cópia antiga em `C:\Users\Usuario\Waba`. Ver `doc/LOG-2026-07-09__211800__snapshot-recuperacao-retomada-sessao.md`. Palavras-chave: `retomada`, `uptime diagnose`, `commit pendente`.

**WABA — Workspace Google Drive H: (2026-07-09):** repositório montado em `H:\Meu Drive\Drive Profissional\Waba` via `git clone`; `npm install` no H: não funciona (Drive não NTFS) — usar `npm run build:h` (deps em `%USERPROFILE%\.waba-h-deps`). Ver `doc/SETUP-H-DRIVE.md` e `doc/LOG-2026-07-09__210700__montagem-waba-git-unidade-h.md`. Palavras-chave: `H-drive`, `build:h`, `waba-h-deps`, `google drive workspace`.

**WABA — Aquecedor isolamento + pares regressão (2026-07-09):** master não aquece instâncias de outros assinantes; fila/ciclo/turnos por escopo do owner; `cicloGlobal` por motor. Marker `DEPLOY-2026-07-09-aquecedor-isolamento-pares-fix`. Ver `doc/LOG-2026-07-09__133000__aquecedor-isolamento-pares-regressao-fix.md`. Palavras-chave: `aquecedor cross-tenant`, `pares A→B`, `mozart walkup`.

**WABA — Hex Créditos Outros imagem restaurada (2026-07-09):** tela Contratar volta a usar `disparos-hex-cluster.png` (3 hexágonos inteiros); removido SVG `.disparos-hex-light-lines` e CSS `mix-blend-mode: lighten` / `aspect-ratio` que cortavam o topo. Bets mantém `creditBet_02.png`. Ver `doc/LOG-2026-07-09__162500__hex-outros-restaurar-imagem-sem-svg.md`. Palavras-chave: `disparos-hex-cluster`, `hex-orbit`, `Contratar créditos Outros`.

**WABA — Mensagem masters + BM inoperante (2026-07-09):** masters nova campanha com Operador no resumo; BM inoperante → `# BM INOPERANTE ATRIBUÍDA` para masters. Marker `DEPLOY-2026-07-09-operacional-mensagem-masters-bm`.

**WABA — Evolution P1001 overlay Swarm (2026-07-09):** DB `pg_isready` OK mas `nc` → Host unreachable `10.11.0.19`; fix `docker service update --force` DB→redis→EVO ou `systemctl restart docker`. Ver LOG P1001 seção overlay.

**WABA — EVO HTTP 500 send recovery + failover (2026-07-09):** failover URL (`172.17.0.1:30181`), restart leve da instância em 500 Prisma/integrationSession, reenvio único em aquecedor/disparos/operacional/boas-vindas; monitor uptime checa `fetchInstances`. Marker `DEPLOY-2026-07-09-evo-send-recovery-failover`. Ver `doc/LOG-2026-07-09__121500__evo-http-500-send-recovery-failover.md`. Palavras-chave: `evo 500`, `integrationSession`, `aquecedor pendente`, `failover 30181`.

**WABA — Iniciar campanha resposta rápida (2026-07-09):**** modal fecha em ~400ms; lista em background; listCampanhas sem ensure em todas. Marker `DEPLOY-2026-07-09-iniciar-campanha-resposta-rapida`. Ver `doc/LOG-2026-07-09__115500__iniciar-campanha-salvando-travado-fix.md`.
 notify assíncrono em reassign; mutex frontend. Marker `DEPLOY-2026-07-09-bm-inoperante-resposta-rapida`. Ver `doc/LOG-2026-07-09__113500__bm-inoperante-processando-travado-fix.md`.
 +1000 API Oficial; saldo **3295** contratados. Pedido `cff38860-ddc5-4838-8b18-6e9dbae34531`. Ver `doc/LOG-2026-07-09__112500__grant-1000-creditos-mozart-pmo-producao.md`.
 verificado fluxo Processando→Registrado→fecha 1,2s; fix refresh lista não bloqueia fechamento. Marker `DEPLOY-2026-07-09-bm-inoperante-modal-fecha-seguro`. Ver `doc/LOG-2026-07-09__111500__bm-inoperante-modal-processando-fecha.md`.
 operador Bets atende Bets+Outros; operador Outros só Outros; escalonamento Outros→Bets permitido, inverso não. Marker `DEPLOY-2026-07-09-fila-campanha-segmento-bets-outros`. Ver `doc/LOG-2026-07-09__110300__fila-campanha-segmento-bets-outros.md`.
 footer único no detalhe Admin Campanhas; modal ~920px. Marker `DEPLOY-2026-07-09-modal-campanha-botoes-inline`. Ver `doc/LOG-2026-07-09__104700__modal-campanha-botoes-inline.md`.

**WABA — paginadevendas 30210 + Traefik flapping (2026-07-09):** overlay `waba_paginadevendas:3000` unreachable no Traefik; serviço sem porta publicada (`null`). Fix: `publish-add 30210→3000` + backends `172.17.0.1:30210`. Log `doc/LOG-2026-07-09__101900__emergency-traefik-443-wabadisparos-login.md`.

**WABA — Landing pages 502 (2026-07-09):** `bet.waba.info` e `wabadisparos.com.br` fora (502/flapping). Fix VPS: `restore-landing-routers-vps.sh`. Log `doc/LOG-2026-07-09__084500__landing-pages-502-uptime-monitor.md`. Palavras-chave: `uptime-monitor`, `502 landing`, `bets_pv`, `paginadevendas`.

**WABA — Campanha WhatsApp masters + operacional + sequência unificada (2026-07-09):** sem broadcast operacionais; mensagem curta com envios/data/nome operacional; masters + atribuído; módulo `deliverWabaEvolutionWhatsApp` (51981077770→51997462102→51981082477) em campanha, boas-vindas, uptime e asaas. Marker `DEPLOY-2026-07-09-campanha-whatsapp-masters-operacional`. Ver `doc/LOG-2026-07-09__084744__campanha-whatsapp-masters-operacional-sequencia.md`. Palavras-chave: `listMasterUsers`, `waba-evolution-whatsapp-delivery`.

**WABA — WhatsApp operacional nova campanha 3 instâncias + retry (2026-07-09):** sequência `51981077770` → `51997462102` → `51981082477`, até 15 rodadas síncronas + retry em background até sucesso. Marker `DEPLOY-2026-07-09-operacional-campanha-whatsapp-3instancias`. Ver `doc/LOG-2026-07-09__030500__operacional-campanha-whatsapp-3instancias-retry.md`. Palavras-chave: `deliverOperacionalNewCampaignWhatsApp`, `operacionalNotify`.

**WABA — BM inoperante botão vermelho estados (2026-07-09):** Processando → Registrado; fila vazia mensagem aguardar BM; `bmInoperanteRegisteredAt`. Marker `DEPLOY-2026-07-09-bm-inoperante-botao-vermelho-estados`. Ver `doc/LOG-2026-07-09__073500__bm-inoperante-botao-vermelho-estados.md`.

**WABA — Campanha intake gateway erro assinante (2026-07-09):**** notify operacional em background; POST responde rápido; frontend recupera via clientRequestId após 502/timeout. Marker `DEPLOY-2026-07-09-campanha-intake-resposta-rapida-notify-async`. Ver `doc/LOG-2026-07-09__071800__campanha-intake-gateway-erro-assinante.md`.

**WABA — Fix campanha duplicada v2 (2026-07-09):**** lock síncrono frontend, mutex backend, fingerprint 5min, API v4. Marker `DEPLOY-2026-07-09-fix-campanha-duplicada-idempotencia-v2`. Ver `doc/LOG-2026-07-09__064000__fix-campanha-duplicada-idempotencia-v2.md`.

**WABA — Fix campanha duplicada v1 (2026-07-09):** `clientRequestId`, API v3 — insuficiente sob duplo clique/corrida. Ver `doc/LOG-2026-07-09__024500__fix-campanha-duplicada-idempotencia.md`.

**WABA — Deploy fornecedores produção (2026-07-09):** build `dist/` + marker `DEPLOY-2026-07-09-financeiro-fornecedores-producao`. Src já em `bfbda1d`. Redeploy Easypanel `waba_disparador`. Ver `doc/LOG-2026-07-09__022000__deploy-financeiro-fornecedores-producao.md`.

**WABA — Grant 1000 créditos obotmoney produção (2026-07-09):** +1000 envios API Oficial via `grant-disparos-credits-production.cjs`; saldo **1100** contratados. Pedido `7d8d203f-9528-4773-9b63-b7db41e07ed2`. Ver `doc/LOG-2026-07-09__063200__grant-1000-creditos-obotmoney-producao.md`.

**WABA — Grant 100 créditos obotmoney produção (2026-07-09, substituído):** ver LOG `014500`; saldo acumulado no grant de 1000.

**WABA — Bets ocultar saldo API Alternativa (2026-07-09):** Resumo Saldos e hub créditos sem bloco Alternativa para segmento Bets. Log `doc/LOG-2026-07-09__013500__bets-ocultar-saldo-api-alternativa.md`.

**WABA — Fix cadastro Bet login + WhatsApp (2026-07-09):** persistência atômica assinante, validação pós-gravação, boas-vindas await na API register, fallbacks Evo walkup/drax-oficial. Log `doc/LOG-2026-07-09__011800__fix-cadastro-bet-login-whatsapp.md`.

**WABA — Fix V02 tela branca (2026-07-08):** `SyntaxError` por `const bmInoperanteBtn` duplicado em `closeAdminCampanhasDetailModal()` — quebrava todo JS do `index.html`. Log `doc/LOG-2026-07-08__223800__fix-v02-tela-branca-bm-inoperante-dup.md`.

**WABA — Bets cadastro fluxo V02 imediato (2026-07-08):** após `POST /subscribers/register` (segmento Bets, boas-vindas e-mail+WhatsApp), redirect automático para `loginUrl` — sem “time entrará em contato”. Tela “login em breve” em bet.waba.info é app **bets_pv** (deploy separado). Log `doc/LOG-2026-07-08__220000__bets-cadastro-fluxo-v02-imediato.md`.

**WABA — Financeiro fornecedores + fila operacional deploy (2026-07-08):** prioridade 1–5, atribuição campanha por plano+segmento, BM inoperante, reassign 30h, split fornecedor pós-finalizar. Logs `213500`, `214500`.

**WABA — Campanhas coluna segmento + modal (2026-07-08):** tabela operacional e modal de detalhes exibem segmento Bets/Outros. Log `doc/LOG-2026-07-08__214500__campanhas-coluna-segmento-modal.md`.

**WABA — Financeiro fornecedores + fila operacional V02 (2026-07-08):** prioridade 1–5, select operacional, múltiplos fornecedores por plano+segmento, atribuição campanha, BM inoperante, reassign 30h, alerta master sininho, split fornecedor só após finalizar. Log `doc/LOG-2026-07-08__213500__financeiro-fornecedores-prioridade-fila-v02.md`. Palavras-chave: `fornecedor prioridade`, `BM inoperante`, `campaign-supplier-assignment`.

**WABA — Landing Bets logo +30% (2026-07-08):** `public-pages/bets.html` usa `media/drax-bets-logo.png` (header 3.36375rem, footer 2.925rem). Marker `DEPLOY-2026-07-08-bets-landing-logo-30pct`. Log `doc/LOG-2026-07-08__233600__bets-landing-logo-30pct.md`.

**WABA — V02 Admin Financeiro pronto teste (2026-07-08):** split com ordem CET→fornecedor→parceiro (`sortSplitSettlementLines`), select plano fornecedor e select master no rateio; build + `dev:v02` reiniciado. Sem commits novos desta semana só de Financeiro — features de jun/2026. Log `doc/LOG-2026-07-08__203500__v02-admin-financeiro-teste.md`. Palavras-chave: `admin financeiro`, `split fornecedores`, `buildSplitMasterSelectOptions`.

**WABA — Deploy produção Bets V02 (2026-07-08):** merge `v02` → `master` — tarifador Bets, landing/cadastro telefone, boas-vindas equipe, creditBet_02, admin menus bulk. Marker `DEPLOY-2026-07-08-bets-v02-paridade-landing-cadastro`.

**WABA — V02 draxsistemas apenas assinante (2026-07-08):** removido usuário Master `Teste Split`; mantido assinante Ana Cristina. Log `doc/LOG-2026-07-08__200500__v02-draxsistemas-apenas-assinante.md`.

**WABA — Boas-vindas operacional/suporte (2026-07-08):** `notifyStaffWelcome` em `WabaSystemUserService.create`. Log `doc/LOG-2026-07-08__195500__boas-vindas-automatica-operacional-suporte.md`.

**WABA — Cadastro Bets telefone/WhatsApp (2026-07-08):** `resolveSubscriberWhatsAppMobile`, máscara landing. Log `doc/LOG-2026-07-08__165100__bets-cadastro-telefone-whatsapp-fix.md`.

**WABA — Tarifador Bets 5k–50k + creditBet_02 + oculta Alternativa (2026-07-08):** ver LOGs `181800`, `190700`, `184700`.

**WABA — Disable overkill heal Traefik (2026-07-08):** `scripts/infra/traefik-heal-disable-overkill-vps.sh`. Log `doc/LOG-2026-07-08__092650__traefik-heal-disable-overkill-sem-pausar-apps.md`.

**WABA — Auditoria Traefik overkill + CPU (2026-07-08):** Log `doc/LOG-2026-07-08__092011__auditoria-traefik-scripts-cpu-overkill.md`.

**WABA — Restore landings Traefik v6 (2026-07-08):** Log `doc/LOG-2026-07-08__085407__restore-landing-traefik-v6-easypanel-format.md`.

**WABA — OG wabadisparos DEFINITIVO (código-fonte):** Ver `doc/LOG-2026-07-07__105500__og-wabadisparos-definitivo-codigo-fonte.md`.

**WABA — Operacional: persistência de WhatsApp + notify por WhatsApp:** `Admin · Usuários` agora persiste `whatsapp` e `segmento` do operador; campanha nova envia e-mail e também WhatsApp com fallback de instância `51981077770` -> `5197462102`. Ver `doc/LOG-2026-07-03__operacional-whatsapp-persistencia-e-notify.md`. Palavras-chave: `waba-system-user`, `operacionalNotify`, `whatsapp`, `segmento`, `final 77770`.

**WABA — Admin Usuários (front):** formulário e modal de edição ganharam campo visual de `WhatsApp` e select `Segmento` (`Bets`/`Todos`) para papel `operacional`, com máscara e exibição condicional. Ver `doc/LOG-2026-07-03__admin-usuarios-front-whatsapp-segmento.md`. Palavras-chave: `admin-user-whatsapp`, `operacional-segment`, `Admin Usuários`.

**WABA — Healthcheck do `waba_disparador` estabilizado:** Docker deixou de usar `GET /health` pesado (snapshot de `/app/data`) e passou a usar `GET /ready` com timeout/start-period/retries mais tolerantes; marker `DEPLOY-2026-07-03-healthcheck-ready-waba-disparador`. Ver `doc/LOG-2026-07-03__fix-waba-disparador-healthcheck-ready.md`. Palavras-chave: `waba_disparador`, `HEALTHCHECK`, `/ready`, Easypanel amarelo/verde.

**WABA — Fix OG image não indexada:** `compBoasvindasV3.png` 1.5 MB → `.jpg` 140 KB (1200×1200 q82); scraper WhatsApp/Meta agora processa. Ver `doc/LOG-2026-07-03__fix-og-image-boas-vindas-otimizada.md`. Palavras-chave: `og:image`, `compBoasvindasV3`, preview WhatsApp.

**WABA — Fix timeout Admin Assinantes/Cupons:** listagem de assinantes deixou de chamar `getCreditsSummary` por linha (N+1); pedidos indexados uma vez; timeout frontend 45s + mensagem amigável. Ver `doc/LOG-2026-07-03__fix-admin-assinantes-cupons-timeout.md`. Palavras-chave: `listSubscribers`, `buildPaidDisparosOrdersByEmail`, `fetchWithTimeout`.

**WABA — Fix overlay deploy travado:** dismiss ao restaurar sessão; poll no pós-deploy; force complete 90s. Ver `doc/LOG-2026-07-03__fix-deploy-overlay-travado-pos-deploy.md`.

**WABA — Fix deploy Docker (dist desatualizado):** UI estava só em `index.html` raiz; produção usa `dist/index.html`. Build + `COPY public-pages` no Dockerfile. Ver `doc/LOG-2026-07-03__fix-deploy-dist-index-desatualizado.md`.

**WABA — Sidebar top fixo (sem scroll):** menu lateral alinha ao conteúdo no load; não acompanha rolagem da página. Ver `doc/LOG-2026-07-03__sidebar-top-fixo-sem-scroll.md`. Palavras-chave: `syncWabaSidebarStackTop`.

**WABA — Cupons form layout inline:** campo «Válido até» na mesma linha do grid (4 colunas). Ver `doc/LOG-2026-07-03__cupons-form-valido-ate-inline.md`.

**WABA — Admin assinantes ações inline:** ícones reenviar/excluir/editar na tabela; modal só Salvar+Fechar; overlay senha para reenvio. Ver `doc/LOG-2026-07-03__admin-assinantes-acoes-inline-tabela.md`. Palavras-chave: `admin-subscriber-row-icon-btn`.

**WABA — OG compartilhamento V3:** `compBoasvindasV3.png` em `/media/` + meta tags Open Graph/Twitter. Ver `doc/LOG-2026-07-03__og-compartilhamento-compBoasvindasV3.md`. Palavras-chave: `compBoasvindasV3`, `og:image`.

**WABA — OG compartilhamento V2:** `compBoasvindasV2.png` em `/media/` + meta tags Open Graph/Twitter. Ver `doc/LOG-2026-07-03__og-compartilhamento-compBoasvindasV2.md`. Palavras-chave: `compBoasvindasV2`, `og:image`.

**WABA — Fix botão Criar assinante (Admin):** validação inline CPF/e-mail; reset do botão ao abrir aba e no `finally`; submit único no form. Ver `doc/LOG-2026-07-03__fix-admin-criar-assinante-botao-travado.md`. Palavras-chave: `resetAdminSubscriberCreateFormState`, `admin-subscriber-create-error`.

**WABA — Overlay deploy só waba_disparador:** modal «Atualizando» habilitado apenas no container produção master; gatilho `shuttingDown` (não 502 genérico). Marker `DEPLOY-2026-07-03-deploy-overlay-so-waba-disparador`. Ver `doc/LOG-2026-07-03__deploy-overlay-so-waba-disparador.md`.

**WABA — OG compartilhamento redes:** `compBoasvindas.png` em `/media/` + meta tags Open Graph/Twitter. Ver `doc/LOG-2026-07-03__og-compartilhamento-compBoasvindas.md`.

**WABA — Boas-vindas WhatsApp fallback por número:** primária `51981077770`, se offline usa `5197462102`. Ver `doc/LOG-2026-07-03__boas-vindas-whatsapp-phone-fallback.md`.

**WABA — Boas-vindas WhatsApp fix instância + reenvio admin:** resolve instância Evolution conectada; timeout sendText 90s; `POST /admin/subscribers/:id/resend-welcome`. Ver `doc/LOG-2026-07-03__boas-vindas-whatsapp-fix-instancia.md`.

**WABA — Boas-vindas WhatsApp no cadastro:** mensagem DRAX com credenciais + comunidade enviada ao WhatsApp do assinante (site e master) via Evolution. Ver `doc/LOG-2026-07-03__boas-vindas-whatsapp-assinante.md`.

**WABA — Aquecedor: dashboard isolado por assinante:** `GET /dados` e `/aquecedor/envios` filtram por instâncias do dono; assinante sem instâncias vê dashboard vazio (fix vazamento global para `digitalcorban@gmail.com`). Ver `doc/LOG-2026-07-03__aquecedor-dashboard-isolamento-assinante.md`. Palavras-chave: `resolveAquecedorDashboardScope`, `filterQueueByOwner`, `logs_envios_br`.

**WABA — Boas-vindas com senha no e-mail:** template inclui senha de acesso no cadastro (site e master via `register()`). Marker `DEPLOY-2026-07-03-boas-vindas-senha-cadastro`. Ver `doc/LOG-2026-07-03__boas-vindas-email-senha-cadastro.md`. Palavras-chave: `buildSubscriberWelcomeTemplate`, `Senha de acesso`.

**WABA — Billing: prefill CPF + moeda milheiro + modal excluir:** doc do cadastro no checkout; R$ com milheiro; exclusão assinante sem alerta do navegador. Marker `DEPLOY-2026-07-02-billing-prefill-doc-moeda-milheiro`. Ver `doc/LOG-2026-07-02__billing-prefill-doc-moeda-excluir-modal.md`. Palavras-chave: `prefillDisparosBillingForm`, `admin-subscriber-delete-overlay`.

**WABA — Checkout: máscara qty + cupom toggle:** qty custom com milheiro pt-BR; cupom só após "Eu tenho cupom de desconto". Marker `DEPLOY-2026-07-02-billing-qty-mask-cupom-toggle`. Ver `doc/LOG-2026-07-02__billing-qty-mask-cupom-toggle.md`. Palavras-chave: `disparos-billing-coupon-toggle`, `parseDisparosQtyInputValue`.

**WABA — Admin: excluir assinante (UI + purge):** botão no modal master; DELETE por id; remove também operacional/suporte com mesmo e-mail. Marker `DEPLOY-2026-07-02-admin-assinante-excluir-ui`. Ver `doc/LOG-2026-07-02__admin-assinante-excluir-ui-purge.md`. Palavras-chave: `deleteAdminSubscriberDetail`, `purgeByEmail`, `digitalcorban`.

**WABA — Tarifador: Nenhum desses + qty custom:** opção na tabela Oficial/Alternativa; input para qty > última faixa; total = qty × último valor/envio; R$ na coluna unitária. Marker `DEPLOY-2026-07-02-tarifador-nenhum-desses-custom`. Ver `doc/LOG-2026-07-02__tarifador-nenhum-desses-quantidade-custom.md`. Palavras-chave: `Nenhum desses`, `buildDisparosCustomTier`, `resolveDisparosCustomListValueCents`.

**WABA — Admin assinante: editar cadastro no modal:** PATCH `/admin/subscribers/:id`; formulário editável no detalhe. Marker `DEPLOY-2026-07-02-admin-assinante-editar-cadastro`. Ver `doc/LOG-2026-07-02__admin-assinante-editar-cadastro-modal.md`. Palavras-chave: `saveAdminSubscriberDetail`, `updateSubscriber`.

**WABA — Master menu: destaque registros novos:** linhas com faixa âmbar + tag Novo ao abrir menu com badge; API retorna `seenAt`. Marker `DEPLOY-2026-07-02-master-menu-novos-destaque-linhas`. Ver `doc/LOG-2026-07-02__master-menu-destaque-registros-novos.md`. Palavras-chave: `master-menu-new-row`, `captureMasterMenuNewHighlight`, `seenAt`.

**WABA — Admin assinante: detalhe + histórico de compras:** clique na linha abre modal com dados cadastrais e compras; API `GET /admin/subscribers/:id`. Marker `DEPLOY-2026-06-21-admin-assinante-detalhe-compras`. Ver `doc/LOG-2026-06-21__admin-assinante-detalhe-historico-compras.md`. Palavras-chave: `openAdminSubscriberDetail`, `getSubscriberDetail`.

**WABA — Fix abas cupons Ativos/Inativos:** cor da aba ativa instantânea; campanhas deixou de sobrescrever botões de cupons/chamados. Marker `DEPLOY-2026-06-21-fix-cupons-abas-ativo-instantaneo`. Ver `doc/LOG-2026-06-21__fix-cupons-abas-ativo-instantaneo.md`. Palavras-chave: `admin-coupons-bucket`, `data-campanhas-bucket`.

**WABA — Admin assinante: e-mail boas-vindas:** cadastro master passa a enviar o mesmo e-mail da landing; lógica centralizada em `WabaSubscriberService.register()`. Marker `DEPLOY-2026-06-21-admin-assinante-boas-vindas-email`. Ver `doc/LOG-2026-06-21__admin-assinante-boas-vindas-email.md`. Palavras-chave: `notifySubscriberWelcomeEmail`, `buildSubscriberWelcomeTemplate`.

**WABA — Admin Assinantes: Aquecedor parceiro + cupons abas + copiar:** checkbox liberar Aquecedor no cadastro (`aquecedorGranted`); abas Ativos/Inativos nos cupons; botão Copiar código; removido hint padrão WABA. Marker `DEPLOY-2026-06-21-assinante-liberar-aquecedor`. Ver `doc/LOG-2026-06-21__admin-assinantes-aquecedor-cupons-abas-copiar.md`. Palavras-chave: `aquecedorGranted`, `admin-coupons-bucket`, `copyAdminCouponAlias`.

**WABA — Admin Assinantes: criar assinantes + cupons de desconto:** master cadastra assinantes e cupons (12h/24h/custom/vitalícia, % sobre total); checkout PIX aceita cupom antes da cobrança; alias `WABA-[#$%&*!@?][0000-9999]`. Marker `DEPLOY-2026-06-21-admin-assinantes-cupons-desconto`. Ver `doc/LOG-2026-06-21__admin-assinantes-cupons-desconto.md`. Palavras-chave: `admin-assinantes`, `waba-coupons.json`, `couponAlias`, `disparos-billing-overlay`.

**WABA — Diferenciais largura total (créditos):** barra Seguro/Performance/Flexível movida para fora do grid 2 colunas; ocupa largura total abaixo do board. Ver `doc/LOG-2026-06-21__diferenciais-largura-total-creditos.md`.

**WABA — Remoção faixa teste 100 envios R$ 5,00:** retirada de `DISPAROS_PRICING_TIERS` (oficial + alternativa) e `DISPAROS_TEST_PACKAGES` no billing. Mantido pacote teste 100 envios R$ 30. Ver `doc/LOG-2026-06-21__remove-faixa-teste-100-envios-5-reais.md`.

**WABA — Fix menus master vazios (HTML nesting):** painéis Disparos/Admin/Suporte estavam dentro de `#tab-disparos-lancamento` por `</div>` incorretos no hub de créditos; `setActiveTab` não exibia conteúdo. Corrigido fechamento de `disparos-pricing-lanes` e wrappers. Ver `doc/LOG-2026-06-21__fix-menus-master-html-nesting-disparos-lancamento.md`. Palavras-chave: `tab-disparos-lancamento`, `tab-hidden`, `setActiveTab`.

2026-07-02

**WABA — Aquecedor isolado por usuário:** motores independentes por e-mail (runtime-intent v3); start/stop/status escopados; fix walkup ↔ mozart. Marker `DEPLOY-2026-07-02-aquecedor-isolamento-por-usuario`. Ver `doc/LOG-2026-07-02__aquecedor-isolamento-por-usuario-fix.md`.

**WABA — Tarifador API Alternativa (tabela venda 2026):** 7 faixas (1k–30k envios, R$ 0,13–0,20); card «De R$ 0,13 a R$ 0,20»; mínimo R$ 200; validação checkout backend. Ver `doc/LOG-2026-07-02__tarifador-api-alternativa-tabela-venda-2026.md`.

**WABA — Tarifador API Oficial (tabela venda 2026):** 7 faixas (1k–30k envios, R$ 0,25–0,32); card «De R$ 0,25 a R$ 0,32»; mínimo R$ 320; validação checkout backend. Ver `doc/LOG-2026-07-02__tarifador-api-oficial-tabela-venda-2026.md`.

**WABA — Validação CONFIRMAR sem «Sim, já enviei»:** removido prompt Sim/Não e botão nudge; detecção só via webhook + worker no backend; UI entra direto em `verify-receive`. Marker `DEPLOY-2026-07-02-validacao-confirmar-backend-only`. Ver `doc/LOG-2026-07-02__validacao-confirmar-backend-only-sem-sim.md`.

**WABA — Evolution Redis / mensagens não indexadas:** pós 27/06 instâncias novas (`7943`, `final-6019`, `1321`) open com 0 msgs/0 chats; Redis Chatwoot removido ≠ Redis EVO; `walkup_evo-walkup-api-redis` desconectado (logs 30/06). Impacta CONFIRMAR, aquecedor, disparador. Ver `doc/LOG-2026-07-02__evo-redis-mensagens-nao-indexadas-fix.md`, script `scripts/probe-evo-message-indexing.cjs`.

**WABA — Validação CONFIRMAR só palavra (sem token WABA-):** keyword voltou a `CONFIRMAR`. Marker `DEPLOY-2026-07-01-validacao-confirmar-palavra-simples`. Ver `doc/LOG-2026-07-01__validacao-confirmar-palavra-simples.md`.

**WABA — Validação CONFIRMAR worker + webhook + estados + token:** worker 2s paralelo ao webhook; `confirmar-envio` só muda estado; bypass inbox vazio removido. Marker `DEPLOY-2026-07-01-validacao-worker-webhook-estados`. Ver `doc/LOG-2026-07-01__validacao-worker-webhook-estados-token.md`.

**WABA — Validação 2 níveis (A=conexão, B=CONFIRMAR opcional):** passo 3 após QR mostra «Concluir integração»; CONFIRMAR só se usuário escolher. Marker `DEPLOY-2026-07-01-validacao-nivel-a-conexao-opcional-confirmar`. Ver `doc/LOG-2026-07-01__validacao-nivel-a-conexao-confirmar-opcional.md`.

**WABA — Validação CONFIRMAR pull-only (sem webhook na recepção):** removido `ensureInstanceWebhook` e polling automático de recepção; só pull após «Sim, já enviei» (`confirmar-envio`); webhook validação no-op. Marker `DEPLOY-2026-07-01-validacao-confirmar-pull-only-sem-webhook`. Ver `doc/LOG-2026-07-01__validacao-confirmar-pull-only-sem-webhook.md`.

**WABA — Investigação CONFIRMAR lento 5181082477:** `digital-corban-2477`, 115 chats (~92% @lid); `findMessages` global com **0 CONFIRMAR** em 200 records; detecção depende webhook + `findChats.lastMessage`; UI soma 20s+120s; reconexão ghost-open. Ver `doc/LOG-2026-07-01__investigacao-validacao-5181082477-confirmar-lento.md`.

**WABA — Textos UI «na Evolution» → «no sistema WABA - Drax»:** alertas, modal validação, QR, push, health-check e erros API em `index.html` + `src/`.

**WABA — Modal wizard altura +20%:** `max-height` 640px → 768px.

**WABA — Validação CONFIRMAR modal Sim/Não (20s):** pergunta no passo 3 após 20s; Sim → `POST .../confirmar-envio` busca agressiva EVO; remove auto-conclusão sem validar. Marker `DEPLOY-2026-07-01-validacao-confirmar-modal-sim-nao`. Ver `doc/LOG-2026-07-01__validacao-confirmar-modal-sim-nao.md`.

**WABA — QRCode reconexão ghost open (5181082477):** `registrar-qrcode` bloqueava por `fetchInstances=open` com live `connecting`; alias `Final--2477` ≠ nome técnico `digital-corban-2477`. Marker `DEPLOY-2026-07-01-qrcode-reconnect-live-open-guard`. Ver `doc/LOG-2026-07-01__qrcode-reconnect-5181082477-ghost-open.md`.

**WABA — Validação CONFIRMAR instância nova 7943 / webhook:** `5182007943` sem histórico; webhook Evolution com `instance` objeto ignorado. Marker `DEPLOY-2026-07-01-validacao-confirmar-webhook-instance-obj`. Ver `doc/LOG-2026-07-01__validacao-confirmar-7943-webhook-instance-obj.md`.

**WABA — Validação CONFIRMAR @lid findChats (5181082477):** CONFIRMAR não aparece em findMessages global; detecção via `findChats.lastMessage`. Marker `DEPLOY-2026-07-01-validacao-confirmar-lid-findchats`. Ver `doc/LOG-2026-07-01__validacao-confirmar-lid-findchats-5181082477.md`.

**WABA — Validação CONFIRMAR detecção rápida:** fast path findMessages paralelo; findChats só em deep scan; poll 280ms backend / 300ms UI. Marker `DEPLOY-2026-07-01-validacao-confirmar-fast-detect`. Ver `doc/LOG-2026-07-01__validacao-confirmar-fast-detect.md`.

**WABA — Validação CONFIRMAR strict timestamp + UI passo 3:** falso positivo corrigido (só aceita CONFIRMAR com timestamp ≥ início da validação; removidos fallbacks loose); webhook estrito; poll normal não-agressivo; UI oculta banner duplicado na etapa "Resposta automática". Marker `DEPLOY-2026-07-01-validacao-confirmar-strict-timestamp`. Ver `doc/LOG-2026-07-01__validacao-confirmar-strict-timestamp-ui.md`.

**WABA — Validação CONFIRMAR receive-ok:** detecção records+120s; recepção OK libera mesmo se sendText falhar; botão「Já enviei CONFIRMAR」; **commit dist/** obrigatório + redeploy Easypanel. walkup/mozart 5197462102 webhook OK, QR pendente. Marker `DEPLOY-2026-07-01-validacao-confirmar-receive-ok`. Ver `doc/LOG-2026-07-01__validacao-confirmar-receive-ok-mozart-walkup.md`.

**WABA — Validação QR + connectionState fresh:** cache 4s + bypass no poll QR; waitFor open antes CONFIRMAR; findChats primeiro; sendText timeout libera se recepção OK. Marker `DEPLOY-2026-07-01-validacao-qr-fast-connectionstate`. Ver `doc/LOG-2026-07-01__validacao-qr-fast-connectionstate.md`.

**WABA — Desconectar todas instâncias EVO:** logout em massa falhou (HTTP 500 Connection Closed) em 6 instâncias; restart API não muda state. **Usuário deve reiniciar `evo-walkup-api` no Easypanel** antes de reconectar QR. Ver `doc/LOG-2026-07-01__desconectar-todas-instancias-evo-logout-falhou.md`.

**WABA — EVO connectionState truth + probe (NÃO commitado):** fetchOpen=7 liveOpen=0; instâncias ghost-open (connecting); probe send/receive bloqueado até reiniciar Evolution. Ver `doc/LOG-2026-06-30__evo-connectionstate-truth-probe.md`.

**WABA — Aquecedor sendText timeout (HTTP 0):** timeout 90s, retries resilientes, checagem connectionState antes do envio. Marker `DEPLOY-2026-06-30-aquecedor-evo-sendtext-timeout-fix`. Ver `doc/LOG-2026-06-30__aquecedor-evo-sendtext-timeout-fix.md`.

**WABA — Validação inbound detect + fallback EVO open:** loop agressivo findChats; rescan antes de expirar; terminal status não trava se EVO open; fallback 30s. Marker `DEPLOY-2026-06-30-validacao-inbound-detect-fallback`. Ver `doc/LOG-2026-06-30__validacao-inbound-detect-fallback.md`.

**WABA — Wizard passo 3 UX (2026-06-30):** banner EVO conectado, checklist visível, poll resiliente, fallback 45s e skip libera instância. Marker `DEPLOY-2026-06-30-wizard-step3-ux-connection-fallback`. Ver `doc/LOG-2026-06-30__wizard-step3-ux-connection-fallback.md`.

**WABA — Consolidar 5182006019 → mozart:** removida duplicata EVO `02-0916` (ex quantumivst); mantida `6841` open só em mozart.pmo@gmail.com. Ver `doc/LOG-2026-06-30__consolidar-5182006019-mozart.md`.

**WABA — Validação CONFIRMAR v3 (13959f5):** restaurado findChats + nudge=2 + UTF-8; UI passo 3 sem links; marker `DEPLOY-2026-06-21-validacao-inbound-confirmar-v3`. Ver `doc/LOG-2026-06-21__validacao-inbound-confirmar-v3-fix.md`.

**WABA — Validação passo 3 UI cleanup:** removidos links «Já enviei CONFIRMAR» e «Abrir conversa no WhatsApp». Ver `doc/LOG-2026-06-21__validacao-inbound-ui-cleanup.md`.

**WABA — Fix exclusão instância tombstone (7193069):** purge garantido; tombstone anti-órfã. Ver `doc/LOG-2026-06-21__exclusao-instancia-tombstone-fix.md`.

2026-06-30

**WABA — Validação passo 3 estilo + CONFIRMAR v2:** badge highlight; nudge=2 + findChats; fromMe fix. Marker `DEPLOY-2026-06-30-validacao-inbound-style-confirmar-v2`. Ver `doc/LOG-2026-06-30__validacao-inbound-style-confirmar-v2.md`.

**WABA — Validação CONFIRMAR detect + retry:** Marker `DEPLOY-2026-06-30-validacao-inbound-confirmar-detect-fix`.

**WABA — Validação inbound ownerJid wrapper:** telefone no objeto pai da Evolution. Marker `DEPLOY-2026-06-30-validacao-inbound-ownerjid-wrapper-fix`. Ver `doc/LOG-2026-06-30__validacao-inbound-ownerjid-wrapper-fix.md`.

**WABA — Validação inbound número no passo 3:** exibe número integrado (Evo + hint + lista instâncias). Marker `DEPLOY-2026-06-30-validacao-inbound-numero-display`. Ver `doc/LOG-2026-06-30__validacao-inbound-numero-display-fix.md`.

**WABA — Validação CONFIRMAR + deploy guard:** nudge findMessages; overlay não reload no wizard; poll 800ms. Marker `DEPLOY-2026-06-30-validacao-inbound-fast-nudge`. Ver `doc/LOG-2026-06-30__validacao-inbound-fast-nudge-reload-guard.md`.

**WABA — Wizard QR/conexão/CONFIRMAR rápido:** status-conexao 1s; QR fast path. Marker `DEPLOY-2026-06-30-wizard-qr-connect-validation-fast`. Ver `doc/LOG-2026-06-30__wizard-qr-connect-validation-fast.md`.

**WABA — QRCode count:0 + Prisma recovery:** Ver `doc/LOG-2026-06-30__qrcode-evo-count0-prisma-recovery.md`.

**WABA — QRCode async + modal align:** POST 202 job poll; prepare EVO otimizado; wizard texto à esquerda. Marker `DEPLOY-2026-06-30-qrcode-async-modal-align-fix`. Ver `doc/LOG-2026-06-30__qrcode-async-modal-align-fix.md`.

**WABA — Push comunidade waUploadToServer:** base64 primeiro; instância Evolution conectada; drax-oficial + walkup fallback. Marker `DEPLOY-2026-06-30-push-comunidade-media-base64-open-instance`. Ver `doc/LOG-2026-06-30__push-comunidade-waupload-base64-open-instance.md`.

**WABA — Push connection recovery:** POST 202 + entrega setImmediate; poll resiliente; recupera status do histórico; sem mensagem de falha de conexão. Marker `DEPLOY-2026-06-30-push-connection-recovery-fix`. Ver `doc/LOG-2026-06-30__push-connection-recovery-fix.md`.

**WABA — Push async + dedupe + comunidade texto primeiro:** POST 202 + poll; dedupe 90s com título; texto antes da imagem na comunidade; remove JID/contagem Evolution da UI. Ver `doc/LOG-2026-06-30__push-async-dedupe-comunidade-texto-primeiro.md`.

**WABA — Push comunidade Connection Closed:** URL interna 30180 primeiro; base64 só imagem pequena; fallback instâncias + texto. Marker `DEPLOY-2026-06-30-push-comunidade-connection-closed-fix`. Ver `doc/LOG-2026-06-30__push-comunidade-connection-closed-fix.md`.

**WABA — Push comunidade imagem TLS:** base64 até 5 MB + data URI + URL interna opcional; Evolution não depende de HTTPS público. Marker `DEPLOY-2026-06-30-push-comunidade-imagem-tls-base64`. Ver `doc/LOG-2026-06-30__push-comunidade-imagem-tls-base64-fix.md`.

**WABA — Deploy overlay watch poll:** polling 8s + baseline preservado; modal confiável com aba ociosa. Marker `DEPLOY-2026-06-30-deploy-overlay-watch-poll-fix`. Ver `doc/LOG-2026-06-30__deploy-overlay-watch-poll-fix.md`.

**WABA — Push comunidade imagem 401:** `/push/public-media` liberado sem auth; base64 primeiro no sendMedia. Marker `DEPLOY-2026-06-30-push-comunidade-imagem-401-fix`. Ver `doc/LOG-2026-06-30__push-comunidade-imagem-401-fix.md`.

**WABA — Push Failed to fetch:** timeout 180s + e-mail/comunidade paralelos + JID cache fast path. Ver `doc/LOG-2026-06-30__push-failed-to-fetch-timeout-fix.md`.

**WABA — Push comunidade instância 7770:** default admin `Drax Sistemas 5181077770`; migra 6973 legado. Ver `doc/LOG-2026-06-29__push-comunidade-instancia-7770-correcao.md`.

**WABA — Push comunidade 500 + e-mail dedupe:** fallback Evolution em erro 500/Prisma; lock + reserva antes do envio; UI deduplicated. Marker `DEPLOY-2026-06-29-push-comunidade-500-email-dedupe`. Ver `doc/LOG-2026-06-29__push-comunidade-500-email-dedupe-fix.md`.

**WABA — Transferência atendimento-6019 → walkup:** número `51982006019` / Evolution `555182006019`; dono era **mozart.pmo@gmail.com**; disco produção atualizado para **walkup@walkuptec.com.br**; **restart container Easypanel** necessário (cache ownership). Fix cache mtime + `forceInstanceOwnerTransfer` local. Ver `doc/LOG-2026-06-29__transferencia-atendimento-6019-walkup.md`.

**WABA — Push instância 5181076973 + probe:** corrige default errado 5181077770; descobre instância/grupo na Evolution. Ver `doc/LOG-2026-06-29__204500__push-comunidade-instancia-5181076973.md`.

**WABA — Push UI instância + parcial:** config comunidade resolve Evolution na aba; feedback sent/partial/error. Ver `doc/LOG-2026-06-29__201000__push-comunidade-ui-feedback-parcial.md`.

**WABA — Push comunidade Evolution auto-resolve:** quando `Drax Sistemas 5181077770` não existe, busca instância Drax na Evolution e persiste em `waba-push-config.json`. Ver `doc/LOG-2026-06-29__193000__push-comunidade-evo-instance-auto-resolve.md`.

**WABA — Push Enviar no 1º clique:** `pointerdown` + feedback inline; `initAdminPushUi()`. Ver `doc/LOG-2026-06-29__191000__push-enviar-primeiro-clique-fix.md`.

**WABA — Push sino + comunidade Drax 5181077770:** notificações no header; instância Evolution `Drax Sistemas 5181077770`. Ver `doc/LOG-2026-06-29__push-bell-comunidade-drax-instance.md`.

**WABA — Push fixes (duplicidade, alertas, imagem):** EVO um payload, e-mail por destino correto, alertas no login, dedupe 45s, upload imagem. Ver `doc/LOG-2026-06-29__150500__push-duplicidade-alertas-imagem.md`.

**WABA — Fix tela Push vazia:** painel não removia `tab-hidden` no switch de abas. Ver `doc/LOG-2026-06-29__143800__suporte-push-tela-vazia-fix.md`.

**WABA — Master Suporte Push:** menu Push com revisão IA (GPT), destinos Assinantes/Usuários/Comunidade/E-mail, alertas in-app e histórico. Módulo `src/push/`, rotas `/admin/push/*` e `/push/alerts`. Comunidade via instância `walkup`. Ver `doc/LOG-2026-06-29__142542__master-suporte-push-menu.md`.

**WABA — Coluna Mensagens (Instâncias) = aquecedor:** total enviadas + recebidas via `logs_envios` (EVO no ciclo aquecedor); não usa mais contador Evolution. Serviço `aquecedor-instance-message-stats.service.ts`. Ver `doc/LOG-2026-06-29__124611__instancias-mensagens-aquecedor.md`.

2026-06-27

**WABA — Card Números Aquecidos Visão Geral:** título sem ícone; 3 linhas (1/2/3 🔥 + quantidade por nível). Ver `doc/LOG-2026-06-27__aquecedor-card-numeros-aquecidos.md`.

**WABA — Monitor CPU refresh 60s (paridade Easypanel/Hostinger, 2026-06-27):** UI, header alert dot e coletor VPS alinhados a **60s/1min** (não tempo real). Env `WABA_VPS_CPU_UI_REFRESH_SEC`, `WABA_VPS_CPU_SAMPLE_INTERVAL_SEC`. Ver `doc/LOG-2026-06-27__monitor-cpu-refresh-60s-easypanel.md`.

**WABA — Monitor CPU cards + períodos (2026-06-27):** topo CPU/Mem/Disco coloridos; gráfico 1h/24h/all (default 1h); coletor mem+disk v3 (`/proc/stat`). Refresh era 10s, depois **60s**. Ver `doc/LOG-2026-06-27__monitor-cpu-cards-periodos-10s.md`.

**WABA — Monitor CPU master (Suporte):** gráfico CPU VPS, alerta sustentado, top containers, playbook SSH copiável; `GET /admin/infra/cpu/dashboard`; coletor `waba-infra-cpu-collector.timer`. Ver `doc/LOG-2026-06-27__monitor-cpu-master-ui.md`.

**WABA — Remoção Chatwoot + n8n VPS (2026-06-27):** `docker service rm` 4 chatwoot + `walkup_n8n`; WABA HTTPS 200; CPU aliviada. Ver `doc/LOG-2026-06-27__remocao-chatwoot-n8n-vps.md`.

**WABA — Traefik CPU produção (2026-06-27):** `ACCESSLOG/API_INSECURE/DASHBOARD` → false; `custom.yaml` criado; CPU 39,75%→~5%→0% pós-reload; HTTPS 200. Ver `doc/LOG-2026-06-27__traefik-cpu-accesslog-off-producao.md`.

**WABA — Estudo CPU Traefik (access log / dashboard):** audit `scripts/infra/traefik-config-audit.sh`; plano `doc/TRAEFIK-CPU-OTIMIZACAO-ESTUDO.md`. Easypanel usa `custom.yaml`, não docker-compose do repo; ganho drástico = migrar Chatwoot/n8n.

**WABA — Agente Infra Cursor + monitor VPS:** skill `waba-infrastructure-specialist`, scripts `scripts/infra/` (audit, CPU, timer 15min), docs `doc/INFRA-AGENT-WABA.md`, `AGENTS.md`. CPU Hostinger jun/2026: carga real multi-app, não fantasma; prune+restart OK. Ver `doc/LOG-2026-06-27__infra-agent-cursor-monitor-vps.md`.

Palavras-chave: `infra-agent`, `waba-infrastructure-specialist`, `vps-cpu-report`, `waba-infra-audit`, `srv1261237`, `Hostinger CPU`

**WABA — Hex cluster linhas de luz:** órbitas elípticas SVG verde→azul envolvendo arte Contratar (estilo atômico). Ver `doc/LOG-2026-06-21__hex-cluster-linhas-luz-verde-azul.md`.

**WABA — Modais conteúdo centralizado:** títulos, textos e ações centralizados em `.confirm-overlay`; forms/tabelas mantêm leitura à esquerda. Ver `doc/LOG-2026-06-21__modais-conteudo-centralizado.md`.

**WABA — Seleção números campanha Alternativa:** etapa 1 não restaura instâncias do config salvo; seleção manual a cada configuração. Ver `doc/LOG-2026-06-21__disparos-selecao-numeros-nao-restaurar-config.md`.

**WABA — Deploy resilience + sessão pós-reload:** overlay aguarda `serverBootId`/marker novo, reload automático, auth gate com retry; `/auth/session` no shutdown. Ver `doc/LOG-2026-06-21__deploy-resilience-session-estabilidade-fix.md`.

**WABA — Alerta aquecimento incompleto (Seleção números):** modal Continuar/Reconfigurar se warmthLevel &lt; 3. Ver `doc/LOG-2026-06-21__disparos-alerta-aquecimento-incompleto.md`.

**WABA — Campanhas lista por API (Alternativa/Oficial):** cache isolado por escopo; skeleton ao trocar aba; sem listagem cruzada. Ver `doc/LOG-2026-06-21__campanhas-lista-scope-api-alternativa-oficial-fix.md`.

**WABA — Campanha API Alternativa (Gerar Campanha):** mapeamento inline sem modal; campanha só no botão da etapa «Gerar Campanha». Ver `doc/LOG-2026-06-21__campanha-evo-gerar-campanha-inline-map.md`.

**WABA — Encurtador URL destino WhatsApp ou URL custom:** abas na etapa 5; link único por envio (nonce); backend `linkDestinationMode` + `responseUrl`; modo base de mensagens também encurta. Ver `doc/LOG-2026-06-21__disparos-encurtador-link-destino-url-whatsapp.md`.

**WABA — Projeção API Alternativa (throughput):** término por horas no expediente; texto capacidade + previsão; max(instâncias selecionadas, ativadas). Ver `doc/LOG-2026-06-21__alternativa-projecao-throughput-fix.md`.

**WABA — API Alternativa Salvar config 1 clique (definitivo):** pointerdown delegado, commit picker, guards reload wizard, tabindex picker. Ver `doc/LOG-2026-06-21__disparos-salvar-config-pointerdown-definitivo.md`.

**WABA — SW shell cache V01 em produção (fix):** cache SW não alias `/version-01` → `/`; header `X-Waba-Shell-Cache-Key`; UI profile síncrono no body. Ver `doc/LOG-2026-06-21__sw-shell-cache-v01-menus-producao-fix.md`.

**WABA — Overlay deploy local (flag servidor):** modal antigo no dev por `dist/` desatualizado + hostname-only; flag `WABA_DEPLOY_RESILIENCE_ENABLED` injetada pelo servidor; ts-node serve `index.html` raiz; purge SW local. Ver `doc/LOG-2026-06-21__deploy-overlay-local-flag-servidor.md`.

**WABA — Campanha EVO fluxo preview/mapear/quantidade:** ordem correta, Salvar configurações separado, projeção término com ⏱. Ver `doc/LOG-2026-06-21__campanha-evo-fluxo-preview-mapear-quantidade.md`.

**WABA — Aquecedor Salvar config 1 clique (v2):** remove gate editMode, mousedown no botão, merge lote expediente pendente, skip reload ao editar. Ver `doc/LOG-2026-06-21__aquecedor-salvar-config-um-clique-fix-v2.md`.

**WABA — Disparos Dashboard loading (cache + skeleton):** sem tela vazia; cache 30min, prefetch no login, skeleton estruturado. Ver `doc/LOG-2026-06-21__disparos-dashboard-loading-cache-skeleton.md`.

**WABA — Overlay deploy simplificado:** só círculo + barra; textos fixos com linha accent cyan. Ver `doc/LOG-2026-06-21__deploy-overlay-simplificacao-textos.md`.

**WABA — Aquecedor UI hero/progress deduplicação:** hero mostra só último envio ou retorno do expediente (data/hora uma vez); barra mostra countdown ou "Aguardando próximo expediente." Ver `doc/LOG-2026-06-21__aquecedor-ui-hero-progress-deduplicacao.md`.

**WABA — Overlay deploy (3 probes / 2s):** poll `/health`+`/ready` a cada 2s; 3 verificações estáveis; fecha após 500ms "Sistema normalizado". Marker `DEPLOY-2026-06-21-deploy-overlay-3probes-aquecedor-equidade-v2`. Ver `doc/LOG-2026-06-21__deploy-overlay-estabilizacao-ui.md`.

**WABA — Aquecedor equidade ciclo v2:** score por menor uso (aresta/origem/destino), filtro saturação de par >50%, owesPairReply só desempate. Ver `doc/LOG-2026-06-21__aquecedor-equidade-ciclo-v2.md`.

**WABA — Auto-update sem refresh de UI:** timer 15s usa `carregar({ silent: true })`; cache em background sem re-render de forms/listas. Marker `DEPLOY-2026-06-21-auto-update-sem-refresh-ui`. Ver `doc/LOG-2026-06-21__auto-update-sem-refresh-ui.md`.

**WABA — Fix gerar mensagem teste (IA) API Alternativa:** timeout 90s, hints encurtador no backend, fallback wa.me, validação WhatsApp, erros explícitos. Marker `DEPLOY-2026-06-21-disparos-gerar-mensagem-ai-fix`. Ver `doc/LOG-2026-06-21__disparos-gerar-mensagem-ai-fix.md`.

**WABA — Salvar config Disparador 1 clique:** fix blur/click no botão; pausa auto-refresh em disparos/disparo-evo. Marker `DEPLOY-2026-06-26-disparos-salvar-config-primeiro-clique`. Ver `doc/LOG-2026-06-26__disparos-salvar-config-primeiro-clique.md`.

**WABA — Encurtador URL pública (sem localhost):** fallback `WABA_PUBLIC_BASE_URL` + host do proxy; `/health` → `shortPublicBase`. Marker `DEPLOY-2026-06-26-shortener-url-publica-producao`. Ver `doc/LOG-2026-06-26__shortener-url-publica-producao.md`.

**WABA — Relatório operacional inputs editáveis:** formulário destacado, sem duplicar métricas no preview, reset ao fechar modal, foco automático. Marker `DEPLOY-2026-06-26-operacional-relatorio-inputs-editaveis`. Ver `doc/LOG-2026-06-26__operacional-relatorio-inputs-editaveis.md`.

**WABA — Preflight campanha não bloqueia envio:** retry em `/health`; só bloqueia se backend desatualizado ou shutdown/manutenção; falha transitória segue para POST intake. Marker `DEPLOY-2026-06-26-campanha-intake-preflight-resilience`. Ver `doc/LOG-2026-06-26__campanha-intake-preflight-resilience.md`.

**WABA — Overlay deploy só produção:** resiliência de deploy desativada em localhost/IP privado; overlay só com 502/503/504 ou `shuttingDown` em `*.draxsistemas.com.br`. Marker `DEPLOY-2026-06-26-deploy-overlay-somente-producao`. Ver `doc/LOG-2026-06-26__deploy-overlay-somente-producao.md`.

**WABA — E-mail operacional await + auditoria:** notify síncrono no intake, `operacionalNotifyAudit`, reenvio admin, toast no wizard; marker `DEPLOY-2026-06-26-operacional-email-await-audit`. Campanha Oficial → operacional Oficial (V02: digitalcorban, não somaconecta). Ver `doc/LOG-2026-06-26__operacional-email-await-audit-reenvio.md`.

**WABA — Deploy sem Bad Gateway (UX):** service worker cache da shell, overlay “atualizando sistema”, graceful shutdown SIGTERM + gate 503. Marker `DEPLOY-2026-06-26-deploy-zero-downtime-ux`. Ver `doc/LOG-2026-06-26__deploy-zero-downtime-ux.md`.

**WABA — E-mail operacional não enviado (somaconecta):** produção com marker antigo (sem código de notify); e-mail só vai ao operacional do plano (`operacionalDispatchesApi`). V02: Oficial=digitalcorban, Alternativa=somaconecta. Health `mailConfigured` + logs de skipped. Marker `DEPLOY-2026-06-26-operacional-email-notify-fix`. Ver `doc/LOG-2026-06-26__operacional-email-nao-enviado-diagnostico-fix.md`.

**WABA — Campanha intake resilience v2:** skip `express.json`/`urlencoded` no POST intake; health `campaignIntakeSafeParser` + `campaignIntakeApiVersion`; wizard com preflight `/health`, retry FormData reconstruído, timeout dinâmico e validação obrigatória de todos os inputs. Marker `DEPLOY-2026-06-26-campanha-intake-resilience-v2`. **Redeploy Node obrigatório** no Easypanel. Ver `doc/LOG-2026-06-21__campanha-intake-resilience-v2-fix.md`.

**WABA — Aquecedor equidade no ciclo:** score por send/receive count; fim do pool exclusivo owesPairReply; marker `DEPLOY-2026-06-26-aquecedor-equidade-ciclo-pares`. Ver `doc/LOG-2026-06-26__aquecedor-equidade-ciclo-pares.md`.

**WABA — E-mail operacional nova campanha:** ao gerar intake, notifica operacional do plano (Oficial/Alternativa) com prazo 24h; marker `DEPLOY-2026-06-26-operacional-email-nova-campanha`. Ver `doc/LOG-2026-06-26__operacional-email-nova-campanha.md`.

**WABA — Fix criar campanha API Oficial (502/conexão):** skip `express.json` sempre no intake; retry no wizard + pausa polling; marker `DEPLOY-2026-06-26-campanha-intake-body-parser-skip`. Ver `doc/LOG-2026-06-26__campanha-oficial-intake-502-retry.md`.

**WABA — Chrome salvar senha aleatória:** guards autocomplete + login inert após auth; marker `DEPLOY-2026-06-26-browser-password-manager-guards`. Ver `doc/LOG-2026-06-26__browser-password-manager-random-save.md`.

**WABA — Admin Campanhas Confirmar erro reportado:** feedback inline no modal + payload.ok + backend 400/500; marker `DEPLOY-2026-06-26-admin-campanhas-reportar-erro-fix`. Ver `doc/LOG-2026-06-26__admin-campanhas-reportar-erro-sem-acao.md`.

**WABA — Admin Campanhas espaçamento API labels:** ícone colado ao texto no hint master (gap 2px, join sem espaços extras); marker `DEPLOY-2026-06-26-admin-campanhas-api-label-spacing`. Ver `doc/LOG-2026-06-26__admin-campanhas-api-label-spacing.md`.

**WABA — Lista campanhas altura (fix):** max-height alinhada ao bloco `.disparos-resumo-grid` (cards saldo/resumo); marker `DEPLOY-2026-06-25-disparos-campanhas-list-height-resumo-grid`. Ver `doc/LOG-2026-06-25__disparos-campanhas-lista-altura-dinamica.md`.

**WABA — Dashboard Aquecedor cache rápido:** localStorage (30 min) + cache TTL 45s no backend `/dados`; hidratação no login e render imediato; marker `DEPLOY-2026-06-25-aquecedor-dashboard-dados-cache`. Ver `doc/LOG-2026-06-25__aquecedor-dashboard-dados-cache.md`.

**WABA — Lista campanhas altura dinâmica:** igual ao card Resumo (Oficial + Alternativa); marker `DEPLOY-2026-06-25-disparos-campanhas-list-height-sync`. Ver `doc/LOG-2026-06-25__disparos-campanhas-lista-altura-dinamica.md`.

**WABA — Ocultar Log diagnóstico API Alternativa (prod):** CSS só baseline; marker `DEPLOY-2026-06-25-hide-disparos-diagnostico-producao`. Ver `doc/LOG-2026-06-25__hide-disparos-diagnostico-api-alternativa-producao.md`.

**WABA — Aquecedor logs de comando (histórico 30):** persistência `aquecedor-command-log.json`, GET/POST `/aquecedor/command-logs`, fallback envios; marker `DEPLOY-2026-06-25-aquecedor-command-log-history`. Ver `doc/LOG-2026-06-25__aquecedor-command-log-historico-30.md`.

**WABA — Operacional Confirmar início campanha:** retry + erro inline no modal; botão renomeado; marker `DEPLOY-2026-06-25-operacional-campanha-iniciar-fix`. Ver `doc/LOG-2026-06-25__operacional-campanha-iniciar-sem-acao.md`.

**WABA — Login assinante (Failed to fetch):** retry + mensagem amigável no frontend; try/catch em `POST /auth/login`; marker `DEPLOY-2026-06-25-login-resilience-retry`. Ver `doc/LOG-2026-06-25__login-resilience-retry-failed-to-fetch.md`.

**WABA — Aquecedor 4 instâncias / 2 no ciclo:** lifecycle unificado por alias; UI e status mostram preparação; marker `DEPLOY-2026-06-25-aquecedor-lifecycle-alias-cycle-fix`. Ver `doc/LOG-2026-06-25__aquecedor-4-instancias-2-ciclo-alias-fix.md`.

**WABA — Master walkup V02 → produção:** script + API `POST /admin/master/promote-from-v02`; escopo só walkup@walkuptec.com.br. Ver `doc/LOG-2026-06-25__master-walkup-v02-to-producao.md`.

**WABA — Lista campanhas geradas (resiliência):** retry + cache na falha + escrita atômica intakes. Marker `DEPLOY-2026-06-25-disparos-campanhas-list-resilience`. Ver `doc/LOG-2026-06-25__disparos-campanhas-list-resilience.md`.

**WABA — Fix Gerar Campanha multipart (causa raiz):** `express.json` não consome mais body de `POST /disparos/campanhas/intake`; marker `DEPLOY-2026-06-25-campanha-intake-multipart-parser-fix`. Ver `doc/LOG-2026-06-25__campanha-intake-multipart-parser-fix.md`.

**WABA — Aquecedor escopo e conexão:** só instâncias live conectadas no ciclo; envios filtrados por dono. Ver `doc/LOG-2026-06-25__aquecedor-scope-connected-owner-fix.md`.

**WABA — Fix Gerar Campanha (Failed to fetch):** intake multipart com erros tratados + URL base path. Ver `doc/LOG-2026-06-25__fix-campanha-intake-failed-to-fetch.md`.

**WABA — Créditos Contratar largura total:** seção Contratar ocupa 100% da página; hex e cards mantêm tamanho. Ver `doc/LOG-2026-06-25__creditos-contratar-largura-total.md`.

**WABA — Wizard Nova campanha (API Oficial):** removido seletor "Plano de envio" no passo Leads; campanha sempre `apiKind: oficial`. Ver `doc/LOG-2026-06-25__dis-wizard-sem-plano-envio-api-oficial.md`.

**WABA — Envio teste Aquecedor:** envia mensagem entre 2 instâncias ativas; motor visível sem depender do teste. Ver `doc/LOG-2026-06-25__aquecedor-envio-teste-funcional.md`.

**WABA — Botão Aquecedor 3 fases:** Iniciar (verde), Aguarde Iniciar (azul, disabled), Pausar (vermelho); ícone foguinho à frente. Ver `doc/LOG-2026-06-25__hex-tamanho-aquecedor-botao-3-fases.md`.

**WABA — Hex Créditos tamanho:** restaurado max-width 500/593px mantendo lanes amplas.

**WABA — Faixa Créditos (conta corrente):** menu Créditos exibe "Sua conta corrente" + "Compre seus créditos" na `integration-env-strip`. Ver `doc/LOG-2026-06-25__125835__creditos-strip-conta-corrente.md`.

**WABA — Créditos Contratar (lanes):** fontes maiores, label API+ícone no card de compra, coluna direita mais larga e próxima dos hexágonos. Ver `doc/LOG-2026-06-25__125425__creditos-lanes-fonte-api-label-largura.md`.

**WABA — Aquecedor limite diário 70:** semana 1 = 70 msgs/instância/dia; +40%/semana; teto 150 na semana 4. Ver `doc/LOG-2026-06-25__aquecedor-limite-diario-70-ramp.md`.

**WABA — Aquecedor sem envio no expediente:** rotação entre instâncias + timezone janela. Ver `doc/LOG-2026-06-25__aquecedor-limite-diario-sem-envio-dia.md`.

**WABA — Preservação dados produção:** scripts backup/verify + `production-data-persistence.service`. Ver `doc/LOG-2026-06-24__preservacao-dados-deploy-producao.md`.

2026-06-21

**WABA — Aquecedor start duplo clique:** pin UI + persist antes do motor; status com worker lease. Marker `DEPLOY-2026-06-24-aquecedor-start-double-click-fix`. Ver `doc/LOG-2026-06-24__aquecedor-start-duplo-clique-fix.md`.

**WABA — Créditos hub compra no topo:** saldo na aba Histórico; Contratar só cards API. Ver `doc/LOG-2026-06-24__creditos-hub-compra-topo-historico-saldo.md`.

**WABA — Aquecedor envio atrasado (status poll):** poll 3s não reverte mais runtime; scheduler 5–30s; fila PROCESSANDO liberada. Marker `DEPLOY-2026-06-24-aquecedor-cycle-scheduler-fix`. Ver `doc/LOG-2026-06-24__aquecedor-envio-atrasado-status-poll-fix.md`.

**WABA — Comparativo campanhas com data:** data de criação abaixo do nome no gráfico do dashboard Disparos. Ver `doc/LOG-2026-06-24__disparos-dashboard-compare-data-criacao.md`.

**WABA — Aquecedor paywall falso em deploy:** entitlement resiliente (sessionStorage + créditos + não bloquear durante loading); backend libera por saldo de créditos. Marker `DEPLOY-2026-06-24-aquecedor-entitlement-resilience`. Ver `doc/LOG-2026-06-24__aquecedor-paywall-falso-entitlement-resilience.md`.

**WABA — Preservação dados no deploy:** volume `/app/data`, health `dataPersistence`, backup script, FTP não envia `data/`. Ver `doc/deploy-preservacao-dados-producao.md`.

**WABA — Login Mozart produção:** conta só no V02; promote pendente no Easypanel. Ver `doc/LOG-2026-06-24__mozart-login-producao-assinante-nao-migrado.md`.

**WABA — Produção foguinhos (dist publicado):** causa: `dist/` não estava no Git; Easypanel servia build 22/06. Marker `DEPLOY-2026-06-24-instancias-foguinhos-producao-dist`. Ver `doc/LOG-2026-06-24__producao-foguinhos-dist-nao-publicado.md`.

**WABA — Fix ordem coluna Quente:** primeira coluna da tabela Instâncias (antes do avatar). Marker `DEPLOY-2026-06-24-instancias-quente-coluna-ordem`. Ver `doc/LOG-2026-06-24__instancias-quente-coluna-ordem-fix.md`.

**WABA — Foguinhos aquecimento em produção:** coluna Quente (Instâncias), picker Disparos com filtro 1–3🔥, API `warmthLevel`/`warmthLabel` em `/instancias/uso-config`. Marker `DEPLOY-2026-06-24-instancias-foguinhos-aquecimento`. Ver `doc/LOG-2026-06-24__instancias-foguinhos-aquecimento-producao.md`.

**WABA — Produção assinantes (sem compra números Alternativa):** flag `WABA_ALTERNATIVA_NUMBERS_PURCHASE_ENABLED` (padrão false); mantém foguinhos, motor e débito 1/envio Alternativa. Ver `doc/LOG-2026-06-23__producao-assinantes-sem-compra-numeros-alternativa.md`.

**WABA — Mozart V02 → assinante produção:** script `promote-subscriber-v02-to-production.cjs` + `POST /admin/subscribers/promote-from-v02`. Ver `doc/LOG-2026-06-24__mozart-promote-v02-assinante-producao.md`.

**WABA — Restart V02 Mozart (dados preservados):** `dev-v02.ps1` na porta 3012; backup `data/v02/_backup-mozart-20260624-100039/`. Ver `doc/LOG-2026-06-24__restart-v02-mozart-dados-preservados.md`.

2026-06-22

**WABA — Mozart 3 números Alternativa (V02):** pedido paid `waba-alternativa-numbers` shipmentCount=3. Ver `doc/LOG-2026-06-22__mozart-compra-3-numeros-alternativa-v02.md`.

**WABA — Preparando intervalo 6h (era 12h):** `AQUECEDOR_STAGGER_PROMOTE_MS` e fila de promoção. Ver `doc/LOG-2026-06-22__aquecedor-preparando-6h-interval.md`.

**WABA — QRCode produção logout/restart EVO:** prepare session antes do connect; timeouts ajustados; UI 120s. Ver `doc/LOG-2026-06-22__qrcode-producao-evo-logout-prepare.md`.

**WABA — Filtro Preparando na aba Instâncias:** chip para listar só números em preparação do aquecedor. Ver `doc/LOG-2026-06-22__instancias-filtro-preparando.md`.

**WABA — Preparando: fix grandfather instância 5182008906:** `atendimento-906` integrada 22/06 ~14:50 BRT ficava "conectado" por grandfather indevido; cutoff 22/06 + `preparingSince` do EVO cache. Ver `doc/LOG-2026-06-22__aquecedor-preparando-grandfather-fix.md`.

**WABA — Validação inbound: uma resposta por integração:** corrige 6 mensagens `WABA-VAL` no mesmo CONFIRMAR (loops órfãos + dedupe por conversa). Marker `DEPLOY-2026-06-22-validacao-inbound-reply-dedupe`. Ver `doc/LOG-2026-06-22__validacao-inbound-reply-dedupe.md`.

**WABA — Aquecedor: remoção do teste mesh inicial:** validação N×(N−1) no start removida (causava restrição WhatsApp em contas novas). Ciclo normal + lifecycle (Preparando, 6h, limites) mantidos. Marker `DEPLOY-2026-06-22-aquecedor-remove-mesh-test`. Ver `doc/LOG-2026-06-22__aquecedor-remove-mesh-test.md`.

**WABA — Aquecedor modo seguro (lifecycle):** pausa automática 6h por restrição; fila Preparando + liberação 12h; intervalo 5–15 min; limite 8–16 msgs/dia semana 1 com ramp-up. Marker `DEPLOY-2026-06-22-aquecedor-safe-lifecycle`. Ver `doc/LOG-2026-06-22__aquecedor-safe-lifecycle.md`.

**WABA — Fix walkup no disparador (useDisparador OFF):** auto-replenish respeita toggles Disparador/Fazenda. Ver `doc/LOG-2026-06-23__fix-walkup-disparador-elegibilidade-use-disparador.md`.

**WABA — Sync E→D escritório:** `robocopy` espelhou `E:\Waba` → `D:\Waba`; operar a partir de `D:\Waba`. Ver `doc/LOG-2026-06-22__sync-e-para-d-escritorio.md`.

2026-06-21

**WABA — Aquecedor mesh webhook verify v3:** confirmação via MESSAGES_UPSERT + findMessages global + envio multi-formato; service dedicado. Marker `DEPLOY-2026-06-21-aquecedor-mesh-webhook-verify-v3`. Ver `doc/LOG-2026-06-21__aquecedor-mesh-webhook-verify-v3.md`.

**WABA — Aquecedor mesh EVO digits + escala hub-spoke:** corrige normalização BR errada nos números da EVO (`resolveAquecedorInstanceDigits`); mesh hub-spoke a partir de 7 instâncias; verify bootstrap mais rápido; ETA na UI/API. Marker `DEPLOY-2026-06-21-aquecedor-mesh-evo-digits-scale`. Ver `doc/LOG-2026-06-21__aquecedor-mesh-evo-digits-scale.md`.

**WABA — Aquecedor mesh fail UI vermelho + msg simples:** card/barra vermelhos no teste falho; mensagem amigável ao usuário; detalhe técnico nos logs. Marker `DEPLOY-2026-06-21-aquecedor-mesh-fail-ui-red`.

**WABA — Aquecedor mesh send/verify fases:** envio sequencial por origem, verify em lote + retry; refresh números EVO live. Marker `DEPLOY-2026-06-21-aquecedor-mesh-send-verify-phases`.

**WABA — Aquecedor mesh bootstrap no start:** ao iniciar, N×(N−1) envios paralelos + findMessages; ciclo só após `passed`. Marker `DEPLOY-2026-06-21-aquecedor-mesh-bootstrap-start`. Ver `doc/LOG-2026-06-21__aquecedor-mesh-bootstrap-start.md`.

**WABA — Aquecedor delivery verify v2 (walkup HTTP 201):** findMessages com alias EVO, timestamp, fromMe, 12×3s; detecta mensagem só na origem. Marker `DEPLOY-2026-06-21-aquecedor-delivery-verify-v2`. Ver `doc/LOG-2026-06-21__aquecedor-delivery-verify-walkup-v2.md`.

**WABA — Aquecedor fila multi-instância (5 no ciclo, só 2 conversando):** state machine por par (`pendingReplyFrom` idle após A→B + B→A); `outboundSinceInbound` global; fairness no score. Marker `DEPLOY-2026-06-21-aquecedor-fila-multi-instancia`. Ver `doc/LOG-2026-06-21__aquecedor-fila-multi-instancia-fix.md`.

2026-06-20

**WABA — UI remover painel Envio automático (API Alternativa):** seção `#dis-alternativa-auto-rules` removida de `index.html` e `dist/index.html`; JS de exibição limpo. Ver `doc/LOG-2026-06-20__remove-alternativa-auto-rules-panel.md`.

**WABA — V02 merge master (aquecedor):** branch `v02` sincronizada com `master` (`9e64f14`); deploy serviço `waba_disparador_v02`. Marker `DEPLOY-2026-06-20-aquecedor-reply-turn-sync`. Ver `doc/LOG-2026-06-20__v02-merge-master-aquecedor-reply-turn.md`.

**WABA — API Alternativa layout (campanhas | créditos | config):** tela `disparo-evo` alinhada à API Oficial — campanhas à esquerda, painel Resumo/Saldos à direita (mesmo comportamento de créditos/polling), config legacy embaixo. Ver `doc/LOG-2026-06-20__api-alternativa-layout-resumo-creditos.md`.

**WABA — Aquecedor conversa bilateral + auto-instâncias:** turn manager prioriza resposta obrigatória (Soma→Drax após Drax→Soma); `owesPairReply` libera envio mesmo com bloqueio global; eventos aquecedor com match flexível de número; novas instâncias registradas entram no ciclo (`ensureAquecedorInstanceRegistered` + `syncAquecedorConnectedInstances`); probe inbound não desliga mais aquecedor. Marker `DEPLOY-2026-06-20-aquecedor-reply-turn-sync`. Ver `doc/LOG-2026-06-20__aquecedor-reply-turn-auto-instances.md`.

**WABA — menus Disparos assinantes (V02 todos ambientes):** Dashboard, Créditos, API Alternativa, API Oficial sempre visíveis para assinantes; baseline incluído. Ver `doc/LOG-2026-06-20__subscriber-disparos-menus-v02-all-envs.md`.

**WABA — V02 Atualizar QRCode não gera:** refresh usava timeout 12s + endpoint fraco; agora `registrar-qrcode` + 90s + fallback multi-URL EVO. Ver `doc/LOG-2026-06-20__v02-qrcode-refresh-not-generating-fix.md`.

**WABA — V02 avatar WhatsApp corrompido:** proxy `/instancias/avatar` devolve SVG placeholder (200) em falha; frontend sanitiza URL e fallback ◎; cache local grava payload sanitizado. Build + restart V02. Ver `doc/LOG-2026-06-20__v02-whatsapp-avatar-corrupted-fix.md`.

**WABA — Traefik bootstrap v3 (auto-fix proxy zumbi :80):** `traefik-easypanel-bootstrap-vps.sh` + timer 2 min; integrado all-vps v3, WABA v6, EVO v3, guard, typebot permanent. Ver `doc/FIX-TRAEFIK-DEFINITIVO.md`.

**WABA — Traefik Easypanel DOWN (2026-06-20):** scripts v1 só corrigiam **502/router** com Traefik running; proxy morto (`curl 7`, :443 vazio) ficava fora. v2 `traefik-permanent-all-2026-06-20-v2` tenta `force easypanel-traefik` + publish 30180. Caso srv1261237: `waba_disparador` 1/1 mas Traefik/30180 ausentes. Ver `doc/FIX-TRAEFIK-DEFINITIVO.md`, `doc/LOG-2026-06-20__traefik-down-waba-443.md`.

**WABA — Docker prebuilt dist (deploy Easypanel):** Dockerfile **sem tsc no VPS** — copia `dist/` do Git; só `npm ci --omit=dev`. Marker `DEPLOY-2026-06-20-docker-prebuilt-dist`. Antes do push: `npm run build`. Ver `doc/LOG-2026-06-20__docker-prebuilt-dist-no-tsc-vps.md`.

**WABA — Easypanel build travado (processando infinito):** Dockerfile otimizado — um `npm ci`, `npm prune`, echo nos steps, `NODE_OPTIONS` no tsc; `.dockerignore` exclui doc/CSVs (~14 MB). Marker `DEPLOY-2026-06-20-docker-build-fast`. VPS: `docker builder prune -af`. Ver `doc/FIX-EASYPANEL-DOCKER-BUILD-HANG.md`.

**WABA — simulação compra números Alternativa (V02):** `simulatePaidPurchase` + rota `POST /billing/alternativa-numbers/simulate-purchase` (só V02/dev); saldo por `ownerEmail`. Walkup: 30 slots simulados. Ver `doc/LOG-2026-06-20__simulate-walkup-30-alternativa-numbers.md`.

**WABA — V02 modal PIX compra números:** roteamento checkout corrigido (`alternativa-numbers` vs créditos R$300); validação celular; cancel/estado limpos. Ver `doc/LOG-2026-06-19__fix-alternativa-numbers-pix-modal.md`.

**WABA — V02 página não carregava (JS):** ao inserir fluxo "Comprar números" em `index.html`, a declaração `function formatDisparosQty` foi removida acidentalmente — `return` solto causava `Unexpected token 'function'`. Corrigido em `index.html` e `dist/index.html`. Ver `doc/LOG-2026-06-19__v02-page-load-js-syntax-fix.md`.

**WABA — fix QRCode Aquecedor (EVO timeout):** timeout 45s + retry na Evolution; `registrar-qrcode` estável. Ver `doc/LOG-2026-06-19__fix-aquecedor-qrcode-evo-timeout.md`.

**WABA — V02 abas superiores navegação:** Aquecedor → `aquecedor`; API Oficial → `disparos`; API Alternativa → `disparo-evo`. Ver `doc/LOG-2026-06-19__v02-top-tabs-navigation-fix.md`.

**WABA — aquecedor turn manager (fila):** gerenciador global de turnos — instância só reenvia após receber; par A↔B alterna remetente; prioriza quem deve responder. Marker `DEPLOY-2026-06-19-aquecedor-turn-manager-fila`. Ver `doc/LOG-2026-06-19__aquecedor-turn-manager-fila.md`.

**WABA — V02 Disparo EVO (V01):** menu Disparo + aba API Alternativa abrem tela EVO (instâncias/config/campanhas). Ver `doc/LOG-2026-06-19__v02-disparo-evo-v01-screen.md`.

**WABA — V02 UI topo + Créditos:** produção com 3 abas (Aquecedor / API Oficial / API Alternativa); menu lateral Disparos → Créditos (carrinho). Ver `doc/LOG-2026-06-19__v02-top-tabs-creditos-menu.md`.

**WABA — V01 tela preta:** corrigido `??` corrompido em `loadDisparosEvoCampaigns` (`index.html` + `dist/index.html`); JS parse OK. Ver `doc/LOG-2026-06-19__v01-tela-preta-js-syntax-fix.md`.

**WABA — V01 baseline pré-08/06:** UI `baseline` — API não oficial (Aquecedor + Disparos EVO) + API Meta (Disparo oficial); oculto fluxo comercial Disparos/Campanhas SaaS. Ver `doc/LOG-2026-06-19__v01-baseline-pre-disparador-comercial.md`.

**WABA — V01 Disparador EVO reativado:** tick campanhas ligado (`WABA_EVO_DISPARADOR=true`); UI full; backup 4 campanhas em `data/v01/`. Ver `doc/LOG-2026-06-19__v01-evo-disparador-reativado.md`.

**WABA — V01 master local:** `walkup@walkuptec.com.br` como master em `data/v01/waba-system-users.json` + `.env.v01`; login HTTP 200 role master confirmado.

**WABA — aquecedor salvar config feedback:** mensagem inline ao salvar; motor visível ao editar. Marker `DEPLOY-2026-06-19-aquecedor-salvar-config-feedback`. Ver `doc/LOG-2026-06-19__aquecedor-salvar-config-feedback.md`.

**WABA — aquecedor persiste após refresh:** UI retoma motor + auto-start se runtime-intent ligado. Marker `DEPLOY-2026-06-19-aquecedor-persiste-apos-refresh`. Ver `doc/LOG-2026-06-19__aquecedor-persiste-apos-refresh.md`.

**WABA — aquecedor envios sem flicker:** API /aquecedor/envios sem EVO; UI mantém última lista em falha. Marker `DEPLOY-2026-06-19-aquecedor-envios-sem-flicker`. Ver `doc/LOG-2026-06-19__aquecedor-envios-sem-flicker.md`.

**WABA — aquecedor Supabase retry:** retry 3x + reset cliente em `fetch failed`; mensagem amigável e backoff 60s. Marker `DEPLOY-2026-06-19-aquecedor-supabase-retry`. Ver `doc/LOG-2026-06-19__aquecedor-supabase-retry.md`.

**WABA — aquecedor fila vazia (produção):** corrige `ensureAquecedorPendingMessage` — promove PENDENTE preso, loga erro de insert, semente no ciclo e reabastece após envio. Marker `DEPLOY-2026-06-19-aquecedor-fila-ensure-fix`. Ver `doc/LOG-2026-06-19__aquecedor-fila-ensure-fix.md`.

**WABA — V01 local login:** `.env.v01` recebeu `WABA_ADMIN_EMAIL`, `WABA_ADMIN_PASSWORD`, `WABA_SESSION_SECRET`, `WABA_SESSION_TTL_HOURS` (mesmas credenciais do V02). Servidor reiniciado (`npm run dev:v01`). `GET /version-01/auth/session` → `authConfigured: true`; login master OK. Ver `doc/LOG-2026-06-19__waba-v01-login-env-fix.md`.

2026-06-08

**WABA — Aquecedor Salvar configurações:** um clique grava; auto-refresh pausado na aba. Marker `DEPLOY-2026-06-08-waba-aquecedor-salvar-config-fix`. Ver `doc/LOG-2026-06-08__waba-aquecedor-salvar-config-fix.md`.

2026-06-08

**WABA — split rateio auto-save:** participantes/fornecedores gravam ao incluir/remover/editar; soma 100% só no repasse. Marker `DEPLOY-2026-06-08-waba-split-autosave-persist`. Ver `doc/LOG-2026-06-08__waba-split-autosave-persist.md`.

2026-06-08

**WABA — pausar auto-refresh em Admin Usuários/Financeiro:** timer 15s não recarrega mais formulários em cadastro; label «Atualização automática pausada nesta tela». Marker `DEPLOY-2026-06-08-waba-admin-forms-no-auto-refresh`. Ver `doc/LOG-2026-06-08__waba-admin-forms-no-auto-refresh.md`.

2026-06-08

**WABA — política master parametrizável (disparos + split):** Admin · Usuários → tipo Master exibe checkboxes Créditos ilimitados, Split Fornecedores/Lucros. Créditos/intake/split Asaas respeitam flags por usuário. Padrão master: ilimitado + fornecedores, lucros off. Marker `DEPLOY-2026-06-08-waba-master-disparos-policy`. Ver `doc/LOG-2026-06-08__waba-master-disparos-policy.md`.

2026-06-18

**WABA — aquecedor turno por número:** impede envios consecutivos da mesma origem no par (ex. drax→soma×3 sem soma→drax). Turno lê `aquecedor` ENVIADO por `instancia` + `numero_destino`. Marker `DEPLOY-2026-06-18-aquecedor-turno-por-numero`. Ver `doc/LOG-2026-06-18__aquecedor-turno-por-numero.md`.

**WABA — deploy produção pack (18/06):** commit `e849b4f` — `DEPLOY-2026-06-18-waba-producao-pack`. Push `master` → Easypanel `waba_disparador`. Ver `doc/LOG-2026-06-18__waba-producao-pack-deploy.md`.

**WABA — créditos teste mozart.pmo@gmail.com:** +500 envios disponíveis em cada API (oficial 800 contratado / 300 consumido; alternativa 700 / 200). Pedidos fictícios `402b734d…` e `47752b89…`. Script `scripts/grant-disparos-credits-v02.cjs`. Ver `doc/LOG-2026-06-18__waba-mozart-creditos-teste-500.md`.

**WABA — e-mail boas-vindas cadastro landing:** após `POST /subscribers/register`, e-mail com resumo do cadastro + botão «Acessar o sistema». Marker `DEPLOY-2026-06-18-waba-cadastro-boas-vindas-email`. Ver `doc/LOG-2026-06-18__waba-cadastro-boas-vindas-email.md`.

**WABA — campanha erro reportado (operacional):** botão Reportar Erro, status Erro Reportado, restituição de saldo, e-mail «Veja o motivo». Marker `DEPLOY-2026-06-18-waba-campanha-erro-reportado`. Ver `doc/LOG-2026-06-18__waba-campanha-erro-reportado.md`.

**WABA — e-mails assinante (chamado/campanha finalizados):** SMTP nodemailer; textos cordiais; botão «Acesse o relatório» com deep link `?campanhaRelatorio=`. Marker `DEPLOY-2026-06-18-waba-email-notifications`. Ver `doc/LOG-2026-06-18__waba-email-notifications.md`.

**WABA — chamados coluna ID + demo atraso:** coluna `displayId` na listagem; ticket `CHM-260618-975A9E` retroagido para 16/06/2026 (teste relógio 24h). Marker `DEPLOY-2026-06-18-waba-chamados-id-column`. Ver `doc/LOG-2026-06-18__waba-chamados-id-column-demo-overdue.md`.

**WABA — chamados atraso 24h:** ícone de relógio na lista master quando chamado pendente passa de 24h sem finalizar (mesmo padrão visual de campanhas). API `isCloseOverdue`/`closeDeadlineAt`. Marker `DEPLOY-2026-06-18-waba-chamados-overdue-24h`. Ver `doc/LOG-2026-06-18__waba-chamados-overdue-24h.md`.

**WABA — aquecedor alternância por par:** bloqueia envio consecutivo da mesma instância no mesmo par; conversa A↔B alterna remetente. Marker `DEPLOY-2026-06-18-aquecedor-pair-alternancia`. Ver `doc/LOG-2026-06-18__aquecedor-pair-alternancia.md`.

**WABA — suporte assinante áudio anexo:** gravação com `recorder.start(250)`, `requestData` ao parar, lista com ícone de áudio e spinner de processamento. Marker `DEPLOY-2026-06-18-waba-support-audio-attach-processing`. Ver `doc/LOG-2026-06-18__waba-support-audio-attach-processing.md`.

**WABA — chamados master ícones anexo:** imagem/vídeo/áudio com ícone clicável (abre arquivo em nova aba) na lista e no modal Detalhes. Marker `DEPLOY-2026-06-18-waba-chamados-attachment-icons`. Ver `doc/LOG-2026-06-18__waba-chamados-attachment-icons.md`.

**WABA — FAB suporte 15px esquerda:** correção em `D:\Waba\index.html` (servidor local roda de `D:\Waba`, não `E:\Waba`). CSS desktop `left: 15px` e `syncWabaSupportFabPosition()` deixa de calcular pela borda direita da sidebar. Marker `DEPLOY-2026-06-18-waba-support-fab-left-15px`. Ver `doc/LOG-2026-06-18__waba-support-fab-left-15px.md`.

**WABA — demo assinante.teste@walkup.com:** script `prepare-demo-subscriber-v02.cjs`; senha `Walkup@2026`; conta zerada (0 créditos, sem campanhas, aquecedor bloqueado). Ver `doc/LOG-2026-06-18__demo-assinante-teste-walkup.md`.

**WABA — FAB suporte fora da sidebar:** `syncWabaSupportFabPosition()` posiciona o `?` à direita do painel do menu (não mais em `left: 20px` sobre a coluna lateral). Marker `DEPLOY-2026-06-08-waba-support-fab-outside-sidebar`.

**WABA — FAB suporte discreto:** botão flutuante canto inferior esquerdo, ícone `?` redondo, transparente/discreto; azul só no hover. Removido da sidebar e do drawer mobile.

**WABA — dashboard Disparos gate (assinante novo):** prévia borrada + overlay «Contratar créditos» quando sem campanhas com relatório. Ver `doc/LOG-2026-06-18__waba-disparos-dashboard-gate.md`.

**WABA — badge total por seção (menu recolhido):** soma contadores nos títulos Admin/Suporte quando o grupo está fechado. Ver `doc/LOG-2026-06-18__waba-menu-group-badge-total.md`.

**WABA — badges master menu (ativos novos):** tag branca com contagem em Assinantes, Campanhas, Usuários, Financeiro e Chamados. API `GET/POST /admin/master-menu-badges`. Ver `doc/LOG-2026-06-08__waba-master-menu-badges.md`.

**WABA — botão Suporte fora do menu:** `#waba-support-btn` movido para `.waba-sidebar-support-outside`, acima do `.tabs-wrapper` (stack `.waba-sidebar-stack`). Menu lateral mantém só o toggle ☰ no topo.

**WABA — identidade visual menu por seção:** cada grupo (`nao-oficial`/Aquecedor laranja, `oficial`/Disparos verde, `admin` amarelo, `suporte` azul) aplica cor no toggle e no item `.active`. Mobile usa `data-menu-section` nos botões. `resolveMenuGroupForTab` inclui `suporte` (Chamados). Ver `doc/LOG-2026-06-08__menu-section-visual-identity.md`.

**WABA — master Suporte/Chamados:** seção Suporte com menu Chamados; abas Pendentes e Atendidos; modal master com resposta e finalização. Ver `doc/LOG-2026-06-08__waba-master-support-chamados.md`.

**WABA — suporte assinantes:** botão fixo canto superior esquerdo; modal com descrição, anexos e ID de chamado. Ver `doc/LOG-2026-06-08__waba-support-tickets.md`.

**Disparos — dashboard master autocomplete:** busca por trecho de nome ou e-mail com lista selecionável abaixo do campo; gráfico filtra após seleção. `compareSubscribers` na API. Ver `doc/LOG-2026-06-08__disparos-dashboard-subscriber-autocomplete.md`.

**Disparos — dashboard master:** usuários `master` veem relatório consolidado somando campanhas de **todos os assinantes**; demais usuários só as próprias. Ver `doc/LOG-2026-06-08__disparos-dashboard-master-assinantes.md`.

**Disparos — menu Dashboard:** aba `disparos-dashboard` com relatório consolidado (mesmo layout do relatório de campanha) somando indicadores de todas as campanhas finalizadas do usuário. API `GET /disparos/dashboard/overview` escopada por `ownerEmail`. Ver `doc/LOG-2026-06-08__disparos-dashboard-consolidado.md`.

**Disparos — menu Dashboard (base):** nova aba `disparos-dashboard` na seção Disparos (produção). Ver `doc/LOG-2026-06-08__disparos-dashboard-menu.md`.

**Aquecedor — Soma Promotora fora do ciclo:** bug `name` vs `instanceName` na Evolution; diagnóstico com `instancias.excluded`. Marker `DEPLOY-2026-06-08-aquecedor-pair-and-instances`. Ver `doc/LOG-2026-06-08__aquecedor-soma-instancia-excluida.md`.

**Aquecedor — sem repetir mensagem no par:** ao enviar entre duas instâncias (ex. drax↔walkup), o texto não pode repetir na ida e na volta. Exclusão por par + fila + últimas globais. Marker `DEPLOY-2026-06-08-aquecedor-no-duplicate-pair`. Ver `doc/LOG-2026-06-08__aquecedor-no-duplicate-pair.md`.

**Wizard instância — etapa 3 (textos):** trocado "celular de referência" por "outro WhatsApp (não o que está integrando)" em `index.html` e `instance-inbound-validation.service.ts`. Ver `doc/LOG-2026-06-08__wizard-etapa3-outro-whatsapp.md`.

**Aquecedor — mensagens aleatórias:** corrigido `ensureAquecedorPendingMessage` que enfileirava só o texto fixo; agora sorteia do banco (`aquecedor_message_templates` / legado / disparos templates) evitando repetir as últimas 50 enviadas. SQL `doc/SQL-2026-06-17__create-aquecedor-message-templates.sql`. Marker `DEPLOY-2026-06-17-aquecedor-random-messages`. Ver `doc/LOG-2026-06-17__aquecedor-random-messages.md`.

**Admin Dashboard — crescimento assinantes × receita:** nova seção com KPIs (ARPU, assinantes, receita acumulada, razão receita÷assinantes), gráfico de índices base 100 (assinantes vs receita) e gráfico de evolução da receita média por assinante. API `growthAnalysis` em `GET /admin/dashboard/overview`. Marker `DEPLOY-2026-06-17-subscriber-revenue-growth`. Ver `doc/LOG-2026-06-17__admin-dashboard-growth-analysis.md`.

**Admin Dashboard:** visão geral com KPIs financeiros (receita, custo, lucro, margem), operação (assinantes, campanhas, usuários), comparativo API Oficial/Alternativa, gráfico receita 30 dias e atividade recente. API `GET /admin/dashboard/overview`. Marker `DEPLOY-2026-06-17-admin-dashboard`. Ver `doc/LOG-2026-06-17__admin-dashboard.md`.

**Financeiro — rateio em colunas:** linhas do split separadas em 3 colunas (descrição | valor | ícones) via `.admin-financeiro-split-line` grid; funções `formatSplitSettlementLineLabel` / `formatSplitSettlementLineValue`. Marker `DEPLOY-2026-06-17-split-grid-columns`. Ver `doc/LOG-2026-06-17__financeiro-split-grid-columns.md`.

**Traefik DEFINITIVO:** script mestre `traefik-permanent-all-vps.sh` — restore routers + patch backend + guarda inotify no main.yaml + watchers WABA/EVO. Ver `doc/FIX-TRAEFIK-DEFINITIVO.md`.

**Traefik Evolution (walkup):** v2 com auto-restore router + reação a eventos traefik/easypanel.


**Supabase novo projeto DEV:** ref `wcexaxeenvuigktyomdq`, URL `https://wcexaxeenvuigktyomdq.supabase.co`. Schema completo: `doc/SQL-2026-06-16__create-waba-supabase-schema-completo.sql`. `.env` e `.env.v02` com `SUPABASE_SERVICE_ROLE_KEY` preenchida; SQL executado com sucesso. Setup passo a passo: **4/8** — retomar teste Aquecedor (Evolution/Traefik corrigidos 2026-06-16).

**Financeiro — split fornecedores:** cadastro de fornecedor (nome, plano, custo/envio, PIX); no split o fornecedor recebe envios × custo; lucro segue rateio % entre masters. **Repasse PIX via Asaas** (`POST /transfers`) ao confirmar pagamento + backfill/retry no Admin. Env `WABA_FINANCEIRO_SPLIT_PAYOUT_ENABLED`. Marker `DEPLOY-2026-06-16-financeiro-split-payout-pix`. Ver `doc/LOG-2026-06-16__financeiro-split-payout-pix.md`.

**Sidebar menu scroll:** `.desktop-tabs` com `overflow-y: auto` dentro de `.tabs-wrapper` fixo; ao expandir sidebar abre só o grupo da aba ativa. Ver `doc/LOG-2026-06-08__sidebar-menu-scroll-overflow.md`.

**Aquecedor — listagem Envios por usuário:** `GET /aquecedor/envios` com auth, filtro por instâncias do dono (`listOwnedInstanceNames`), merge log local `aquecedor-envios-log.json` + Supabase (`logs_envios`, fila PENDENTE/PROCESSANDO); `recordAquecedorEnvio` após envio; auto-enfileira mensagem no `start` e quando fila vazia no ciclo; UI mostra `hint` quando vazio. Marker `DEPLOY-2026-06-08-aquecedor-envios-listagem-owner`. Ver `doc/LOG-2026-06-08__aquecedor-envios-listagem-owner.md`.

**Financeiro — somente conciliadas:** lista só `paid`, sem botão Conciliar PIX. Ver `doc/LOG-2026-06-08__financeiro-somente-conciliadas.md`.

**Financeiro — pedidos paginados:** API `GET /admin/financeiro/orders`, 10 por vez + scroll. Ver `doc/LOG-2026-06-08__financeiro-pedidos-scroll-paginado.md`.

**Financeiro — split inputs:** cabeçalho único, cards escuros, inputs tema dark, grid alinhado PIX/rateio. Ver `doc/LOG-2026-06-08__financeiro-split-inputs-layout.md`.

**Financeiro — métricas comparativas:** cards por indicador (Total contratado, Custo total, Lucro bruto) com Oficial vs Alternativa, barras e consolidado. **API Oficial = verde `#4ade80`** (legenda + barras). Ver `doc/LOG-2026-06-08__financeiro-metricas-comparativas.md`.

**Aquecedor — salvar config + instâncias por usuário:** fallback local `aquecedor-config.json` sem Supabase; motor filtra instâncias por `aquecedorRuntimeOwnerEmail` + `instance-owners.json`. Marker `DEPLOY-2026-06-08-aquecedor-config-local-instancias-usuario`. Ver `doc/LOG-2026-06-08__aquecedor-salvar-config-instancias-usuario.md`.

**Instâncias por usuário (v2):** sem bypass master — walkup@walkuptec.com.br só vê instâncias próprias. `instance-owners.json` obrigatório. Marker `DEPLOY-2026-06-16-instancias-estritas-por-usuario-v2`. Ver `doc/LOG-2026-06-16__fix-instancias-sem-bypass-master.md`.

**Traefik Evolution (walkup):** instalado + router restaurado (`restore-walkup-evo-traefik-router-vps.sh` de `main.yaml.bak-waba-20260616-070104`). HTTPS `fetchInstances` → **200**. Backend `172.17.0.1:30181`, watcher ativo.

**Fix validação inbound passo 3:** Evolution usa `ownerJid` (não `owner`); validação não iniciava e número ficava "—". Resposta automática usa JID `@lid` quando aplicável. Marker `DEPLOY-2026-06-08-validacao-inbound-ownerjid-v1`. Ver `doc/LOG-2026-06-08__fix-validacao-inbound-ownerjid-lid.md`.

**Listagem instância pós-wizard:** instância fica oculta na tabela durante todo o modal (QR + validação); só aparece após passo 4 e botão **Concluir**. Ver `doc/LOG-2026-06-08__instancia-lista-apos-wizard-concluir.md`.

**Validação inbound modal instância:** após QR `open`, fluxo seguro CONFIRMAR → resposta na mesma conversa; sem envio frio entre instâncias. Endpoints `validacao-inbound`. Marker `DEPLOY-2026-06-08-validacao-inbound-v1`. Ver `doc/LOG-2026-06-08__validacao-inbound-modal-instancia.md`.

---

**CRÍTICO — Probe automático pós-QR (ban WhatsApp):** após conectar instância, o sistema enviava mensagem de teste automaticamente e marcava falha técnica como "possível restrição". Corrigido: sem envio automático; teste de mensagem só com botão opcional + confirmação; `restrictionSuspected` só com recusa explícita da Evolution. Marker `DEPLOY-2026-06-08-safe-connect-v1`. Ver `doc/LOG-2026-06-08__fix-probe-auto-mensagem-ban-whatsapp.md`.

---

2026-06-15

**Grant Mozart +40 Alternativa (v02):** pedido `c7a3f1e2`; +10 bônus na compra → disponível Alternativa **500**. Ver `doc/LOG-2026-06-15__grant-mozart-40-alternativa.md`.

---

**Grant Mozart +400 Oficial (v02):** pedido `b8f4e2a1` paid; +100 bônus liquidou na compra → disponível Oficial **700**. Ver `doc/LOG-2026-06-15__grant-mozart-400-oficial.md`.

---

2026-06-12

**Fix liquidação bônus na compra:** bonificados somam ao disponível na próxima compra do mesmo plano; Mozart v02: Oficial 700/0, Alternativa 650/0. Ver `doc/LOG-2026-06-12__fix-bonus-soma-disponivel-compra.md`.

---

**Fix resumo Disparos:** total não vai mais só para API Oficial; reiniciar dev:v02. Ver `doc/LOG-2026-06-12__fix-resumo-saldo-por-api.md`.

---

**Reset saldo Mozart (v02):** apenas 500 API Oficial + 500 API Alternativa; bônus zerado. Ver `doc/LOG-2026-06-12__reset-mozart-500-oficial-500-alternativa.md`.

---

**Créditos por plano:** saldo e bonificação separados (Oficial/Alternativa); card Resumo com grid; bônus liquida na compra do mesmo plano. Ver `doc/LOG-2026-06-12__creditos-bonificacao-por-plano.md`.

---

**Bonificação na compra:** próxima compra paga soma `pendingBonus` ao pedido e zera bonificação; liquidação em créditos, webhook e polling. Ver `doc/LOG-2026-06-12__bonificacao-liquida-na-compra.md`.

---

**Campanhas API Oficial retroativas:** fallback de plano usa pedido na data de criação do intake; backfill `apiKind: oficial` nos legados. Ver `doc/LOG-2026-06-12__fix-campanhas-api-oficial-retroativo.md`.

---

**Campanha Alternativa 02 — status master:** digitalcorban (API Oficial) não finaliza campanhas Alternativa; corrigido persistência + UX; campanha `d33c148c` finalizada por somaconecta. Ver `doc/LOG-2026-06-12__fix-campanha-alternativa-02-status-master.md`.

---

**Crédito mozart — +500 API Alternativa:** pedido `0d7b5407-f030-4a9c-97a2-618de2a9fe56` (total contratado 2910, disponíveis 500). Ver `doc/LOG-2026-06-12__grant-mozart-500-alternativa-2.md`.

**Crédito mozart — API Alternativa 500 envios:** pedido paid `a21d204d-3be4-4f02-8a5d-6eda4481ee55` em `waba-billing-orders.json` (v02). Saldo: 500 disponíveis. Ver `doc/LOG-2026-06-12__grant-mozart-500-alternativa.md`.

---

2026-06-12

**Ícone atraso campanhas (master):** cor = ID assinante; persiste em `in_progress` se iniciou após SLA 6h; some só ao finalizar (`completed`). Ver `doc/LOG-2026-06-12__icone-atraso-persiste-ate-finalizar.md`.

**Ícone atraso — cor:** `--admin-subscriber-id-color` = `--bs-code-color`. Ver `doc/LOG-2026-06-12__icone-atraso-cor-id-assinante.md`.

---

2026-06-12

**Campanhas assinante — Resumo + relatório:** ao mudar status da campanha (polling), `loadDisparosCredits()` atualiza Resumo (créditos bonificados); relatório usa **Créditos bonificados** no lugar de Saldo bonificado/reembolsado. Ver `doc/LOG-2026-06-12__resumo-bonificado-status-sync.md`.

---

2026-06-12

**Wizard Nova campanha — quantidade de envios:** etapa 5 (Leads) ganhou input `dis-wizard-planned-send-count` após importar planilha; validação contra saldo (`remainingShipments`) e linhas do arquivo; `plannedSendCount` enviado no intake; backend valida em `waba-campaign-intake.routes.ts`. Ver `doc/LOG-2026-06-12__wizard-quantidade-envios-input.md`.

---

2026-06-08

**Disparos — nudge saldo zerado:** quando `remainingShipments === 0`, card "Ainda disponíveis" pulsa (laranja), banner no topo + card no resumo com CTA "Adicionar créditos" → `disparos-lancamento`; wizard "Nova campanha" bloqueado. Ver `doc/LOG-2026-06-08__disparos-saldo-zero-nudge.md`.

---

2026-06-08

**Operacional Campanhas — fluxo completo:** copiar textos no modal; botão Campanha Iniciada (`generated`→`in_progress`); botão Relatório com 5 métricas (Total Leads, Enviados, Entregues, Lidos, Falhados); salvar finaliza campanha. Ver `doc/LOG-2026-06-08__operacional-campanhas-relatorio.md`.

---

2026-06-08

**Tela operacional Campanhas (admin):** menu `admin-campanhas` para equipe operacional; lista campanhas de todos os assinantes (ID, plano API, nome, envios); modal com detalhes + download imagem/planilha truncada; planilha limitada a `plannedSendCount` no intake. Ver `doc/LOG-2026-06-08__operacional-campanhas-fila.md`.

---

2026-06-11

**Campanha linhas × envios:** contagem de linhas na importação; envios limitados ao saldo contratado; exibição no card de Campanhas. Ver `doc/LOG-2026-06-11__campanha-linhas-envios-limite.md`.

---

2026-06-11

**Permissões de menu imediatas:** `campanhas` acoplado a `disparos-lancamento`; menu Campanhas respeita permissão + créditos; sessão revalidada a cada 45s/foco. Ver `doc/LOG-2026-06-11__menu-permissoes-imediatas.md`.

---

2026-06-11

**Fix Salvar alterações (editar usuário):** servidor dev precisava reinício para carregar `PATCH /admin/users/:id`; modal com scroll + botão submit no form; `dist` sincronizado. Ver `doc/LOG-2026-06-11__fix-admin-editar-salvar.md`.

---

2026-06-11

**Editar usuário completo:** modal com nome, e-mail, senha (opcional) e menus; `PATCH /admin/users/:id`. Ver `doc/LOG-2026-06-11__admin-editar-usuario-completo.md`.

---

2026-06-11

**Seções renomeadas:** API não oficial → Aquecedor; Disparos/API Meta → Disparos. Ver `doc/LOG-2026-06-11__renomear-secoes-aquecedor-disparos.md`.

---

2026-06-11

**Admin Usuários Editar/Remover:** botões na coluna Ações; `DELETE /admin/users/:id`. Ver `doc/LOG-2026-06-11__admin-usuarios-editar-remover.md`.

---

2026-06-11

**Fix card Admin no canto:** `</div>` extra em `#tab-disparos` fechava `<main>` cedo; painéis admin saíam para o `body` e iam para a direita. Ver `doc/LOG-2026-06-11__fix-html-main-fechado-cedo.md`.

---

2026-06-11

**Permissões dinâmicas de menus:** registry `waba-menu-registry.ts`, checkboxes ao criar/editar usuário; menus novos desabilitados para usuários antigos. Ver `doc/LOG-2026-06-11__menus-permissoes-dinamicas.md`.

---

2026-06-11

**Admin Usuários:** equipe Master/Operacional/Suporte em `waba-system-users.json`; menu + CRUD master. Ver `doc/LOG-2026-06-11__admin-usuarios-sistema.md`.

---

2026-06-08

**Admin Assinantes:** listagem master com créditos, disparos, aguardando e finalizados. API `GET /admin/subscribers`. Ver `doc/LOG-2026-06-08__admin-assinantes-lista.md`.

---

2026-06-08

**Master walkup@walkuptec.com.br:** local v02 já em `.env.v02`; login testado com `role: master`. Produção = vars no Easypanel. Ver `doc/LOG-2026-06-08__master-walkup-auth.md`.

---

2026-06-08

**Fix Gerar Campanha (wizard):** feedback inline quando falta planilha/dados; init do wizard no boot; validação completa no envio. Ver `doc/LOG-2026-06-08__fix-wizard-gerar-campanha.md`.

---

2026-06-11

**Menu Campanhas (1º acesso):** liberado após créditos pagos; pulse + badge Novo até primeiro clique. Ver `doc/LOG-2026-06-11__menu-campanhas-efeito-primeiro-acesso.md`.

---

2026-06-11

**Painel créditos Disparos:** contratados / consumidos / saldo na aba Disparos após PIX pago. API `GET /billing/disparos/credits`. Ver `doc/LOG-2026-06-11__disparos-painel-creditos-saldo.md`.

---

2026-06-08

**Overlay Aquecedor mais transparente:** fundo visível com blur 8px, opacity 0.62; overlay `rgba(5,5,5,0.2)` + blur 6px. Ver `doc/LOG-2026-06-08__aquecedor-gate-mais-transparente.md`.

---

2026-06-10

**Assinantes + Aquecedor 30 dias:** cadastro PV/API, entitlement pós-PIX, bloqueio Aquecedor. Ver `doc/LOG-2026-06-10__assinantes-cadastro-aquecedor-30-dias.md`.

---

2026-06-10

**Login WABA — UX:** ícone olho (mostrar/ocultar senha) + link **Esqueci minha senha** (modal com instruções de reset via `WABA_ADMIN_PASSWORD`).

---

**Login master WABA:** tela de acesso + sessão cookie; credenciais em `WABA_ADMIN_EMAIL` / `WABA_ADMIN_PASSWORD` (`.env.v02` local). Ver `doc/LOG-2026-06-10__login-master-waba-auth.md`.

---

2026-06-10

**Menu Admin:** seção **Admin** com Dashboard, Assinantes e Financeiro (painéis placeholder). Ver `doc/LOG-2026-06-10__menu-admin-dashboard-assinantes-financeiro.md`.

---

2026-06-10

**Fix modal PIX fecha ao Gerar PIX:** Asaas mínimo R$ 5,00; pacote teste ajustado para **100 envios · R$ 5,00**; loading no formulário até sucesso. Ver `doc/LOG-2026-06-10__fix-pix-modal-fecha-asaas-minimo.md`.

---

2026-06-08

**Pacote teste Disparos PIX (100 envios · R$ 5,00 — antes R$ 1,00 inválido no Asaas):** tier `testOnly` no topo de `DISPAROS_PRICING_TIERS` (oficial + alternativa) em `index.html`; backend aceita `valueCents=100` + `shipmentCount=100`. Ver `doc/LOG-2026-06-08__pacote-teste-100-envios-1-real.md`.

Palavras-chave: `disparos-pacote-teste-1-real`, `DISPAROS_TEST_PACKAGE_CENTS`

---

2026-06-09

**WABA 404 pós-deploy probe (10/06) — RESOLVIDO:** Traefik sem router `waba.draxsistemas.com.br`; restore via `restore-waba-traefik-router-vps.sh` (curl GitHub) → **200**. Ver `doc/LOG-2026-06-10__waba-404-traefik-pos-deploy-probe.md`.

Palavras-chave: `waba-404-traefik-2026-06-10`, `restore-waba-traefik`

---

**Probe pós-integração — VALIDADO em produção (09/06):** deploy `cbcf674` / marker `DEPLOY-2026-06-09-probe-integracao-duplo-v1`; `WABA_PUBLIC_BASE_URL` OK; teste retornou conforme esperado (API + webhook no modal). Ver `doc/LOG-2026-06-09__probe-integracao-duplo-findmessages-webhook.md`.

Palavras-chave: `probe-integracao-validado`, `DEPLOY-2026-06-09-probe-integracao-duplo-v1`, `cbcf674`

---

**Investigação Geovana 62982578262 — REVISÃO:** prints WhatsApp confirmam **só recebe** de Walkup/Marcelo; horários do print batem com logs `Walkup→Geovana` (ex. 08:43, 09:16…). Logs mostram `Geovana→Walkup` ~10 min depois mas **mensagens não aparecem no chat** → EVO retorna HTTP OK sem entrega real. Ver `doc/LOG-2026-06-09__geovana-evidencia-whatsapp-so-recebe.md`.

Palavras-chave: `geovana-so-recebe`, `evo-sendtext-falso-positivo`, `geovana-62982578262`

---

**Aquecedor produção — PARADO (validação pendente):** `POST /aquecedor/stop` + `POST /disparos/parar-envios` + instâncias Walkup/Geovana novo/Marcelo Pessoal com `useAquecedor:false`. Motor `running:false`; `runtime-intent` desligado; diagnóstico `connectedCount:0` para aquecedor. Fila Supabase ~38k PENDENTE inativa. Ver `doc/LOG-2026-06-09__parar-aquecedor-producao-validacao.md`.

Palavras-chave: `aquecedor-parado-producao`, `parar-envios`, `validacao-erro-aquecedor`

---

**Contratar Disparos — PIX Asaas:** botão Contratar abre modal → `POST /billing/disparos/checkout` → QR PIX. Identificação na conta Asaas compartilhada: `externalReference` = `waba:{uuid}`, `description` = `WABA Disparos · …`. Webhook `POST /webhooks/asaas` filtra prefixo `waba:`. Ver `doc/LOG-2026-06-09__disparos-contratar-pix-asaas.md`.

Palavras-chave: `waba-asaas`, `billing/disparos`, `waba-billing-orders.json`

---

**Favicon produção (master):** commit `91d4a8f` — favicon igual Typebot admin (`favicon.ico` + `media/favcon.png`); push `origin/master`. Validar após redeploy `waba_disparador`. Ver `doc/LOG-2026-06-09__favicon-deploy-master.md`.

Palavras-chave: `favicon-waba`, `favcon.png`, `91d4a8f`

---

**Disparos V02 — API Oficial vs Alternativa:** tela comparativa no menu DISPAROS (`tab-disparos-lancamento`), mockup com dois cards, Contratar + localStorage. Ver `doc/LOG-2026-06-08__disparos-api-oficial-alternativa-v02.md`.

Palavras-chave: `disparos-api-oficial`, `disparos-api-alternativa`, `tab-disparos-lancamento`

---

**V02 UI igual produção:** local OK após `npm run dev:v02` (`uiProfile=production`). URL pública `/version-02/` ainda **404** (sem serviço VPS). `dev-v02.ps1` libera porta 3012; `.env.v02` com `WABA_UI_PROFILE=production`. Ver `doc/LOG-2026-06-08__v02-ui-igual-producao.md`.

Palavras-chave: `v02-production-ui`, `WABA_UI_PROFILE`, `resolveUiProfile`

---

**Produção 404 após redeploy — RESOLVIDO:** merge cirúrgico v1 falhou (chaves router existiam sem `Host(waba…)`). Fix aplicado no VPS: `cp main.yaml.bak-waba-20260608-172040 → main.yaml` + `/root/traefik-permanent-waba-vps.sh run` → **waba:200 health:200**. Script v2 (`defacbe`): restore completo do backup. Ver `doc/LOG-2026-06-08__waba-404-traefik-router-restore.md`.

Palavras-chave: `waba-404-resolvido`, `restore-waba-traefik`, `bak-waba-20260608`, `traefik-permanent-waba`

---

**Traefik WABA — script dedicado (não compartilhar com Typebot):** criados `scripts/traefik-permanent-waba-vps.sh` e `scripts/diagnose-waba-502-vps.sh` para o serviço Easypanel **waba/waba_disparador** (Swarm `waba_waba_disparador`, rede `easypanel-waba`, domínio `waba.draxsistemas.com.br`). Instalação VPS: `/root/traefik-permanent-waba-vps.sh install`. Doc: `doc/FIX-TRAEFIK-WABA.md`. Ver `doc/LOG-2026-06-08__traefik-permanent-waba-script-dedicado.md`.

Palavras-chave: `traefik-permanent-waba`, `waba_disparador`, `502-bad-gateway`, `easypanel-waba`, `script-separado-typebot`

---

2026-04-07

**Meta Ativos - UX em sanfona com sinaleira por etapa:** a tela foi reorganizada em cards por etapa com indicador visual de status (verde/amarelo/vermelho), desbloqueio condicional da prÃ³xima etapa e expansÃ£o automÃ¡tica da etapa pendente. Objetivo: reduzir carga cognitiva e guiar configuraÃ§Ã£o passo a passo. Ver `doc/LOG-2026-04-07__120000__ux-meta-ativos-sanfona-sinaleira.md`.

Palavras-chave: `meta-ativos`, `sanfona`, `sinaleira`, `etapas`, `ux`

---

**Meta exchange-code - consistencia de redirect_uri:** o backend passou a expor `redirectUri` no endpoint de config e a priorizar `META_OAUTH_REDIRECT_URI` na troca do code. O frontend agora usa esse valor fixo do servidor (fallback `window.location.origin`) para evitar mismatch com o OAuth dialog. Ver `doc/LOG-2026-04-07__114500__fix-meta-redirect-uri-consistencia-env-config.md`.

Palavras-chave: `redirect_uri`, `META_OAUTH_REDIRECT_URI`, `embedded-signup`, `exchange-code`

---

**Meta exchange-code â€” rotas para proxy que remove `/api`:** alÃ©m de `urlencoded`, o backend passou a expor `POST /waba-embedded-signup-exchange` e `POST /meta/embedded-signup/exchange-code` (mesmo handler). Assim, quando nginx faz `proxy_pass .../` dentro de `location /api/`, o path repassado bate no Express. O front tenta os quatro paths em sequÃªncia. Ver `doc/LOG-2026-04-06__210000__fix-meta-exchange-proxy-strip-paths.md`.

Palavras-chave: `exchange-code`, `proxy_pass`, `strip /api`, `waba-embedded-signup-exchange`

---

**Meta exchange-code â€” POST como `urlencoded`:** o browser passa a chamar `exchange-code` principalmente com `application/x-www-form-urlencoded` (`metaPost(..., { asForm: true })`), com fallback para path legado e, sÃ³ se ainda parecer HTML de proxy, JSON nos dois paths. Objetivo: contornar proxies que falham em POST JSON. Ver `doc/LOG-2026-04-06__204500__embedded-signup-exchange-urlencoded-fallback.md`.

Palavras-chave: `exchange-code`, `urlencoded`, `502 HTML`, `metaPostEmbeddedExchangeCode`

---

**Meta exchange-code + redirect_uri:** troca do cÃ³digo do Embedded Signup passa a enviar `redirect_uri` (URL da pÃ¡gina ou `META_OAUTH_REDIRECT_URI`) para a Graph API, com fallbacks quando a Meta reclama de redirect. Ver `doc/LOG-2026-04-06__170000__meta-exchange-code-redirect-uri.md`.

Palavras-chave: `META_OAUTH_REDIRECT_URI`, `exchange-code`, `redirect_uri`

---

**Meta Embedded Signup â€” troca de code sem bloquear no WABA ID:** o frontend esperava `code` e `wabaId` juntos antes de chamar `POST /meta-oficial/embedded-signup/exchange-code`, mas a API sÃ³ precisa do `code` e o `waba_id` costuma chegar depois no `postMessage`. Ajuste: trocar o code assim que existir; guardar token em memÃ³ria atÃ© o WABA chegar; entÃ£o preencher campos, webhooks e sucesso. Ver `doc/LOG-2026-04-06__160000__fix-meta-es-code-before-waba-exchange.md`.

Palavras-chave: `embedded-signup`, `exchange-code`, `waba_id`, `metaEsExchangedAccessToken`

---

2026-04-01

**Campanhas â€” pausa por instÃ¢ncias desconectadas em 50% inclusive:** o limite passou de â€œmais de 50%â€ (`> 0.5`) para **50% ou mais** (`>= 0.5`): pausa automÃ¡tica no tick de disparo, `instanceHealth` na listagem e bloqueio de ativaÃ§Ã£o com mensagem ajustada. Ver `doc/LOG-2026-04-01__143000__campanha-pausa-50-porcento-instancias.md`.

Palavras-chave: `campanha-pausa-instancias`, `shouldPauseByDisconnectedRatio`, `50-porcento-desconectadas`

---

**Campanhas â€” refinamento dos Ã­cones de Ãºltima mensagem/URL + robustez de endpoint:** Ã­cones de aÃ§Ã£o no card migrados de emoji para SVG, com feedback explÃ­cito quando o ambiente ainda nÃ£o carregou a rota nova (`404` em `ultimo-disparo`). Backend reforÃ§ado para persistir/hidratar `message_text` e `short_url` com fallback legado. ServiÃ§o local reiniciado para aplicar build. Ver `doc/LOG-2026-04-01__081600__fix-icones-campanha-e-restart-endpoint-ultimo-disparo.md`.

Palavras-chave: `icone-campanha-svg`, `ultimo-disparo-404-restart`, `message_text-short_url`

---

**Campanhas Disparador â€” Ã­cones de Ãºltima mensagem e Ãºltima URL:** adicionados dois atalhos no card da campanha (`ðŸ’¬` e `â†—`) abaixo dos botÃµes de aÃ§Ã£o. `ðŸ’¬` abre modal com a Ãºltima mensagem disparada; `â†—` abre a Ãºltima URL usada no disparo. Backend ganhou `GET /disparos/campanhas/:id/ultimo-disparo` e o lead enviado passou a armazenar `messageText` no estado local. Ver `doc/LOG-2026-03-31__182500__feat-campanhas-icones-ultima-mensagem-url.md`.

Palavras-chave: `campanha-ultima-mensagem`, `campanha-ultima-url`, `GET /disparos/campanhas/:id/ultimo-disparo`

---

**Disparos â€” diagnÃ³stico com semÃ¢ntica de ciclo ativo:** texto de `proximoEnvio` foi reescrito para evitar leitura de travamento. Agora indica `ciclo em execuÃ§Ã£o`, marca `intervalo operacional (normal)` no cooldown e mostra contagem regressiva `~Xs` para o prÃ³ximo envio. Ver `doc/LOG-2026-03-31__181300__refactor-diagnostico-campanha-intervalo-normal.md`.

Palavras-chave: `diagnostico-intervalo-normal`, `proximoEnvio-contagem-regressiva`, `ciclo-em-execucao`

---

**Disparos â€” separaÃ§Ã£o visual progresso vs status:** barra de progresso de campanha passou para azul, deixando o verde reservado para etapa runtime `sending`. Objetivo: evitar leitura errada de "aguardando intervalo" com aparÃªncia de envio ativo. Ver `doc/LOG-2026-03-31__180100__ux-separar-barra-progresso-da-barra-status.md`.

Palavras-chave: `separar-progresso-status-campanha`, `barra-progresso-azul`, `barra-etapa-semantica`

---

**Disparos â€” fix visual anti-cache na barra de etapa:** cor da barra passou a ser aplicada inline por fase (alÃ©m da classe CSS), garantindo `waiting_interval` amarelo mesmo com cache/ordem de estilo. Ver `doc/LOG-2026-03-31__175300__fix-barra-etapa-inline-color-ant-cache.md`.

Palavras-chave: `inline-color-runtime-stage`, `waiting-interval-yellow-force`, `anti-cache-barra-status`

---

**Disparos â€” correÃ§Ã£o da barra de etapa no cooldown:** quando a campanha estÃ¡ `running` mas em pausa entre envios (`nextAllowedAt` futuro), a barra de etapa agora fica em `waiting_interval` (amarela) com legenda de segundos restantes. Endpoint `GET /disparos/campanhas` passou a incluir `nextAllowedAt`; fallback de UI atualizado. Ver `doc/LOG-2026-03-31__174500__fix-barra-etapa-amarela-em-aguardando-intervalo.md`.

Palavras-chave: `waiting_interval-amarelo`, `nextAllowedAt-campanhas`, `runtimeStage-fallback-cooldown`

---

**Disparos â€” status visual unificado pela barra de etapa:** removidos ponto/check ao lado do nome da campanha para evitar redundancia visual. A leitura de etapa operacional fica centralizada na barra runtime (`runtimeStage`) abaixo do progresso. Ver `doc/LOG-2026-03-31__123300__update-ui-remover-sinais-titulo-manter-barra-etapa.md`.

Palavras-chave: `remover-sinais-titulo-campanha`, `status-via-barra-etapa`, `runtimeStage-ui-principal`

---

**Disparos â€” barra de etapa runtime por campanha:** adicionada barra operacional abaixo da barra de progresso para mostrar o momento real do envio por campanha: `sending`, `waiting_interval`, `outside_window`, `paused`, `finished` e `draft`. Backend da listagem (`GET /disparos/campanhas`) agora retorna `runtimeStage` com `phase`, `label`, `detail` e `fillPercent`. Ver `doc/LOG-2026-03-31__122800__update-disparos-barra-etapa-runtime-campanhas.md`.

Palavras-chave: `runtimeStage-campanhas`, `barra-etapa-disparos`, `waiting_interval-outside_window`

---

**Campanhas Disparador â€” refino visual do indicador de status:** substituÃ­do badge pesado por indicador minimalista ao lado do nome (ponto para `draft/running/paused` e `check` para `finished`), mantendo as mesmas cores de estado jÃ¡ definidas. Ver `doc/LOG-2026-03-31__121800__refactor-ui-status-campanha-indicador-minimalista.md`.

Palavras-chave: `ui-minimalista-status-campanha`, `disparos-campaign-status-dot`, `check-azul-finalizada-refino`

---

**Campanhas Disparador â€” sinal de status ao lado do nome:** adicionado indicador visual ao lado do tÃ­tulo da campanha com mapeamento fixo: `draft` cinza, `running` verde, `paused` amarelo e `finished` com `check` azul (paleta atual). Implementado via classes `.disparos-campaign-status*` no frontend da lista de campanhas. Ver `doc/LOG-2026-03-31__121000__update-campanhas-indicador-status-cores-e-check-finalizada.md`.

Palavras-chave: `status-campanha-indicador`, `disparos-campaign-status`, `check-azul-finalizada`

---

**Aquecedor â€” botÃµes mÃ­nimos no runtime:** apÃ³s iniciar, o bloco de aÃ§Ãµes do Aquecedor mantÃ©m somente `Pausar Aquecedor` e `DiagnÃ³stico` (removidos `Envio teste` e `Criar mensagem teste` desse bloco). Ver `doc/LOG-2026-03-31__085951__aquecedor-runtime-botoes-minimos-pausar-diagnostico.md`.

Palavras-chave: `aquecedor-runtime-botoes`, `pausar-aquecedor`, `diagnostico`

---

**Aquecedor â€” indicador visual de andamento (runtime):** adicionado bloco com barra de progresso e legenda dinÃ¢mica no painel do Aquecedor. Estados cobertos: parado, processando, aguardando prÃ³ximo ciclo (com contagem regressiva) e pronto para prÃ³ximo ciclo. Polling de `/aquecedor/status` e renderizaÃ§Ã£o contÃ­nua enquanto a aba Aquecedor estÃ¡ ativa. Ver `doc/LOG-2026-03-31__075236__aquecedor-indicador-visual-andamento-runtime.md`.

Palavras-chave: `aquecedor-runtime-progress`, andamento-aquecedor, `renderAquecedorRuntimeProgress`

---

**Campanhas Disparador â€” proteÃ§Ã£o por saÃºde de instÃ¢ncias:** campanha `running` entra em pausa automÃ¡tica quando mais de 50% das instÃ¢ncias do snapshot estÃ£o desconectadas. UI passa a mostrar alerta e botÃ£o `+ InstÃ¢ncias`; ativaÃ§Ã£o fica bloqueada enquanto a regra estiver violada. Novo endpoint `POST /disparos/campanhas/:id/instancias` faz merge de instÃ¢ncias na campanha. Ver `doc/LOG-2026-03-30__184837__campanhas-pausa-automatica-mais-instancias.md`.

Palavras-chave: `instanceHealth`, pausa-automatica-campanha, `POST /disparos/campanhas/:id/instancias`, `btn-campaign-add-instances`

---

**ValidaÃ§Ã£o obrigatÃ³ria ao salvar painÃ©is:** bloqueio de `saveAquecedorConfig` e `saveDisparosConfig` quando houver campo obrigatÃ³rio vazio; no Disparador inclui tambÃ©m validaÃ§Ã£o de instÃ¢ncias selecionadas e dias de expediente. Backend reforÃ§ado em `POST /disparos/config` com `validateRequiredDisparosConfigPayload` para rejeitar payload incompleto (400). Ver `doc/LOG-2026-03-30__182653__validacao-campos-obrigatorios-paineis-save-config.md`.

Palavras-chave: `campos-obrigatorios`, `saveDisparosConfig`, `saveAquecedorConfig`, `POST /disparos/config`

---

**Disparador â€” migraÃ§Ã£o de config legada no load:** quando `disparos_config.custom_config` vem com assinatura antiga (`90/240/60/130`), o backend agora migra automaticamente para `120/320/40/130` em `loadDisparosConfigFromDb` e persiste no Supabase. Objetivo: evitar tela com delays antigos mesmo apÃ³s atualizaÃ§Ã£o de defaults. Ver `doc/LOG-2026-03-30__182240__migracao-config-legada-disparador-defaults.md`.

Palavras-chave: `custom_config-legada`, migracao-automatica-disparador, `loadDisparosConfigFromDb`

---

**Disparador â€” padrÃµes de temporizador e limites:** `DISPAROS_DEFAULTS` em `src/index.ts`: delay **120â€“320** s, mÃ¡x/hora **40**, mÃ¡x/dia **130**; mesmos fallbacks no formulÃ¡rio em `index.html`; `scheduleNextCampaignDispatchDelay` usa `DISPAROS_DEFAULTS` nos fallbacks numÃ©ricos; seed em `doc/SQL-2026-03-21__create-disparos-tables.sql` alinhado. Ver `doc/LOG-2026-03-30__180306__disparador-parametros-padrao-delays-limites.md`.

Palavras-chave: `DISPAROS_DEFAULTS`, disparador-delay-min-max, max-per-hour-instance

---

2026-03-29

**Landing vendas SOMA:** GitHub [Pagina-vendas-soma](https://github.com/walkup-tec/Pagina-vendas-soma); working copy em `D:\SOMA Promotora\Pagina-Vendas`. Primeiro commit na `main` e `git push` concluÃ­dos; conteÃºdo copiado de `soma-credit-sales` com ajustes (`package.json` nome `pagina-vendas-soma`, README com link remoto, `.gitignore` com `!.env.example`). Build validado (`npm run build`). Ver `doc/LOG-2026-03-29__223000__pagina-vendas-soma-repo-local-github.md`.

Palavras-chave: pagina-vendas-soma, Pagina-Vendas, walkup-tec, landing-soma

---

2026-03-28

**Durabilidade (porta 3000):** campanhas â†’ `data/disparos-local-state.json` + checkpoint periÃ³dico (`DISPAROS_CHECKPOINT_MS`, default 120s) + Supabase. Aquecedor â†’ fila/config no Postgres + `data/runtime-intent.json` (retoma motor apÃ³s restart se Ãºltimo comando foi Â«IniciarÂ»; `parar-envios` grava desligado). Ver `doc/garantias-durabilidade-disparador-aquecedor.md`.

**Disparador â€” persistÃªncia:** `data/disparos-local-state.json` (backup apÃ³s mutaÃ§Ãµes); na subida: `loadDisparosLocalState` + `syncDisparosCampaignsFromDbOnStartup` (atÃ© 200 campanhas do Postgres). `hydrateCampaignFromDbIfNeeded` atualiza memÃ³ria existente com dados do banco. Insert Supabase com falha agora loga erro. Ver `doc/LOG-2026-03-28__140000__disparos-backup-local-sync-supabase-startup.md`.

**Supabase `disparos_campaigns` inexistente (42P01):** DDL em `doc/SQL-2026-03-28__create-disparos-campaigns-only.sql` ou final de `doc/SQL-2026-03-21__create-disparos-tables.sql`. Ver `doc/LOG-2026-03-28__103000__supabase-disparos-campaigns-ddl.md`.

**Disparador â€” campanha apÃ³s restart:** no `app.listen`, `hydrateRunningCampaignsFromDbOnStartup` reidrata campanhas `running` do Supabase para memÃ³ria (leads + tick). **Ajuste de snapshot sem recriar campanha:** `PATCH /disparos/campanhas/:id/config` (corpo parcial, merge + `parseDisparosConfig`). RecuperaÃ§Ã£o se Â«sumiuÂ» sÃ³ na UI: ver linha em `disparos_campaigns`; se nÃ£o existir no banco, nÃ£o hÃ¡ reconstruct automÃ¡tico. Ver `doc/LOG-2026-03-28__102150__disparador-recuperar-campanha-supabase-hydrate-config.md`.

**Disparador SeÃ§Ã£o 1:** lista **NÃºmeros disponÃ­veis** (`syncDisparadorNumberPicker`) filtra por `getInstanceUsage(name).useDisparador`; apÃ³s salvar uso em `saveInstanceUsageConfig`, o picker Ã© atualizado. Ver `doc/LOG-2026-03-28__101200__disparador-picker-filtra-uso-disparador.md`.

**Lista campanhas Disparador:** `disparadorInstances` â€” **rÃ³tulo** = coluna **Nome da InstÃ¢ncia** no front: `instanceAlias || instanceName` (`data/instance-aliases.json` â†’ chave), **nÃ£o** Nome (WhatsApp). **nameKeys** continua rico para casar snapshot. Ver `doc/LOG-2026-03-28__100500__disparador-tags-nome-instancia-coluna-alias.md`.

---

**DiagnÃ³stico Disparador:** `/disparos/diagnostico` informa **fora do expediente** com **previsÃ£o de retorno** (global e por campanha). **Removido** o rÃ³tulo Â«modo aiÂ» do log (evita confusÃ£o com o **aquecedor**, que usa mensagens do banco). Ver `doc/LOG-2026-03-28__093000__diagnostico-remove-modo-ai-label.md`.

---

2026-03-27

**Disparador â€” expediente no tick:** Antes, sÃ³ o diagnÃ³stico (`/disparos/diagnostico`) usava `isDisparosWindowOpen`; o tick (`runCampaignDispatchTick`) enviava sem checar janela. Agora cada campanha `running` sÃ³ dispara dentro de `workingDays` + `startHour`/`endHour` do **`configSnapshot`**, com relÃ³gio `nowInSaoPaulo()`. Ver `doc/LOG-2026-03-27__193000__disparo-respeitar-expediente-config-snapshot.md`.

Palavras-chave: `isDisparosWindowOpen`, `runCampaignDispatchTick`, expediente-disparador

---

**Modal Registrar instÃ¢ncia â€” Gerar QRCode Â«mortoÂ»:** `#register-instance-overlay` com `z-index: 2600` para ficar acima de outros overlays; cliques em **Gerar QRCode** / **Atualizar QRCode** tratados por **delegaÃ§Ã£o** no overlay + `console.info` diagnÃ³stico; fim de retorno silencioso quando o DOM do modal estÃ¡ incompleto. Ver `doc/LOG-2026-03-27__190000__fix-modal-gerar-qrcode-clique-morto.md`.

Palavras-chave: `register-qrcode-btn`, `register-instance-overlay`, delegaÃ§Ã£o-clique

---

**Ambiente 3000 â€” manutenÃ§Ã£o:** `MAINTENANCE_MODE=true` bloqueia uso normal da API e da home (HTML 503); probes `GET /health` (200), `GET /ready` (503 em manutenÃ§Ã£o), `GET /service/maintenance` (JSON). Script `npm run start:prod:maintenance` (porta 3000, sem processamento em background). Ver `doc/LOG-2026-03-27__181500__ambiente-3000-modo-manutencao.md`.

Palavras-chave: `MAINTENANCE_MODE`, `start:prod:maintenance`, `/ready`, `/health`

---

**Fechamento (Atualize tudo):** commit `bb96f1c` enviado para `origin/master`; `npm run build` executado; backup seletivo via `C:\Scripts\backup-d-para-e.ps1` (robocopy longo; logs em `D:\Backup-Logs`). Working tree limpo exceto `shortener-waba.zip` nÃ£o rastreado.

Palavras-chave: `atualize-tudo`, `git-push`, `npm-run-build`, `backup-d-para-e`

---

Resumo desta retomada:
- **Embedded Signup**: botÃ£o Â«Conectar com MetaÂ»; rotas `GET /meta-oficial/embedded-signup/config`, `POST .../exchange-code`, `POST .../subscribe-webhooks`; env `META_APP_ID`, `META_APP_SECRET`, `META_ES_CONFIG_ID`; SDK + `FB.login` com `config_id`; listener `WA_EMBEDDED_SIGNUP`.
- **Tokens Meta via API**: rotas `POST /meta-oficial/tokens/app-access` (client_credentials) e `POST /meta-oficial/tokens/system-user-access` (HMAC `appsecret_proof` + `/{systemUserId}/access_tokens`). UI Ativos com passos **1.a** e **1.b**; token System User preenche etapa 2.
- **API Meta â€“ Ativos**: tÃ­tulo do painel alterado para **API Meta - Ativos**.
- **Layout duplex (tipo VisÃ£o Geral)**: aba Ativos com **trÃªs linhas** esquerda/direita: (1) criaÃ§Ã£o de app Ã— **Apps criados** + `Atualizar lista` â†’ `/subscribed_apps`; (2) integraÃ§Ã£o Ã— **Chave API integrada** (WABA + token mascarado + status); (3) integrar nÃºmeros Ã— **NÃºmeros integrados** (`meta-phone-list`). **Padding** do painel reduzido (`.meta-ativos-main-panel`).
- **Checklist onboarding**: removido o bloco largo no painel; checklist em **dock flutuante** (`#meta-guide-dock`), recolhido por padrÃ£o, chip **x/6**, visÃ­vel nas trÃªs abas Meta; em telas estreitas ocupa a largura Ãºtil com **safe-area**; recolhimento persistido em `waba.meta.guide.dockCollapsed`; tecla **Escape** recolhe quando expandido.
- **Caminho SOMA Credit Sales** (memo): `D:\SOMA Promotora\soma-credit-sales` â€” ver seÃ§Ã£o **Caminhos (repositÃ³rios prÃ³ximos)** no inÃ­cio deste arquivo.

Palavras-chave:
- embedded-signup, META_ES_CONFIG_ID, meta-oficial-tokens-app-access, meta-oficial-tokens-system-user-access, meta-ativos-duplex, meta-apps-list, meta-integration-key-list, meta-guide-dock, api-meta-ativos, soma-credit-sales

---

2026-03-26

Resumo desta retomada:
- **EncurtadorPro**: para evitar shortUrl repetido e contaminaÃ§Ã£o do relatÃ³rio, quando `ENCURTADORPRO_CUSTOM_ALIAS` nÃ£o estÃ¡ definido, o backend agora deriva `payload.custom` a partir do `_n8n_link_nonce` presente no `longUrl`.

Palavras-chave:
- encurtadorpro custom alias, anti-dedup, nonce

---

2026-03-27

Resumo desta retomada:
- **Backup seletivo para `E:\`**: rotina alterada para espelhar somente `H:\Meu Drive\Drive Profissional`, `D:\Projeto Bruno LV`, `D:\Site Credilix`, `D:\SOMA Promotora` e `D:\Waba`.
- **AutomaÃ§Ã£o Windows**: tarefa `Backup D para E (12h)` atualizada para executar `C:\Scripts\backup-d-para-e.ps1`.
- **Limpeza de raiz `E:\`**: removidos diretÃ³rios extras (`Backup-E`, `data`, `found.000` e arquivo de log avulso), com duas pendÃªncias por bloqueio/permissÃ£o (`Backup-Logs` e `Meu drive Profissional`).

Palavras-chave:
- backup-seletivo-e, backup-d-para-e, limpeza-raiz-e, schtasks, robocopy-mir

---

2026-03-26

Resumo desta retomada:
- **UI header**: adicionada estratÃ©gia de fallback local (SVG inline) para o logo Drax quando a URL externa falhar.

Palavras-chave:
- logo-drax, fallback-svg, onerror

---

2026-03-26

Resumo desta retomada:
- **ConversÃ£o (cliques) / RelatÃ³rio**: corrigido parser do EncurtadorPro para `?short=` (cliques ficam em `data.clicks`, nÃ£o em `payload.clicks`).
- **ConversÃ£o**: agora soma `clicks` por `shortUrl` Ãºnico e calcula `totalCliques / enviadosComSucesso`.
- **UI**: a conversÃ£o passou a aparecer tambÃ©m no **grÃ¡fico de barras** via item `funnel` com `isConversion=true`.

Palavras-chave:
- conversao-cliques, encurtadorpro-data-clicks, funnel-conversao

---

2026-03-26

Resumo desta retomada:
- **RelatÃ³rio de campanha**: adicionado indicador de **ConversÃ£o (cliques)** no Disparador, calculado por `clicaramNoLink / enviadosComSucesso`.
- **Backend**: relatÃ³rio agora retorna `clicaramNoLink`, `conversaoPercent`, `conversaoTexto` e cobertura de checagem de cliques.
- **UI**: modal de relatÃ³rio mostra card de conversÃ£o e aviso quando a checagem de cliques foi parcial por limite de rate.

Palavras-chave:
- conversao-cliques, relatorio-campanha, encurtadorpro, enviados-vs-cliques

---

2026-03-26

Resumo desta retomada:
- **ConversÃ£o/RelatÃ³rio**: evitar reuso do mesmo shortUrl pelo EncurtadorPro adicionando `_n8n_link_nonce` ao `longUrl` por lead/teste.
- Objetivo: cliques do relatÃ³rio refletirem melhor o teste recente (evitar acÃºmulo de cliques histÃ³ricos).

Palavras-chave:
- encurtadorpro, shortUrl-reuse, anti-reuse-nonce, longUrl-nonce

---

2026-03-26

Resumo desta retomada:
- **Disparador / Encurtador**: integrado provider `encurtadorpro` no backend (`/disparos/shorten` e geraÃ§Ã£o de mensagem IA), com timeout e retry para chamadas externas.
- **Fallback de resiliÃªncia**: ordem automÃ¡tica `encurtadorpro -> is.gd -> tinyurl` quando `ENCURTADORPRO_API_KEY` estÃ¡ configurada.
- **UI/config**: rÃ³tulo do provider atualizado para EncurtadorPro e lista de providers expandida em `GET /disparos/config`.

Palavras-chave:
- encurtadorpro, shortener-provider, disparos-shorten, retry-backoff

---

2026-03-26

Resumo desta retomada:
- **Backup operacional**: rotina corrigida para espelho da raiz `D:\` em `E:\` (objetivo de operar projetos pela `E:\` quando `D:\` estiver offline).
- **Agendamento**: tarefa `Backup D para E (12h)` criada e tarefa antiga invertida removida.
- **Script**: `C:\Scripts\backup-d-para-e.ps1` com exclusao de lixo/sistema (`$RECYCLE.BIN` e `System Volume Information`) e logs em `E:\Backup-Logs`.

Palavras-chave:
- backup-disco, espelho-d-para-e, schtasks, robocopy

---

2026-03-26

Resumo desta retomada:
- **Shortener (Windows/Node 24)**: removida dependencia nativa `better-sqlite3`; persistencia migrada para arquivo JSON (`DATA_PATH`, padrao `/data/shortener.json`) com indice em memoria por `slug`.
- **Validacao**: `npm install` concluido com sucesso e smoke test OK (`GET /health` e `GET /ready`).

Palavras-chave:
- shortener-json-store, remove-better-sqlite3, node24-windows-fix, data-path

---

2026-03-26

Resumo desta retomada:
- **Shortener (Waba)**: backup espelho executado para `E:\Backup-Waba\shortener-waba` com log em `E:\Backup-Logs`.
- **Atualize tudo (encurtador)**: projeto nao possui script `build`; `npm install` falhou em `better-sqlite3` no Node 24 por falta de toolchain C++/Visual Studio.

Palavras-chave:
- shortener-waba, backup-para-e, robocopy, better-sqlite3, node24, build-tools

---

2026-03-25

Resumo desta retomada:
- **Atualize tudo**: `npm run build` executado; `dist/` sincronizado; documentaÃ§Ã£o atualizada (log + memÃ³ria); pronto para `git add/commit/push`.
- **Rule â€œAtualize tudoâ€**: agora inclui rotina de **backup espelho fiel** **E:\ â†’ D:\Backup-E** (script `C:\Scripts\backup-e-para-d.ps1`, logs em `D:\Backup-Logs`, tarefa â€œBackup E para D (12h)â€).

Palavras-chave:
- atualize-tudo, build, dist, git commit, git push, backup, robocopy, schtasks, E para D

---

2026-03-24

Resumo desta retomada:
- **Campanha / UX**: legenda duplicatas com `font-weight: 400` (sem negrito); toast info â€œCriando campanhaâ€¦â€ e espera antes do POST = **8s**.

---

2026-03-24

Resumo desta retomada:
- **Campanha / criar apÃ³s mapear**: modal fecha primeiro; legenda duplicados (ou â€œnenhum duplicadoâ€ em verde); toast info 4s â€œCriando campanhaâ€¦â€; depois POST e `resetDisparosPanelToOriginalAfterCampaignCreate` + lista campanhas.

---

2026-03-24

Resumo desta retomada:
- **Card InstÃ¢ncia ativa**: exibe instÃ¢ncia sÃ³ se existir campanha `running` (`disparosHasRunningCampaign`); senÃ£o `â€”` e subtÃ­tulo vazio, sem request a `next-instance`.

---

2026-03-24

Resumo desta retomada:
- **Card InstÃ¢ncia ativa / Disparos**: `GET /disparos/next-instance` aceita `instances=` (lista da UI) e `preview=1` (nÃ£o incrementa contador). Cliente envia seleÃ§Ã£o de `#dis-selected-instances` para o card bater com a lista exibida.

Palavras-chave:
- next-instance, preview, instances query

---

2026-03-24

Resumo desta retomada:
- **Campanha / importaÃ§Ã£o**: legenda vermelha `#dis-campaign-dedupe-caption` com total de **duplicados excluÃ­dos** (coluna no modal + confirmaÃ§Ã£o com `duplicatesRemoved`).

---

2026-03-24

Resumo desta retomada:
- **Campanhas / instÃ¢ncias**: disparos usam **somente** `configSnapshot.selectedDisparadorInstances` (interseÃ§Ã£o com conectadas + uso Disparador). Lista vazia no snapshot nÃ£o cai mais em â€œtodas elegÃ­veisâ€. CriaÃ§Ã£o de campanha exige **â‰¥1** instÃ¢ncia selecionada (API + UI).

Palavras-chave:
- pickDisparadorInstanceForConfig, selectedDisparadorInstances

---

2026-03-24

Resumo desta retomada:
- **Disparos / card InstÃ¢ncias selecionadas**: subtÃ­tulo com instÃ¢ncias na lista â†’ **Total sendo utilizadas**; sem seleÃ§Ã£o â†’ **Nenhuma selecionada Â· API usa todas elegÃ­veis** (`disparos-selecionadas-sub`).

---

2026-03-24

Resumo desta retomada:
- **Campanhas / RelatÃ³rio**: botÃ£o **RelatÃ³rio** na lista sÃ³ aparece com status **`finished`** (`loadDisparosTemplates`, `isFinished`).

Palavras-chave:
- btn-campaign-report, campanha finalizada

---

2026-03-24

Resumo desta retomada:
- **Campanhas Disparador**: lista importada com **deduplicaÃ§Ã£o** por telefone normalizado (`deduplicateCampaignDestinationPhones`); **1 mensagem por destino** (1 lead por nÃºmero); campanha **finalizada** quando nÃ£o hÃ¡ pendentes; nÃ£o reativa campanha `finished` (409); API lista com **`processedCount`** e progresso por processados (sucesso + falha).

Palavras-chave:
- deduplicateCampaignDestinationPhones, processedCount, duplicatesRemoved

---

2026-03-24

Resumo desta retomada:
- **Disparos / InstÃ¢ncia da vez**: `#disparos-instancia-ativa` mostra rÃ³tulo alinhado ao seletor (`instanceAlias` â†’ `instanceLabel` â†’ tÃ©cnico). Cache `disparosNextInstanceTechnicalCache`; `refreshDisparosActiveInstanceFromServer` chama `/disparos/next-instance`; `refreshDisparosActiveInstanceCardLabelOnly` reaplica apÃ³s `carregar` / `updateLocalInstanceLabels` sem novo GET.

Palavras-chave:
- disparos-instancia-ativa, disparosNextInstanceTechnicalCache, refreshDisparosActiveInstanceCardLabelOnly

---

2026-03-24

Resumo desta retomada:
- **Disparos / resumo**: card **InstÃ¢ncias selecionadas** (antes do Round-robin), `#disparos-selecionadas-count`, atualizado por `updateDisparosSelectedInstancesSummaryCard` (sync lista, mover nÃºmeros, polling campanhas).

---

2026-03-24

Resumo desta retomada:
- **RelatÃ³rio de campanha**: botÃ£o **RelatÃ³rio** por campanha â†’ modal com totais, texto sobre nÃºmeros errados, funil em barras; **GET `/disparos/campanhas/:id/relatorio`**. Falhas de envio marcam lead como `failed` com `failureKind` (invÃ¡lido / destino / tÃ©cnico) e avanÃ§am fila.

Palavras-chave:
- relatorio, persistLeadFailed, failureKind, dis-campaign-report-overlay

---

2026-03-24

Resumo desta retomada:
- **Disparador â€” DiagnÃ³stico**: botÃ£o ao lado de **Campanhas**; **GET `/disparos/diagnostico`** (janela expediente, resumo da config, EVO elegÃ­veis, campanhas em execuÃ§Ã£o na memÃ³ria, tick ~7s); log `#disparos-diagnostico-log-list`. **`isDisparosWindowOpen`** em `src/index.ts`.

Palavras-chave:
- disparos/diagnostico, disparos-diagnostico-btn, isDisparosWindowOpen

---

2026-03-24

Resumo desta retomada:
- **Mensageiro**: **Salvar configuraÃ§Ãµes** volta a igualar Ã s outras seÃ§Ãµes (recolhe, Editar, prÃ³xima); painel da biblioteca **nÃ£o** abre mais nesse momento. Biblioteca via botÃ£o **Adicionar produto Ã  biblioteca** (`#dis-messenger-open-library-panel-btn`).

Palavras-chave:
- dis-messenger-open-library-panel-btn, hideMessengerLibrarySavePanel no save da seÃ§Ã£o 6

---

2026-03-24

Resumo desta retomada:
- **Mensageiro / teste IA**: legenda `#dis-ai-test-status` apÃ³s sucesso sÃ³ mostra **â€œMensagem gerada com sucessoâ€** (sem modelo, ms nem link curto).

Palavras-chave:
- dis-ai-test-status, testDisparosAiGeneration

---

2026-03-24

Resumo desta retomada:
- **Fix biblioteca Mensageiro (pÃ³s-gravar)**: sucesso do `POST` nÃ£o depende mais do `GET` da lista; falha no refresh nÃ£o deixa o painel aberto nem mostra â€œerro ao salvarâ€. Toast com nome, linha verde de confirmaÃ§Ã£o e fechamento do painel apÃ³s ~0,9s.

Palavras-chave:
- dis-messenger-library-feedback, messenger-products POST vs GET lista

---

2026-03-24

Resumo desta retomada:
- **Fix Mensageiro**: apÃ³s salvar seÃ§Ã£o 6 (IA), o painel de nome na biblioteca ficava **dentro do body recolhido** do accordion â€” invisÃ­vel. Agora a seÃ§Ã£o 6 **permanece aberta**, nÃ£o pula para Campanha, scroll + toast orientando â€œSalvar na bibliotecaâ€.

Palavras-chave:
- dis-messenger-library-save-wrap, dis-section-collapsed

---

2026-03-24

Resumo desta retomada:
- **Mensageiro**: biblioteca de produtos (`GET`/`POST /disparos/messenger-products`), arquivo `data/disparos-messenger-products.json`; apÃ³s salvar a seÃ§Ã£o 6 (IA), painel para nome + salvar na biblioteca; select **Novo produto** / produtos gravados preenche critÃ©rios.
- **Criar campanha** com sucesso: `resetDisparosPanelToOriginalAfterCampaignCreate()` â€” painel esquerdo (nÃºmeros, temporizador, limites, expediente, encurtador, mensageiro, modo IA) no estado inicial + `POST /disparos/config`.

Palavras-chave:
- messenger-products, disparos-messenger-products.json, dis-messenger-product-select, resetDisparosPanelToOriginalAfterCampaignCreate

---

2026-03-24

Resumo desta retomada:
- 404 em PATCH/DELETE: **hydrate** da campanha alinhado ao GET (sem exigir `config_snapshot` na query principal); snapshot buscado em query opcional.

Palavras-chave:
- hydrateCampaignFromDbIfNeeded
- config_snapshot

---

2026-03-24

Resumo desta retomada:
- Lista de campanhas (painel direito): botoes **Editar nome** (modal) e **Excluir** (modal de confirmacao). API `PATCH` e `DELETE` em `/disparos/campanhas/:id`. Mantidos Ativar/Pausar.

Palavras-chave para busca:
- campanha-editar-excluir
- PATCH disparos campanhas

---

2026-03-24

Resumo desta retomada:
- Criar campanha na UI: **upload do Excel em multipart** (`FormData` + campo `spreadsheet`); servidor le com `multer` + `xlsx`. Nao envia mais array `numbers` gigante no JSON (acaba a classe de erro `PayloadTooLarge` nesse fluxo). JSON com `numbers` mantido opcional para integracoes pequenas.

Palavras-chave para busca:
- campanha-multipart
- CAMPAIGN_UPLOAD_MAX_MB
- extractNumbersFromXlsxBuffer

---

2026-03-24

Resumo desta retomada:
- `PayloadTooLargeError`: parser JSON **dedicado** para `POST /disparos/campanhas` ate **512mb** (`CAMPAIGN_CREATE_JSON_LIMIT`); demais rotas usam `JSON_BODY_LIMIT` (padrao 10mb). Log na subida do servidor.

Palavras-chave para busca:
- CAMPAIGN_CREATE_JSON_LIMIT
- PayloadTooLargeError
- parseJsonCampaignCreate

---

2026-03-24

Resumo desta retomada:
- Express: `express.json` com limite **32mb** (env `JSON_BODY_LIMIT`) para evitar `PayloadTooLargeError` em campanhas com muitos numeros.

Palavras-chave para busca:
- JSON_BODY_LIMIT
- PayloadTooLargeError

---

2026-03-24

Resumo desta retomada:
- Modal da campanha: titulo **Mapear Arquivo**, campo de nome no modal, select de colunas sem `innerHTML` fragil, botao **Confirmar e criar campanha** com acao via delegacao no overlay.

Palavras-chave para busca:
- mapear-arquivo
- dis-campaign-modal-name
- fix-modal-campanha-select

---

2026-03-24

Resumo desta retomada:
- **Atualize tudo**: `npm run build` ok; commit `b4026f0` na `master`; `git push` sem remote configurado (configurar `origin` antes do push).
- `.gitignore` passou a ignorar `data/` (aliases / nomes de perfil locais).

Palavras-chave para busca:
- atualize-tudo
- gitignore-data

---

2026-03-24

Resumo desta retomada:
- Painel direito `Campanhas`: cada card tem botao que alterna entre **Ativar campanha** e **Pausar** conforme `status` (`running` vs pausada).
- Clique chama `POST /disparos/campanhas/:id/estado` com `{ ativa: true|false }`; lista recarrega apos sucesso.
- Polling a cada 10s na aba Disparos para atualizar progresso sem depender so do botao Atualizar.
- Backend: `POST .../estado` exige campanha existente (apos hydrate); correcao TypeScript em `mapRowToItem` (`??` com `||` entre parenteses).

Palavras-chave para busca:
- campanha-ativar-pausar
- disparos-campanhas-estado
- btn-campaign-toggle
- disparosCampaignsPollTimer

---

2026-03-23

Resumo desta retomada:
- UI InstÃ¢ncias: ajustado visual dos checkboxes de `Aquecedor` e `Disparador` para verde da paleta.
- Aplicada regra de `accent-color` para reduzir variaÃ§Ã£o visual na tabela.
- Build realizado e `dist` sincronizado.

Palavras-chave para busca:
- ui-instancias
- toggle-verde
- aquecedor-disparador-paleta

---

2026-03-24

Resumo desta retomada:
- Integrada OpenAI (Responses API) no backend para geracao de mensagens do Disparador.
- Novo endpoint `POST /disparos/gerar-mensagem-ai` com prompt estruturado por briefing/tom/publico/CTA.
- Novo endpoint `POST /disparos/teste-mensagem-ai` para gerar e enviar mensagem teste via EVO.
- Adicionados timeout e retry com backoff+jitter para falhas transitivas da API externa.

Palavras-chave para busca:
- openai-responses-api
- disparos-gerar-mensagem-ai
- disparos-teste-mensagem-ai
- retry-timeout-jitter

---

2026-03-24

Resumo desta retomada:
- UI da secao `Mensageiro` atualizada com botao para teste de geracao IA.
- Adicionado status de retorno e textarea para exibir a mensagem gerada na tela.
- Frontend conectado ao endpoint `POST /disparos/gerar-mensagem-ai`.

Palavras-chave para busca:
- mensageiro-gerar-mensagem-teste
- dis-test-ai-generate-btn
- dis-ai-test-output

---

2026-03-24

Resumo desta retomada:
- Geracao de mensagem IA no Mensageiro passou a aceitar URL de acesso e encurtar automaticamente.
- Mensagem final agora e garantida com link curto (fallback no backend se a IA nao incluir).
- UI ganhou campo de URL de acesso para teste e exibicao do link curto retornado.

Palavras-chave para busca:
- mensageiro-link-curto
- gerar-mensagem-ai-accessurl
- ensure-message-contains-link

---

2026-03-24

Resumo desta retomada:
- Criado fluxo de campanhas no Disparador com nome da campanha e importacao de numeros via Excel.
- Campanha salva com snapshot das configuracoes atuais (selecao de numeros, temporizador, limites, expediente, encurtador e mensageiro).
- Novo painel lateral de campanhas com data de inicio, nome e barra de progresso.

Palavras-chave para busca:
- campanhas-disparos
- disparos-campaigns
- importacao-excel-numeros
- progresso-campanha

---

2026-03-24

Resumo desta retomada:
- Removido input manual de URL na secao Mensageiro.
- Geracao de mensagem teste passou a usar somente a configuracao do Encurtador de URL.
- Backend agora gera `wa.me` com numero alvo configurado, encurta e injeta o link na mensagem.

Palavras-chave para busca:
- remover-input-url-mensageiro
- encurtador-config-link-automatico
- gerar-mensagem-ia-com-wa-me

---

2026-03-24

Resumo desta retomada:
- Corrigido fluxo do teste IA para nunca retornar mensagem sem link.
- Backend passou a exigir numero alvo e encurtamento obrigatorio antes de montar resposta.
- Frontend passou a enviar numero alvo atual da tela para evitar dependencia de config desatualizada.

Palavras-chave para busca:
- mensagem-teste-com-link
- encurtador-obrigatorio
- whatsapp-target-number-request

---

2026-03-24

Resumo desta retomada:
- UI da seÃ§Ã£o Campanha com dropzone estilizado (arrastar/soltar + clique).
- Overlay de processamento durante importaÃ§Ã£o da planilha e criaÃ§Ã£o da campanha.
- PrÃ©via automÃ¡tica das 10 primeiras linhas apÃ³s importar.

Palavras-chave para busca:
- ui-campanha-dropzone
- preview-planilha-10-linhas
- dis-campaign-work-overlay

---

(anterior) 2026-03-21

Resumo da retomada anterior:
- Disparador: `TTL do lock` removido da UI e movido para regra automÃ¡tica no backend.
- Regra aplicada: `lockTtlSeconds = clamp(delayMaxSeconds * 3, 180, 1800)`.
- Build concluÃ­do apÃ³s ajuste (`dist` atualizado).

Palavras-chave para busca:
- lock-ttl-auto
- backend-lock-policy
- disparos-seguranca-config

---

(anterior) 2026-03-21

Resumo da retomada anterior:
- SQL criado para provisionar tabelas do Disparador:
  - `instancias_uso_config`
  - `disparos_config`
  - `disparos_message_templates`
- Observado que o ambiente atual acessa Supabase via `service_role`, mas sem funÃ§Ã£o RPC de execuÃ§Ã£o SQL (`exec_sql`), exigindo execuÃ§Ã£o pelo SQL Editor.

Palavras-chave para busca:
- create-disparos-tables
- instancias_uso_config
- disparos_config
- disparos_message_templates

---

(anterior) 2026-03-21

Resumo da retomada anterior:
- Disparos: pÃ¡gina evoluÃ­da com formulÃ¡rio completo de variÃ¡veis do orquestrador.
- InstÃ¢ncias: novos toggles por linha para uso em `Aquecedor` e `Disparador`.
- Backend: endpoints para configuraÃ§Ã£o do disparador, fallback de prÃ³xima instÃ¢ncia, shortener e importaÃ§Ã£o de templates.
- Aquecedor passa a considerar somente instÃ¢ncias habilitadas para aquecimento.
- ImportaÃ§Ã£o de planilha com mapeamento de colunas no frontend.

Palavras-chave para busca:
- disparos-config
- instancias-uso-aquecedor-disparador
- disparos-next-instance
- disparos-shorten
- disparos-templates-import

---

(anterior) 2026-03-21

Resumo da retomada anterior:
- Criada pÃ¡gina **Disparos** com aba na navegaÃ§Ã£o (desktop e mobile).
- Layout em duas colunas: Resumo (cards placeholder) + VariÃ¡veis e regras (Ã¡rea a preencher) | Atividade recente.
- Painel pronto para receber regras, variÃ¡veis e pontos crÃ­ticos quando definidos.

Palavras-chave para busca:
- disparos
- tab-disparos
- disparos-config-area
- variaveis-regras

---

(anterior) 2026-03-20_123000

Resumo da retomada anterior:
- Aquecedor: `GET /aquecedor/diagnostico` para EVO, fila, janela e prÃ³xima combinaÃ§Ã£o.
- Envio teste ignora janela humanizada e cooldown (`runAquecedorCycle(true)`).
- Ordem das combinaÃ§Ãµes confirmada: origem fixa â†’ destinos em sequÃªncia (sem autoenvio).
- `POST /aquecedor/criar-mensagem-teste` para inserir mensagem PENDENTE na fila.
- UI: botÃµes DiagnÃ³stico e Criar mensagem teste na aba Aquecedor.

Palavras-chave para busca:
- aquecedor-diagnostico
- envio-teste-bypass
- criar-mensagem-teste
- aquecedor-combinacoes-origem-destino

---

(anterior) 2026-03-20_065503

Resumo desta retomada:
- Ajustei o backend para que `GET /dados` responda rapidamente com `503` quando Supabase nÃ£o estiver configurado e valide `rangeStart/rangeEnd` no formato `YYYY-MM-DD`.
- Adicionei timeout via `AbortController` em `GET /instancias` para evitar hangs.
- Atualizei o `build` para copiar `index.html` da raiz para `dist/index.html` automaticamente.

Palavras-chave para busca:
- supabase-config
- GET /dados
- evolution-timeout
- abortcontroller
- copy-index-html

## AtualizaÃ§Ã£o recente (UI)
- Tabs: `Dashboard` e `InstÃ¢ncias`
- Menu mobile expansivo (drawer)
- Branding DRAX: `favicon` no `head` e logo compacto no tÃ­tulo
- `GET /instancias` agora retorna `items`

Palavras-chave para buscar:
- tabs-dashboard-instancias
- mobile-drawer
- favicon
- instances-items

## AtualizaÃ§Ã£o recente (logo/favIcon)
- `favicon.ico` retornava `404`
- uso do asset real: `assets/media/favicon-light.png`

Palavras-chave para buscar:
- favicon-light
- brand-logo
- favicon-404

## AtualizaÃ§Ã£o recente (header branding)
- RemoÃ§Ã£o de inscriÃ§Ãµes visÃ­veis do header
- Uso de `Drax-logo-footer.png` no logo e favicon

Palavras-chave para buscar:
- remove-inscriptions
- Drax-logo-footer

## AtualizaÃ§Ã£o recente (refino visual)
- NavegaÃ§Ã£o de pÃ¡ginas no estilo sublinhado para aba ativa
- Layout geral mais sutil e elegante (menos glow, menos peso visual)

Palavras-chave para buscar:
- underline-tabs
- subtle-ui

## AtualizaÃ§Ã£o recente (instÃ¢ncias com avatar)
- Foto de perfil por instÃ¢ncia via `profilePicUrl`
- AtualizaÃ§Ã£o eficiente de avatar com `avatarVersion` (`updatedAt`)
- CorreÃ§Ã£o de contadores EVO: `_count.Contact` e `_count.Message`

Palavras-chave para buscar:
- profilePicUrl
- avatarVersion
- count-contact-message

## AtualizaÃ§Ã£o recente (scrollbars)
- Scrollbars globais estilizadas com paleta do projeto
- Suporte para Firefox e WebKit

Palavras-chave para buscar:
- scrollbar-theme
- webkit-scrollbar

## AtualizaÃ§Ã£o recente (Aquecedor - configuraÃ§Ã£o no sistema)
- Criada a aba `Aquecedor` com formulÃ¡rio de variÃ¡veis operacionais.
- Padrao recomendado inicia habilitado e pode ser desligado para personalizaÃ§Ã£o.
- ConfiguraÃ§Ã£o salva e carregada pelo backend (`GET/POST /aquecedor/config`).
- PersistÃªncia em tabela `aquecedor_config` com script SQL dedicado.

Palavras-chave para buscar:
- aquecedor-config
- usar-padrao-recomendado
- aquecedor-custom-config
- create-aquecedor-config-table

## AtualizaÃ§Ã£o recente (logo Drax local no git)
- Logo oficial baixada e versionada em `media/Drax-logo-footer.png`.
- ReferÃªncias no `index.html` atualizadas para caminho local (`/media/Drax-logo-footer.png`) no favicon e na logo do header.
- Build executado com cÃ³pia confirmada em `dist/media/Drax-logo-footer.png`.

Palavras-chave para buscar:
- logo-drax-local
- media-drax-logo-footer
- favicon-local
- dist-media

## AtualizaÃ§Ã£o recente (inscriÃ§Ã£o abaixo da logo)
- Header atualizado para exibir a inscriÃ§Ã£o abaixo da logo: `WABA - Sistema completo para whatsapp`.
- Estrutura visual do branding ajustada com `brand-block` e `brand-caption`, mantendo alinhamento central.
- Build executado para refletir em `dist/index.html`.

Palavras-chave para buscar:
- brand-caption
- inscricao-abaixo-logo
- waba-sistema-completo

## AtualizaÃ§Ã£o recente (logo Ã  esquerda + 15%)
- Logo do header ajustada para alinhamento Ã  esquerda.
- Tamanho da logo aumentado em ~15% (`34px` -> `39px`).
- InscriÃ§Ã£o abaixo da logo ajustada para alinhamento Ã  esquerda.

Palavras-chave para buscar:
- logo-left-align
- logo-size-39px
- brand-caption-left

## AtualizaÃ§Ã£o recente (troca de asset da logo)
- Asset da logo Drax substituÃ­do por nova versÃ£o ajustada enviada via Google Drive.
- Arquivo local atualizado em `media/Drax-logo-footer.png`.
- Build executado e sincronizado em `dist/media/Drax-logo-footer.png`.

Palavras-chave para buscar:
- logo-drax-ajustada
- update-logo-asset
- media-dist-sync

## AtualizaÃ§Ã£o recente (produÃ§Ã£o estÃ¡vel + dev isolado)
- Isolamento de runtime implementado para permitir desenvolvimento sem interromper envios.
- Novo controle por env:
  - `ENABLE_BACKGROUND_PROCESSING=true/false`
  - `RUNTIME_MODE=production/development`
- Em modo isolado (`false`), processo nÃ£o executa tick automÃ¡tico de campanhas e bloqueia inÃ­cio do aquecedor.
- Scripts adicionados:
  - `npm run start:prod` (porta 3000, processamento habilitado)
  - `npm run dev:isolado` (porta 3010, processamento desabilitado)

Palavras-chave para buscar:
- runtime-isolado
- dev-isolado
- start-prod
- evitar-disparo-duplicado

## AtualizaÃ§Ã£o recente (UI de ambientes + sidebar recolhÃ­vel)
- Faixa visual de ambiente adicionada com alternÃ¢ncia: `NÃ£o oficial` e `API oficial`.
- Estado visual do ambiente persistido em `localStorage` (`waba.integration.env`).
- NavegaÃ§Ã£o desktop convertida para menu lateral recolhÃ­vel.
- Estado do menu persistido em `localStorage` (`waba.sidebar.collapsed`) com padrÃ£o inicial recolhido.
- NavegaÃ§Ã£o mobile existente mantida.

Palavras-chave para buscar:
- integration-env-strip
- api-oficial
- menu-lateral-recolhivel
- sidebar-collapsed
- localstorage-ui

## AtualizaÃ§Ã£o recente (Ã­cones do menu lateral)
- Ãcones da navegaÃ§Ã£o lateral atualizados por contexto:
  - Dashboard `ðŸ“ˆ`
  - InstÃ¢ncias `ðŸ“±`
  - Aquecedor `ðŸ”¥`
  - Disparos `ðŸš€`
- Comportamento do menu recolhido/expandido preservado.

Palavras-chave para buscar:
- icons-sidebar
- dashboard-icon
- aquecedor-icon
- disparos-icon

## AtualizaÃ§Ã£o recente (dashboard com grÃ¡ficos mais estreitos)
- Ajustada proporÃ§Ã£o da grid desktop do Dashboard para reduzir largura da coluna de grÃ¡ficos.
- Nova proporÃ§Ã£o: `2fr / 0.82fr` (antes `1.75fr / 1fr`).
- Melhor distribuiÃ§Ã£o visual dos cards e conteÃºdo na coluna esquerda.

Palavras-chave para buscar:
- dashboard-grid
- graficos-coluna-direita
- cards-coluna-esquerda

## AtualizaÃ§Ã£o recente (Ã­cone WhatsApp no API Meta)
- BotÃ£o `API Meta` no seletor de ambiente recebeu Ã­cone do WhatsApp em verde.
- Layout do botÃ£o ajustado para exibir Ã­cone + texto com espaÃ§amento consistente.
- Comportamento de alternÃ¢ncia de ambiente mantido.

Palavras-chave para buscar:
- api-meta-whatsapp-icon
- integration-env-with-icon
- ambiente-integracao-ui

## AtualizaÃ§Ã£o recente (dropdown no menu lateral por ambiente)
- Menu lateral desktop reorganizado em dropdowns por ambiente:
  - `API Meta`: Dashboard, InstÃ¢ncias
  - `API nÃ£o oficial`: Aquecedor, Disparos
- Grupos com expansÃ£o/retraÃ§Ã£o via botÃ£o de seÃ§Ã£o.
- IntegraÃ§Ã£o com seletor de ambiente: abre automaticamente o grupo correspondente.

Palavras-chave para buscar:
- sidebar-dropdown
- menu-grupo-api-meta
- menu-grupo-api-nao-oficial
- tabs-por-ambiente

## AtualizaÃ§Ã£o recente (menu lateral consolidado em API Meta)
- Estrutura do menu lateral ajustada para um Ãºnico grupo: `API Meta`.
- Todos os menus atuais foram centralizados em `API Meta`:
  - Dashboard
  - InstÃ¢ncias
  - Aquecedor
  - Disparos
- Grupo `API nÃ£o oficial` removido do menu lateral por enquanto.

Palavras-chave para buscar:
- sidebar-api-meta-unico
- menus-em-api-meta
- dropdown-unico-lateral

## AtualizaÃ§Ã£o recente (API Meta oficial - fases 1/2/3)
- Trilha da API oficial estruturada em 3 menus:
  - `1) Ativos API`
  - `2) Templates`
  - `3) Disparo API`
- Fase 1 implementada com integraÃ§Ã£o backend + UI:
  - listar nÃºmeros (`/{wabaId}/phone_numbers`)
  - registrar nÃºmero (`/{phoneNumberId}/register`)
  - listar apps inscritos (`/{wabaId}/subscribed_apps`)
  - garantir inscriÃ§Ã£o do app em `subscribed_apps`
- Fase 2 e Fase 3 deixadas estruturadas como prÃ³ximas etapas.

Palavras-chave para buscar:
- meta-oficial-fases
- fase1-ativos-api
- message-templates-utility
- disparo-api-oficial

## AtualizaÃ§Ã£o recente (fases 2 e 3 funcionais)
- Fase 2 implementada com criaÃ§Ã£o/listagem de template utilidade:
  - `POST /meta-oficial/templates/create-utility`
  - `POST /meta-oficial/templates/list`
- Fase 3 implementada com disparo de template:
  - `POST /meta-oficial/disparo/send-template`
- Frontend das fases 2 e 3 conectado ao backend, com status e logs operacionais.

Palavras-chave para buscar:
- meta-templates-create
- meta-templates-list
- meta-send-template
- fases-api-oficial-prontas

## AtualizaÃ§Ã£o recente (validaÃ§Ã£o guiada API Meta)
- Checklist visual de onboarding implementado na trilha API Meta.
- Passos acompanham automaticamente aÃ§Ãµes das fases 1, 2 e 3.
- Estado `Pendente/ConcluÃ­do` persistido em `localStorage` para continuar apÃ³s refresh.

Palavras-chave para buscar:
- checklist-meta
- validacao-guiada
- onboarding-api-oficial
- progresso-localstorage

## AtualizaÃ§Ã£o recente (toggle de ambiente alinhado Ã  aba)
- Corrigida dessincronia na carga: o seletor API Meta / API nÃ£o oficial passa a refletir a aba realmente exibida (ex.: Dashboard â†’ API nÃ£o oficial).
- `waba.integration.env` no `localStorage` Ã© atualizado junto com a aba ativa via `syncIntegrationEnvWithTab`.

Palavras-chave para buscar:
- integration-env-sync
- toggle-ambiente-aba

## AtualizaÃ§Ã£o recente (fluxo intuitivo sem manual externo)
- Etapa de API Meta simplificada para usuÃ¡rio final nÃ£o tÃ©cnico (sem depender de leitura de documentaÃ§Ã£o).
- Novos botÃµes de execuÃ§Ã£o automÃ¡tica:
  - `Executar etapa 2 automaticamente`
  - `Finalizar ativaÃ§Ã£o automaticamente`
- Fluxo agora orienta o usuÃ¡rio por aÃ§Ã£o direta e status claro de prÃ³ximo passo.

Palavras-chave para buscar:
- fluxo-intuitivo
- onboarding-sem-manual
- etapa2-automatica
- etapa3-automatica




## 2026-04-14 - Favicon aplicado do Site Credilix

- Favicon copiado de `D:\Site Credilix\dist\favicon.png` para `E:\Waba\favicon.png`.
- `index.html` atualizado para usar `href="/favicon.png"`.
- Log relacionado: `doc/LOG-2026-04-14__131127__update-favicon-site-credilix-no-waba.md`.

### Palavras-chave

- favicon
- rel icon
- credilix

## 2026-06-08 — QR Code registrar-qrcode (Evolution create 400)

- **Sintoma:** `POST /instancias/registrar-qrcode` → 502; EVO manual create+connect OK.
- **Causa:** payload enviado ao `POST /instance/create` incluía `channel`, `token` auto-gerado e `number: ""` → Evolution **400**; connect depois **404**.
- **Fix:** `src/index.ts` — payload mínimo Evolution v2; `token`/`number` só se informados pelo cliente.
- **Próximo:** deploy `waba_disparador`; validar `POST registrar-qrcode` após build.
- **2026-06-08 (limpeza):** removidas 16 instâncias via `DELETE /instancias/:name`; mantidas **Walkup** (51997462102) e **Marcelo Pessoal** (51999666841, número pedido como Marcelo Mozart).

## 2026-06-08 — Ambientes V01 (baseline) e V02 (dev diário)

- **V01:** espelho do estado atual de produção; porta local **3011**; dados em `data/v01/`; branch `v01`.
- **V02:** desenvolvimento ativo a partir de hoje; porta **3012**; dados em `data/v02/`; branch `v02`.
- **Produção:** inalterada (`master`, VPS `waba.draxsistemas.com.br`, porta 30180).
- Código: `src/load-env.ts`, `src/data-path.ts`, scripts `dev-v01.ps1` / `dev-v02.ps1`, `npm run init:env`.
- Doc: `doc/AMBIENTES-V01-V02.md`.
- **Pendente:** serviços Easypanel `waba_disparador_v01`/`_v02` + Traefik PathPrefix; Evolution/Supabase separados por ambiente.
- **2026-06-08 (subpastas):** V01/V02 em `/version-01` e `/version-02` no mesmo domínio (`WABA_BASE_PATH`, `src/base-path.ts`). Doc Traefik: `doc/TRAEFIK-WABA-VERSION-PATHS.md`.

## 2026-06-21 — Campanha: mínimo 4 instâncias + «+ Instâncias» automático

- Regra: mínimo **4 números conectados** por campanha (`DISPAROS_CAMPAIGN_MIN_CONNECTED_INSTANCES`).
- Backend: `resolveAutoInstancesForCampaign`, `POST .../instancias { auto: true }`, `409 buy_numbers_required`.
- UI: alerta + botão «+ Instâncias» **somente** quando `instanceHealth.needsMoreInstancesForMinimum`; redireciona para aba Comprar se faltar estoque.
- Log: `doc/LOG-2026-06-21__campanha-min-instancias-auto-comprar.md`.
- **Pendente:** commit/push para produção quando usuário solicitar.

## 2026-06-21 — Regra 50% instâncias ativas (pausa por saúde)

- Mantida/restaurada na UI: campanha pausa quando **menos de 50%** das instâncias selecionadas estão ativas (`shouldPauseByDisconnectedRatio`, `>= 0.5` desconectadas).
- Status: «Pausada · Pausa manual ou automática por regra de saúde.» quando pausada por regra de saúde (50% ou mínimo 4).
- Alerta vermelho na lista: «Menos de 50% das instâncias selecionadas estão ativas (X de Y).»
- «Ativar campanha» bloqueado enquanto 50% ou mínimo 4 violados; «+ Instâncias» continua só para mínimo 4.
- Log: `doc/LOG-2026-06-21__campanha-pausa-50-porcento-saude.md`.
- **Deploy 2026-06-23:** commit `2bf3269` em `master` + `v02`; V02 local reiniciado; Actions Deploy FTP disparado.
- **Preparando → conectado imediato (2026-06-23):** promoção desacoplada do motor do aquecedor; timer 15s + ao carregar `/instancias/uso-config`. Ver `doc/LOG-2026-06-23__preparando-promocao-imediata-sem-aquecedor.md`.
- **Deploy 2026-06-23 (2):** commit `e61ae81` em `master` + `v02` — preparando promoção imediata.
- **Preparando 6h fixas (2026-06-23):** removida fila escalonada (contadores 23h–35h); 6h desde integração; bloqueio disparo+aquecedor; promoção em lote. Ver `doc/LOG-2026-06-23__preparando-6h-sem-fila-escalonada.md`.
- **Deploy 2026-06-23 (3):** commit `250a080` — preparando 6h fixas.
- **Aquecedor rotação pares (2026-06-23):** `recentDirectedEdges` + score dinâmico para variar A→B, C→A, B→C. Ver `doc/LOG-2026-06-23__aquecedor-rotacao-pares-dinamica.md`.

## 2026-06-21 — Hub UI Créditos (saldo por API + histórico + compra)

- Aba **Créditos** unifica saldo (totais + Oficial/Alternativa), histórico (compras + bonificações) e contratação PIX.
- API: `GET /billing/disparos/bonus-history`, `GET /billing/disparos/purchases`.
- Log: `doc/LOG-2026-06-21__creditos-hub-ui-historico-compras-bonus.md`.
- **Palavras-chave:** `creditos-hub`, `disparos-lancamento`, `bonus-history`, `byApi`.
- **Deploy 2026-06-24:** produção usa Docker + `dist/` no Git; commit `cb07ab2` com marker `DEPLOY-2026-06-24-creditos-hub-ui`. Ver `doc/LOG-2026-06-24__deploy-creditos-hub-dist-easypanel.md`.

## 2026-06-21 — Créditos Contratar: layout hexagonal + Aquecedor UI

- **Contratar:** `disparos-pricing-board` com cluster hexagonal (esquerda) + lanes de features/preço (direita); removido alerta amarelo e nota flutuante.
- **Aquecedor:** botão vermelho «Aquecedor Ativo» (ícone + texto); hero de status sem ícone, só texto.
- Log: `doc/LOG-2026-06-21__creditos-cards-layout-hexagonal.md`.
- **Palavras-chave:** `disparos-pricing-board`, `disparos-pricing-hex-cluster`, `Aquecedor Ativo`, `syncAquecedorStopButtonLabel`.
- **Deploy 2026-06-21:** commit `fc60968` em `master` — pricing board hexagonal e ajustes Aquecedor.

## 2026-06-21 — Tela compra referência (mock hexagonal completo)

- Layout fiel ao mock: hex badges, «Pacotes e serviços», features em cápsulas, rodapé Seguro/Performance/Flexível.
- Botões `data-disparos-contratar` preservam `openDisparosPricingModal`.
- Log: `doc/LOG-2026-06-21__creditos-tela-compra-referencia-hexagonal.md`.
- **Palavras-chave:** `disparos-pricing-benefits`, `disparos-pricing-lane-action`, mock compra créditos.
- **2026-06-21 (hex overlap):** cluster favo com hex 178–194px sobrepostos; ver `doc/LOG-2026-06-21__creditos-hex-cluster-overlap-fix.md`.
- **2026-06-21 (hex PNG):** artes PNG do usuário em `/media/disparos-hex-*.png`; ver `doc/LOG-2026-06-21__creditos-hex-png-assets-mock.md`.
- **2026-06-21 (hex cluster único):** imagem composta `disparos-hex-cluster.png` substitui 3 PNGs; ver `doc/LOG-2026-06-21__creditos-hex-cluster-imagem-unica.md`.
- **2026-06-25 (hexagono.png):** arte transparente `media/hexagono.png` (+30% tamanho UI); ver `doc/LOG-2026-06-25__creditos-hexagono-png-transparente.md`.
- **2026-06-25 (glow +20%):** hex +20% e halos verde/azul; ver `doc/LOG-2026-06-25__creditos-hexagono-glow-mais-20pct.md`.
- **2026-06-25 (hexa-corrigido):** arte `media/hexa-corrigido.png` substitui `hexagono.png` na tela Contratar.
- **2026-06-25 (fix retângulo glow):** removidas camadas CSS de luz; `mix-blend-mode: lighten` no PNG; ver `doc/LOG-2026-06-25__creditos-hex-fix-contorno-retangular.md`.
- **2026-06-25 (hexa-corrigi-2):** arte `media/hexa-corrigi-2.png` (1024×1536, ~2,2MB) na tela Contratar.
- **2026-06-25 (backdrop contratar):** luzes + véu blur + conteúdo; ver `doc/LOG-2026-06-25__creditos-contratar-backdrop-luz-blur.md`.
- **2026-06-25 (backdrop tela inteira):** `#tab-disparos-lancamento` full bleed; PNG hexa-corrigi-2 atualizado.


## 2026-07-06 — Segmento assinante + tarifador Bet (V02)

- Assinantes com `segment`: **bets** | **outros** (admin obrigatório; landing infere origem).
- **Outros:** tarifas atuais Oficial + Alternativa.
- **Bets:** tabela Oficial Bet; sem Alternativa (menu, checkout, campanhas).
- Cadastro `wabadisparos` → outros; `bet.waba.info` → bets (referer/origin ou `signupOrigin`).
- Log: `doc/LOG-2026-07-06__114500__assinante-segmento-tarifador-bet.md`.

## 2026-07-06 — Operacional: segmento filtra campanhas (V02)

- Operacional **Bets** atende só campanhas de assinantes **Bets** (mesmo plano API).
- Operacional **Outros** atende só assinantes **Outros**.
- Notificação nova campanha respeita apiKind + segmento.
- Log: `doc/LOG-2026-07-06__120000__operacional-segmento-campanhas.md`.

## 2026-07-06 — Segmento operacional: Outros (V02)

- Select **Segmento** do usuário operacional: opções **Bets** e **Outros** (valor `outros`; antes `todos`).
- Backend aceita legado `todos` e migra para `outros`.
- Branch **v02** apenas; sem deploy produção.
- Log: `doc/LOG-2026-07-06__113500__segmento-operacional-outros.md`.


- **Problema:** Docker HEALTHCHECK em `/ready` atravessava body parsers, maintenance e middlewares pesados → falhas intermitentes e restarts no Easypanel (`waba_disparador`).
- **Fix:**
  - `GET /live` — resposta mínima `ok` (200), registrada logo após `stripBasePathMiddleware`.
  - `GET /ready` — movido para a mesma posição precoce (antes de parsers/maintenance); removido handler duplicado.
  - `Dockerfile` — HEALTHCHECK usa `/live`; timeout HTTP 8000ms; docker timeout 15s; interval 45s; retries 5.
- **Marker:** `DEPLOY-2026-07-05-healthcheck-live-waba-disparador`
- **Log:** `doc/LOG-2026-07-05__fix-waba-disparador-healthcheck-live.md`
- **Validação local 2026-07-05:** `npm install` + `npm run build` OK; `GET /live` → 200 `ok`; marker `DEPLOY-2026-07-05-healthcheck-live-waba-disparador` em `/health`.
- **Produção deploy healthcheck (2026-07-05):** marker `DEPLOY-2026-07-05-healthcheck-live-waba-disparador`; serviço verde estável.
- **Fix overlay falso positivo (2026-07-05):** modal «Atualizando» disparava a cada restart do container porque `watchDeployInBackground` tratava mudança de `serverBootId` como deploy (poll 8s). Fix: gatilho por drift só via `deployMarker`; `serverBootId` só após `shuttingDown` real. Marker `DEPLOY-2026-07-05-deploy-overlay-bootid-false-alarm-fix`. Log `doc/LOG-2026-07-05__deploy-overlay-bootid-false-alarm-fix.md`.
- **Monitor de uptime unificado (2026-07-07):** `uptime-monitor.service.ts` — 15min, alerta WhatsApp + e-mail; fallback `5197462102`. Rotas admin infra.
- **Luzes de status + sininho vermelho (2026-07-07):** faixa `#admin-uptime-lights`; sininho vermelho só `walkup@walkuptec.com.br`.
- **404/flapping bet.waba.info + wabadisparos (2026-07-07/08):** scripts restore/bootstrap Traefik no VPS. Logs `144500`, `073134`, `085407`.
- **Regra Cursor study-upstream-docs (2026-07-08):** `.cursor/rules/study-upstream-docs.mdc`.


## 2026-07-10 — Purge Admin menus produção (SSH bloqueado)

- Tentativa de purge via `scripts/purge-admin-menus-production.cjs` em `/app/data` (container `waba_disparador`).
- **Bloqueio:** máquina local sem chave SSH; `Permission denied` em `srv1261237.hstgr.cloud` / `72.60.51.127`. Chave só em secret `VPS_SSH_PRIVATE_KEY`.
- `E:\Waba` inexistente; script copiado para `D:\Waba\scripts\`. Dry-run local D:\v02 com dados de teste (não apply).
- **Não** apagar `waba-financeiro-split-config.json` / `waba-billing-orders.json`.
- Keywords: `purge-admin-menus`, `VPS_SSH_PRIVATE_KEY`, `waba_disparador`.

- **2026-07-10** — Validação /health pós-purge Admin: campaignIntakes/push/settlements/tickets ainda com sizeBytes altos; só disparosLocal (~93B) parece limpo; split+billing preservados. Restart não necessário. Keywords: purge admin, dataPersistence.

## 2026-07-10 — Diagnose purge Admin producao
- Health: intakes 86KB, tickets 9.7KB, push 37KB, settlements 17KB ainda cheios; disparosLocal 93B (vazio). Purge nao aplicado (SSH). Empty JSON do script bate com repos. Catalog health nome badges errado vs waba-master-menu-seen.json.
- Keywords: purge-admin-menus, dataPersistence catalog, docker exec


## 2026-07-10 — /health purge validate
- **Bloqueio:** waba.draxsistemas.com.br/health = **502** (SPA HTML). Catalog sizeBytes nao lido.
- SSH local sem chave. Revalidar apos backend/Traefik OK.
- Keywords: health 502, purge catalog

## 2026-07-10 — Traefik bootstrap OK; bet ainda 404
- Bootstrap: Traefik 1/1 + :443; WABA /health 200; wabadisparos.com.br **200**; bet.waba.info **404** (meta DRAX → backend :30210 errado).
- Não usar HUP neste VPS; file provider hot-reload. Patch: `fix-bet-route-30211-vps.sh` sem linha HUP.
- Keywords: traefik bootstrap, bet 404, 30211, fix-bet-route, no-HUP

## 2026-07-10 — bet yaml patched, Traefik sem reload
- :30211 OK (landing Bets). Patch main.yaml OK. `ERRO: Traefik down` = filtro docker ps falso; :443 up.
- Sem HUP/force → Traefik não leu URL nova → bet continua 404. Próximo: `docker service update --force easypanel-traefik` + validar.
- Keywords: fsnotify, force traefik reload, fix-bet-route

## 2026-07-10 — force Traefik OK; bet ainda SPA 404 disparos
- Yaml: bets→30211 + Host bet. Force convergiu; :443 up; disparos/waba 200.
- Body bet = 404 idêntico a path morto em wabadisparos (não é drax-bets). Rota ativa ≠ service file esperado.
- Keywords: bet 404 paginadevendas, router steal, traefik API diagnose

## 2026-07-10 — easypanel-bets host também 404 SPA
- Sem labels Traefik nos services. Router file parece correto; Host easypanel bets via Traefik = SPA disparos.
- :30211 direto = Bets OK. Suspeita: service name `waba_bets_pv-0` não efetivo na memória.
- Fix: service único `waba_bets_landing_fix` → 30211 + force.
- Keywords: easypanel-bets 404, service name collision, landing_fix

## 2026-07-10 — ROOT: paginadevendas tem Host bets
- `https-waba_paginadevendas-0` listado com hosts bets no yaml. Rouba rota → SPA 404.
- Pós-force :443 caiu (000). Bootstrap + remover Hosts bets de *paginadevendas*.
- Keywords: cross-contamination Host, paginadevendas bet.waba, traefik 443 down

## 2026-07-10 — decontam sem efeito; suspeita mount/regen
- Extract completo: só routers bets têm Host. landing_fix no patch. HTTPS ainda SPA 404.
- Falso positivo janela 800b. Próximo: disco vs cat no container Traefik pós-force; senão emergency :30180/bets.
- Keywords: traefik mount main.yaml, easypanel regen, bet-emergency

## 2026-07-10 — entrypoints reais = http/https
- Env Traefik: ENTRYPOINTS_HTTP/HTTPS (não web/websecure). File watch OK; sem labels docker.
- Cert bet OK. Suspeita: router bets em `websecure` inativo. Fix: entryPoints https/http.
- Keywords: TRAEFIK_ENTRYPOINTS_HTTPS, websecure, entrypoint mismatch

## 2026-07-10 — BET FIXED: web/websecure → http/https
- Causa raiz confirmada: bets routers em `web`/`websecure` (inexistentes); paginadevendas em `http`/`https`.
- Patch entryPoints + file watch 8s → local/pub bet **200** + disparos 200; sem force.
- Lição: main.yaml Easypanel neste VPS só `http`/`https`. Rule UCP + scripts atualizados.
- Keywords: bet.waba.info 200, entryPoints https, websecure bug

## 2026-07-10 — Prevenção entryPoint guard
- Criado `traefik-entrypoint-guard-vps.sh` + timer 3min; autoheal/monitor/health-audit; `npm run check:traefik-entrypoints`; rule `traefik-entrypoints-http-https.mdc`; doc `TRAEFIK-ENTRYPOINTS-HTTP-HTTPS.md`.
- Instalar no VPS após push: guard `install` ou `install-vps-monitor.sh install`.
- Keywords: entrypoint guard, prevenção websecure, waba-traefik-entrypoint-guard.timer

## 2026-07-10 — Push master d22698a
- Commit/push: `fix: Traefik entryPoints http/https + guard anti-websecure` → `origin/master`.
- VPS: instalar timer com raw GitHub do guard.
- Keywords: d22698a, deploy FTP, entrypoint guard install

## 2026-07-10 — Guard OK; bet 502→200 via URL 30211
- Timer entrypoint ativo; entryPoints limpos. 502 = URL service; patch `172.17.0.1:30211/` → bet/disparos 200.
- Contingência: entryPoints SIM; URL backend 502 ainda só detecta (não auto-fix URL) — gap residual.
- Keywords: bet 502, 30211, contingência parcial

## 2026-07-10 — Guard v2 auto-fix backend
- `traefik-entrypoint-guard-vps.sh` v2: 502+`:30211` OK → força URL gateway; `fix-backend` + heal no `run`.
- Keywords: guard v2, autofix 30211, fix-backend

## 2026-07-10 — Guard v2.1 instalado e OK no VPS
- Bootstrap: Traefik 0/1 → OK; disparos/bet 200.
- Install via SHA `db98a1e`: VERSION v2.1; probe bet=200 disparos=200; :30211=200.
- Contingência entryPoints+URL ativa. Queda :443 ainda depende do bootstrap/autoheal Traefik.
- Keywords: v2.1, db98a1e, guard instalado

## 2026-07-10 — Mitigação Traefik down (pacote completo)
- Watchdog :443 45s; autoheal v3+bootstrap; uptime 5min; CF Always Online doc; SW public-pages.
- Keywords: traefik-443-watchdog, Always Online, uptime 5min


## 2026-07-13 — Cadastro wabadisparos sem ação
- Causa: SPA PV só tinha `href="#cadastro"` sem formulário.
- Fix: `pv-waba-disparador` `3826a02` — form + proxy `/api/subscribers/register`.
- Ação: Redeploy `waba_paginadevendas` no Easypanel.
- Keywords: wabadisparos cadastro, #cadastro, pv-waba-disparador

## 2026-07-14 — wabadisparos cadastro ainda antigo
- Live ainda `Comece Hoje Mesmo` + botão morto; proxy API 404.
- Fix Git OK (`3826a02`); falta rebuild `waba_paginadevendas`. Trigger push `c7fb6f0`.
- Keywords: wabadisparos cadastro, paginadevendas redeploy

## 2026-07-14 — Marker paginadevendas cadastro
- Marker: `DEPLOY-2026-07-14-paginadevendas-cadastro-form`
- Repo PV `52f6170` — `GET /api/health` + meta `waba-deploy-marker`
- Keywords: paginadevendas marker, cadastro form redeploy

## 2026-07-14 — wabadisparos 502 pós-redeploy paginadevendas
- Externo: disparos + host EP **502**; WABA/bet **200**. Classico pós-redeploy (0/1 ou backend Traefik).
- Keywords: paginadevendas 502, 30210, redeploy

## 2026-07-14 — Failed to fetch cadastro
- Causa: register WABA await SMTP/WA; fix async + CORS + fallback PV.
- Markers: `DEPLOY-2026-07-14-register-async-welcome` (WABA) + `DEPLOY-2026-07-14-cadastro-failed-to-fetch-fix` (paginadevendas)

## 2026-07-14 — Easypanel bad-gateway JSON 404
- Sintoma: `Cannot GET /api/errors/bad-gateway` = landing **502** pós-redeploy.
- Heal: `scripts/heal-paginadevendas-pos-redeploy-vps.sh`

## 2026-07-14 — Heal permanente paginadevendas
- Watch+timer `waba-paginadevendas-heal-*` — impede 502/bad-gateway pós-redeploy.
- Install: `heal-paginadevendas-pos-redeploy-vps.sh install` (VPS uma vez).

## 2026-07-14 — Regra comandos locais
- Regra global: executar comandos locais no terminal; não só listar para o usuário.


## 2026-07-17 07:39 — Estudo Traefik WABA → Soma
- Ultima estabilidade Traefik = **anti-thrash 2026-07-10** (separar healers; nao segundo Traefik).
- Camadas OK: bootstrap + 443-watchdog + entrypoint-guard; heals por app sem force.
- Soma: manter `heal-soma-gestao-vps.sh` no mesmo padrao; evitar thrash Easypanel.
- LOG: `LOG--traefik-anti-thrash-para-soma.md`
- Keywords: TRAEFIK-THRASH-443, anti-thrash, Soma heal 45s



- 2026-07-21: Heal Sinal Verde isolado — NÃO chama restore-backends; strip atômico + path unit no main.yaml; rollback se WABA cair. Scripts: heal-sinal-verde-pos-redeploy-vps.sh. Buscar: sinal-verde isolado, strip seguro, anti 404 traefik.

## 2026-08-19 11:21 — Device Cloud: ícone e laranja do Aquecer
- Fix: override CSS em `#device-cloud-warm-btn` reduz gap do ícone e aplica `#fb923c` no texto.
- Marker `DEPLOY-2026-08-19-device-cloud-warm-btn-icon-orange`
- LOG: doc/LOG-2026-08-19__112149__device-cloud-warm-btn-icon-orange-fix.md

## 2026-08-19 11:45 — Device Cloud: Aquecer integra EVO sem CONFIRMAR
- Fluxo enxuto: `registrar-qrcode` + pairing code + poll `status-conexao`; pula `validacao-inbound`.
- Alias do device + `uso-config` aquecedor; refresh Instâncias.
- Marker `DEPLOY-2026-08-19-device-cloud-aquecer-integracao-enxuta`
- LOG: doc/LOG-2026-08-19__114500__device-cloud-aquecer-integracao-enxuta.md
- Keywords: device-cloud aquecer, pairing-code, sem-confirmar, integracao-enxuta

## 2026-08-19 12:45 — Device Cloud: estilo botão Aquecer = Aquecedor
- Fundo `#231f20`, borda `#d68d54`, texto branco, chama `#ffa500`; sem `btn-qrcode`.
- Marker `DEPLOY-2026-08-19-device-cloud-aquecer-btn-estilo`
- LOG: doc/LOG-2026-08-19__124500__device-cloud-aquecer-btn-estilo-aquecedor.md

## 2026-08-19 13:05 — Device Cloud: Aquecer = menu lateral Aquecedor (correção)
- CSS espelha `#tab-btn-aquecedor.active`: `rgba(251,146,60,0.14)` fundo, borda `0.66`, texto `#f8fafc`, chama `#fb923c`.
- LOG: doc/LOG-2026-08-19__130500__device-cloud-aquecer-btn-menu-lateral.md
- Keywords: device-cloud aquecer, tab-btn-aquecedor, menu-section-accent-rgb

## 2026-08-19 13:20 — Device Cloud: lingueta Adicionar ao Aquecedor
- Substitui botão Aquecer na barra; lingueta após cadastrar número; estados idle/busy/done; pulso menu Instâncias.
- LOG: doc/LOG-2026-08-19__132000__device-cloud-lingueta-aquecedor.md
- Keywords: device-cloud lingueta, instancias-menu-pulse, aguarde um instante

## 2026-08-19 13:43 — Device Cloud: copy sem EVO + dispositivo
- UI Dispositivos: remove Evolution/EVO dos textos; device → dispositivo; Device Cloud → Dispositivos nas mensagens.
- LOG: doc/LOG-2026-08-19__134300__device-cloud-copy-sem-evo-dispositivo.md
- Keywords: device-cloud copy, dispositivo, sem-evo

## 2026-08-19 13:52 — Device Cloud: lingueta visível + sem Início
- Lingueta aparece ao abrir device; remove botão Início; marker `DEPLOY-2026-08-19-device-cloud-lingueta-tab`.
- LOG: doc/LOG-2026-08-19__135200__device-cloud-lingueta-visible-sem-inicio.md
- Keywords: lingueta visivel, sem-inicio, deploy-marker

## 2026-08-19 14:02 — Device Cloud: dist/index.html desatualizado (produção)
- Easypanel serve `dist/`; commits só na raiz não atualizavam UI. Fix: build + commit `dist/index.html` + `dist/deploy-marker.js`.
- LOG: doc/LOG-2026-08-19__140200__device-cloud-dist-index-desatualizado-fix.md
- Keywords: dist/index.html, easypanel, waba_disparador, deploy-marker

- 2026-08-21: fix CNAE modal Playwright (Leads PJ) — keywords: cnae, casadosdados, modal, leads-cnpj. LOG: LOG--leads-cnae-modal-playwright.md

- 2026-08-21: Leads PJ produção = Xvfb+headed (paridade V02). Keywords: xvfb, headless, casadosdados.

- 2026-08-21: UI Leads PJ live-pulse (sinal de vida na etapa). Marker leads-pj-live-pulse.

- 2026-08-21: Leads PJ UI maxPages 5/50 → **1000**; backend já pagina; headed 3 págs = 60 CNPJs (8069 no portal). Ver doc/LOG-2026-08-21__185359__fix-leads-pj-max-pages-1000.md

- 2026-08-23: Leads PJ mutex scrape (1 Chromium) — N jobs paralelos causavam Page crashed. Ver doc/LOG-2026-08-23__112601__fix-leads-pj-scrape-mutex-chromium.md

- 2026-08-23: Leads PJ soft-cap **2** Chromiums + stagger 20s (múltiplas extrações sem derrubar container). Marker `leads-pj-soft-cap-2`. Env: `CASADOSDADOS_MAX_CONCURRENT_SCRAPES`, `CASADOSDADOS_SCRAPE_STAGGER_MS`. LOG: `doc/LOG-2026-08-23__151123__fix-leads-pj-soft-cap-2-stagger.md`

- 2026-08-23: Leads PJ scrape paralelo de novo (como V02); removido mutex 1 Chromium. Ver doc/LOG-2026-08-23__133500__fix-leads-pj-scrape-parallel-como-v02.md

- 2026-08-23: Leads PJ CNAE harden (retries/poll) mantendo scrape paralelo. Ver doc/LOG-2026-08-23__143500__fix-leads-pj-cnae-harden-paralelo.md

- 2026-08-23: Leads PJ soft-cap **2** Chromiums + stagger 20s (múltiplas extrações sem derrubar container). Marker `leads-pj-soft-cap-2`. Env: `CASADOSDADOS_MAX_CONCURRENT_SCRAPES`, `CASADOSDADOS_SCRAPE_STAGGER_MS`. LOG: `doc/LOG-2026-08-23__151123__fix-leads-pj-soft-cap-2-stagger.md`

- 2026-08-23: Leads PJ renderer stability v1 (sem software-rasterizer off; sem scroll artificial; paginação por aria-current; sem added===0 break). Marker leads-pj-renderer-stability-v1. LOG: doc/LOG-2026-08-23__154500__fix-leads-pj-renderer-stability-v1.md

- 2026-08-23: Leads PJ renderer stability v2 (sem body.filter hasText; leitura leve pós-Pesquisar). Marker leads-pj-renderer-stability-v2.

- 2026-08-23: Leads PJ guard raspagem parcial (não enriquecer 140 de ~8k). Endpoint resume-scrape. Marker leads-pj-partial-scrape-guard.

- 2026-08-23: Excluir Leads PJ purga slot Chromium + bloqueia recreate do pool. Marker leads-pj-delete-purge-v1.

- 2026-08-23: Leads PJ retoma cópia após crash/stall (checkpoint + watchdog 90s). Marker leads-pj-resume-on-stall-v1.
