# Memória Consolidada do Projeto

Este arquivo é atualizado a cada tarefa executada.

Como usar:
- Antes de iniciar mudanças, procure aqui palavras-chave do pedido.
- Se necessário, leia os `doc/LOG-*.md` correspondentes para detalhes.

## Caminhos (repositórios próximos)
- **Página vendas SOMA (remoto)**: [github.com/walkup-tec/Pagina-vendas-soma](https://github.com/walkup-tec/Pagina-vendas-soma) — pasta local `D:\SOMA Promotora\Pagina-Vendas`
- **SOMA Credit Sales** (cópia de trabalho anterior, mesmo stack): `D:\SOMA Promotora\soma-credit-sales`
- **LV Promotora — landing estática (FTP / cópia local)**: `E:\PaginaVendas-LV` — Meta Pixel `1244070901219529`, evento `Contact` em cliques `wa.me` / `api.whatsapp.com`; WhatsApp CA `+5553991687250` (`wa.me/5553991687250`). Ver `doc/LOG-2026-04-02__150000__meta-pixel-contact-pagina-vendas-lv.md`, `doc/LOG-2026-04-02__160000__update-whatsapp-ca-pagina-vendas-lv.md`.

Última atualização: (gerenciado automaticamente)

## Última atualização
2026-04-03

**Waba — Docker (produção):** `Dockerfile` multi-stage (`node:20.18-alpine`), `CMD node dist/index.js`, `PORT` padrão 3000, volume `/app/data`, healthcheck em `/health`. Ver `doc/deploy-docker.md`.

Palavras-chave: `dockerfile-waba`, `easypanel`, `volume-app-data`

---

2026-04-02

**Waba — push do deploy FTP (Git):** commit `0b7dc2a` em `master` (workflow, `bundle:ftp`, `prepare-ftp-bundle.mjs`, docs). Se o Git falhar no **cmd** em `System32`, usar `cd /d E:\Waba` e comandos separados ou `&&`; se aparecer *dubious ownership*, `git config --global --add safe.directory E:/Waba`. Ver `doc/LOG-2026-04-02__183000__git-push-deploy-ftp-cmd-system32.md`.

Palavras-chave: `git-not-a-repository`, `System32`, `safe.directory`, `deploy-ftp-push`

---

**Waba — deploy FTP via GitHub Actions:** workflow `.github/workflows/deploy-ftp.yml` (push em `master` ou manual) roda `npm run bundle:ftp` e envia `ftp-bundle/` com `SamKirkland/FTP-Deploy-Action`; secrets `FTP_HOST`, `FTP_USERNAME`, `FTP_PASSWORD`, `FTP_REMOTE_DIR`. Ver `doc/deploy-ftp-github.md`.

Palavras-chave: `github-actions-ftp`, `bundle:ftp`, `FTP_REMOTE_DIR`

---

**Waba — API Meta Ativos:** callout explicando integração Cloud API **no navegador** (sem app no celular) e **perfis salvos** no `localStorage` (`waba.meta.integrationProfiles.v1`) para alternar token/WABA/phone_number_id. Ver `doc/LOG-2026-04-02__170500__meta-api-callout-perfis-navegador.md`.

Palavras-chave: `meta-perfis-navegador`, `embedded-signup-browser`, `integrationProfiles`

---

**PaginaVendas-LV — número CA WhatsApp:** links de conversão passam a usar `5553991687250` (+55 53 99168-7250) no bundle `index-Di-MQYWG.js`. Ver `doc/LOG-2026-04-02__160000__update-whatsapp-ca-pagina-vendas-lv.md`.

Palavras-chave: `whatsapp-ca-lv`, `5553991687250`, `PaginaVendas-LV`

---

**PaginaVendas-LV — Meta Pixel + Contact:** pixel ativo (`PageView` + `noscript`); script no `index.html` dispara `fbq('track', 'Contact')` em qualquer link `<a href>` para WhatsApp (`wa.me` ou `api.whatsapp.com`), compatível com o bundle em `/assets` sem rebuild. Ver `doc/LOG-2026-04-02__150000__meta-pixel-contact-pagina-vendas-lv.md`.

Palavras-chave: `meta-pixel-lv`, `Contact`, `PaginaVendas-LV`, `wa.me`

---

2026-04-01

**Campanhas — refinamento dos ícones de última mensagem/URL + robustez de endpoint:** ícones de ação no card migrados de emoji para SVG, com feedback explícito quando o ambiente ainda não carregou a rota nova (`404` em `ultimo-disparo`). Backend reforçado para persistir/hidratar `message_text` e `short_url` com fallback legado. Serviço local reiniciado para aplicar build. Ver `doc/LOG-2026-04-01__081600__fix-icones-campanha-e-restart-endpoint-ultimo-disparo.md`.

Palavras-chave: `icone-campanha-svg`, `ultimo-disparo-404-restart`, `message_text-short_url`

---

**Campanhas Disparador — ícones de última mensagem e última URL:** adicionados dois atalhos no card da campanha (`💬` e `↗`) abaixo dos botões de ação. `💬` abre modal com a última mensagem disparada; `↗` abre a última URL usada no disparo. Backend ganhou `GET /disparos/campanhas/:id/ultimo-disparo` e o lead enviado passou a armazenar `messageText` no estado local. Ver `doc/LOG-2026-03-31__182500__feat-campanhas-icones-ultima-mensagem-url.md`.

Palavras-chave: `campanha-ultima-mensagem`, `campanha-ultima-url`, `GET /disparos/campanhas/:id/ultimo-disparo`

---

**Disparos — diagnóstico com semântica de ciclo ativo:** texto de `proximoEnvio` foi reescrito para evitar leitura de travamento. Agora indica `ciclo em execução`, marca `intervalo operacional (normal)` no cooldown e mostra contagem regressiva `~Xs` para o próximo envio. Ver `doc/LOG-2026-03-31__181300__refactor-diagnostico-campanha-intervalo-normal.md`.

Palavras-chave: `diagnostico-intervalo-normal`, `proximoEnvio-contagem-regressiva`, `ciclo-em-execucao`

---

**Disparos — separação visual progresso vs status:** barra de progresso de campanha passou para azul, deixando o verde reservado para etapa runtime `sending`. Objetivo: evitar leitura errada de "aguardando intervalo" com aparência de envio ativo. Ver `doc/LOG-2026-03-31__180100__ux-separar-barra-progresso-da-barra-status.md`.

Palavras-chave: `separar-progresso-status-campanha`, `barra-progresso-azul`, `barra-etapa-semantica`

---

**Disparos — fix visual anti-cache na barra de etapa:** cor da barra passou a ser aplicada inline por fase (além da classe CSS), garantindo `waiting_interval` amarelo mesmo com cache/ordem de estilo. Ver `doc/LOG-2026-03-31__175300__fix-barra-etapa-inline-color-ant-cache.md`.

Palavras-chave: `inline-color-runtime-stage`, `waiting-interval-yellow-force`, `anti-cache-barra-status`

---

**Disparos — correção da barra de etapa no cooldown:** quando a campanha está `running` mas em pausa entre envios (`nextAllowedAt` futuro), a barra de etapa agora fica em `waiting_interval` (amarela) com legenda de segundos restantes. Endpoint `GET /disparos/campanhas` passou a incluir `nextAllowedAt`; fallback de UI atualizado. Ver `doc/LOG-2026-03-31__174500__fix-barra-etapa-amarela-em-aguardando-intervalo.md`.

Palavras-chave: `waiting_interval-amarelo`, `nextAllowedAt-campanhas`, `runtimeStage-fallback-cooldown`

---

**Disparos — status visual unificado pela barra de etapa:** removidos ponto/check ao lado do nome da campanha para evitar redundancia visual. A leitura de etapa operacional fica centralizada na barra runtime (`runtimeStage`) abaixo do progresso. Ver `doc/LOG-2026-03-31__123300__update-ui-remover-sinais-titulo-manter-barra-etapa.md`.

Palavras-chave: `remover-sinais-titulo-campanha`, `status-via-barra-etapa`, `runtimeStage-ui-principal`

---

**Disparos — barra de etapa runtime por campanha:** adicionada barra operacional abaixo da barra de progresso para mostrar o momento real do envio por campanha: `sending`, `waiting_interval`, `outside_window`, `paused`, `finished` e `draft`. Backend da listagem (`GET /disparos/campanhas`) agora retorna `runtimeStage` com `phase`, `label`, `detail` e `fillPercent`. Ver `doc/LOG-2026-03-31__122800__update-disparos-barra-etapa-runtime-campanhas.md`.

Palavras-chave: `runtimeStage-campanhas`, `barra-etapa-disparos`, `waiting_interval-outside_window`

---

**Campanhas Disparador — refino visual do indicador de status:** substituído badge pesado por indicador minimalista ao lado do nome (ponto para `draft/running/paused` e `check` para `finished`), mantendo as mesmas cores de estado já definidas. Ver `doc/LOG-2026-03-31__121800__refactor-ui-status-campanha-indicador-minimalista.md`.

Palavras-chave: `ui-minimalista-status-campanha`, `disparos-campaign-status-dot`, `check-azul-finalizada-refino`

---

**Campanhas Disparador — sinal de status ao lado do nome:** adicionado indicador visual ao lado do título da campanha com mapeamento fixo: `draft` cinza, `running` verde, `paused` amarelo e `finished` com `check` azul (paleta atual). Implementado via classes `.disparos-campaign-status*` no frontend da lista de campanhas. Ver `doc/LOG-2026-03-31__121000__update-campanhas-indicador-status-cores-e-check-finalizada.md`.

Palavras-chave: `status-campanha-indicador`, `disparos-campaign-status`, `check-azul-finalizada`

---

**Aquecedor — botões mínimos no runtime:** após iniciar, o bloco de ações do Aquecedor mantém somente `Pausar Aquecedor` e `Diagnóstico` (removidos `Envio teste` e `Criar mensagem teste` desse bloco). Ver `doc/LOG-2026-03-31__085951__aquecedor-runtime-botoes-minimos-pausar-diagnostico.md`.

Palavras-chave: `aquecedor-runtime-botoes`, `pausar-aquecedor`, `diagnostico`

---

**Aquecedor — indicador visual de andamento (runtime):** adicionado bloco com barra de progresso e legenda dinâmica no painel do Aquecedor. Estados cobertos: parado, processando, aguardando próximo ciclo (com contagem regressiva) e pronto para próximo ciclo. Polling de `/aquecedor/status` e renderização contínua enquanto a aba Aquecedor está ativa. Ver `doc/LOG-2026-03-31__075236__aquecedor-indicador-visual-andamento-runtime.md`.

Palavras-chave: `aquecedor-runtime-progress`, andamento-aquecedor, `renderAquecedorRuntimeProgress`

---

**Campanhas Disparador — proteção por saúde de instâncias:** campanha `running` entra em pausa automática quando mais de 50% das instâncias do snapshot estão desconectadas. UI passa a mostrar alerta e botão `+ Instâncias`; ativação fica bloqueada enquanto a regra estiver violada. Novo endpoint `POST /disparos/campanhas/:id/instancias` faz merge de instâncias na campanha. Ver `doc/LOG-2026-03-30__184837__campanhas-pausa-automatica-mais-instancias.md`.

Palavras-chave: `instanceHealth`, pausa-automatica-campanha, `POST /disparos/campanhas/:id/instancias`, `btn-campaign-add-instances`

---

**Validação obrigatória ao salvar painéis:** bloqueio de `saveAquecedorConfig` e `saveDisparosConfig` quando houver campo obrigatório vazio; no Disparador inclui também validação de instâncias selecionadas e dias de expediente. Backend reforçado em `POST /disparos/config` com `validateRequiredDisparosConfigPayload` para rejeitar payload incompleto (400). Ver `doc/LOG-2026-03-30__182653__validacao-campos-obrigatorios-paineis-save-config.md`.

Palavras-chave: `campos-obrigatorios`, `saveDisparosConfig`, `saveAquecedorConfig`, `POST /disparos/config`

---

**Disparador — migração de config legada no load:** quando `disparos_config.custom_config` vem com assinatura antiga (`90/240/60/130`), o backend agora migra automaticamente para `120/320/40/130` em `loadDisparosConfigFromDb` e persiste no Supabase. Objetivo: evitar tela com delays antigos mesmo após atualização de defaults. Ver `doc/LOG-2026-03-30__182240__migracao-config-legada-disparador-defaults.md`.

Palavras-chave: `custom_config-legada`, migracao-automatica-disparador, `loadDisparosConfigFromDb`

---

**Disparador — padrões de temporizador e limites:** `DISPAROS_DEFAULTS` em `src/index.ts`: delay **120–320** s, máx/hora **40**, máx/dia **130**; mesmos fallbacks no formulário em `index.html`; `scheduleNextCampaignDispatchDelay` usa `DISPAROS_DEFAULTS` nos fallbacks numéricos; seed em `doc/SQL-2026-03-21__create-disparos-tables.sql` alinhado. Ver `doc/LOG-2026-03-30__180306__disparador-parametros-padrao-delays-limites.md`.

Palavras-chave: `DISPAROS_DEFAULTS`, disparador-delay-min-max, max-per-hour-instance

---

2026-03-29

**Landing vendas SOMA:** GitHub [Pagina-vendas-soma](https://github.com/walkup-tec/Pagina-vendas-soma); working copy em `D:\SOMA Promotora\Pagina-Vendas`. Primeiro commit na `main` e `git push` concluídos; conteúdo copiado de `soma-credit-sales` com ajustes (`package.json` nome `pagina-vendas-soma`, README com link remoto, `.gitignore` com `!.env.example`). Build validado (`npm run build`). Ver `doc/LOG-2026-03-29__223000__pagina-vendas-soma-repo-local-github.md`.

Palavras-chave: pagina-vendas-soma, Pagina-Vendas, walkup-tec, landing-soma

---

2026-03-28

**Durabilidade (porta 3000):** campanhas → `data/disparos-local-state.json` + checkpoint periódico (`DISPAROS_CHECKPOINT_MS`, default 120s) + Supabase. Aquecedor → fila/config no Postgres + `data/runtime-intent.json` (retoma motor após restart se último comando foi «Iniciar»; `parar-envios` grava desligado). Ver `doc/garantias-durabilidade-disparador-aquecedor.md`.

**Disparador — persistência:** `data/disparos-local-state.json` (backup após mutações); na subida: `loadDisparosLocalState` + `syncDisparosCampaignsFromDbOnStartup` (até 200 campanhas do Postgres). `hydrateCampaignFromDbIfNeeded` atualiza memória existente com dados do banco. Insert Supabase com falha agora loga erro. Ver `doc/LOG-2026-03-28__140000__disparos-backup-local-sync-supabase-startup.md`.

**Supabase `disparos_campaigns` inexistente (42P01):** DDL em `doc/SQL-2026-03-28__create-disparos-campaigns-only.sql` ou final de `doc/SQL-2026-03-21__create-disparos-tables.sql`. Ver `doc/LOG-2026-03-28__103000__supabase-disparos-campaigns-ddl.md`.

**Disparador — campanha após restart:** no `app.listen`, `hydrateRunningCampaignsFromDbOnStartup` reidrata campanhas `running` do Supabase para memória (leads + tick). **Ajuste de snapshot sem recriar campanha:** `PATCH /disparos/campanhas/:id/config` (corpo parcial, merge + `parseDisparosConfig`). Recuperação se «sumiu» só na UI: ver linha em `disparos_campaigns`; se não existir no banco, não há reconstruct automático. Ver `doc/LOG-2026-03-28__102150__disparador-recuperar-campanha-supabase-hydrate-config.md`.

**Disparador Seção 1:** lista **Números disponíveis** (`syncDisparadorNumberPicker`) filtra por `getInstanceUsage(name).useDisparador`; após salvar uso em `saveInstanceUsageConfig`, o picker é atualizado. Ver `doc/LOG-2026-03-28__101200__disparador-picker-filtra-uso-disparador.md`.

**Lista campanhas Disparador:** `disparadorInstances` — **rótulo** = coluna **Nome da Instância** no front: `instanceAlias || instanceName` (`data/instance-aliases.json` → chave), **não** Nome (WhatsApp). **nameKeys** continua rico para casar snapshot. Ver `doc/LOG-2026-03-28__100500__disparador-tags-nome-instancia-coluna-alias.md`.

---

**Diagnóstico Disparador:** `/disparos/diagnostico` informa **fora do expediente** com **previsão de retorno** (global e por campanha). **Removido** o rótulo «modo ai» do log (evita confusão com o **aquecedor**, que usa mensagens do banco). Ver `doc/LOG-2026-03-28__093000__diagnostico-remove-modo-ai-label.md`.

---

2026-03-27

**Disparador — expediente no tick:** Antes, só o diagnóstico (`/disparos/diagnostico`) usava `isDisparosWindowOpen`; o tick (`runCampaignDispatchTick`) enviava sem checar janela. Agora cada campanha `running` só dispara dentro de `workingDays` + `startHour`/`endHour` do **`configSnapshot`**, com relógio `nowInSaoPaulo()`. Ver `doc/LOG-2026-03-27__193000__disparo-respeitar-expediente-config-snapshot.md`.

Palavras-chave: `isDisparosWindowOpen`, `runCampaignDispatchTick`, expediente-disparador

---

**Modal Registrar instância — Gerar QRCode «morto»:** `#register-instance-overlay` com `z-index: 2600` para ficar acima de outros overlays; cliques em **Gerar QRCode** / **Atualizar QRCode** tratados por **delegação** no overlay + `console.info` diagnóstico; fim de retorno silencioso quando o DOM do modal está incompleto. Ver `doc/LOG-2026-03-27__190000__fix-modal-gerar-qrcode-clique-morto.md`.

Palavras-chave: `register-qrcode-btn`, `register-instance-overlay`, delegação-clique

---

**Ambiente 3000 — manutenção:** `MAINTENANCE_MODE=true` bloqueia uso normal da API e da home (HTML 503); probes `GET /health` (200), `GET /ready` (503 em manutenção), `GET /service/maintenance` (JSON). Script `npm run start:prod:maintenance` (porta 3000, sem processamento em background). Ver `doc/LOG-2026-03-27__181500__ambiente-3000-modo-manutencao.md`.

Palavras-chave: `MAINTENANCE_MODE`, `start:prod:maintenance`, `/ready`, `/health`

---

**Fechamento (Atualize tudo):** commit `bb96f1c` enviado para `origin/master`; `npm run build` executado; backup seletivo via `C:\Scripts\backup-d-para-e.ps1` (robocopy longo; logs em `D:\Backup-Logs`). Working tree limpo exceto `shortener-waba.zip` não rastreado.

Palavras-chave: `atualize-tudo`, `git-push`, `npm-run-build`, `backup-d-para-e`

---

Resumo desta retomada:
- **Embedded Signup**: botão «Conectar com Meta»; rotas `GET /meta-oficial/embedded-signup/config`, `POST .../exchange-code`, `POST .../subscribe-webhooks`; env `META_APP_ID`, `META_APP_SECRET`, `META_ES_CONFIG_ID`; SDK + `FB.login` com `config_id`; listener `WA_EMBEDDED_SIGNUP`.
- **Tokens Meta via API**: rotas `POST /meta-oficial/tokens/app-access` (client_credentials) e `POST /meta-oficial/tokens/system-user-access` (HMAC `appsecret_proof` + `/{systemUserId}/access_tokens`). UI Ativos com passos **1.a** e **1.b**; token System User preenche etapa 2.
- **API Meta – Ativos**: título do painel alterado para **API Meta - Ativos**.
- **Layout duplex (tipo Visão Geral)**: aba Ativos com **três linhas** esquerda/direita: (1) criação de app × **Apps criados** + `Atualizar lista` → `/subscribed_apps`; (2) integração × **Chave API integrada** (WABA + token mascarado + status); (3) integrar números × **Números integrados** (`meta-phone-list`). **Padding** do painel reduzido (`.meta-ativos-main-panel`).
- **Checklist onboarding**: removido o bloco largo no painel; checklist em **dock flutuante** (`#meta-guide-dock`), recolhido por padrão, chip **x/6**, visível nas três abas Meta; em telas estreitas ocupa a largura útil com **safe-area**; recolhimento persistido em `waba.meta.guide.dockCollapsed`; tecla **Escape** recolhe quando expandido.
- **Caminho SOMA Credit Sales** (memo): `D:\SOMA Promotora\soma-credit-sales` — ver seção **Caminhos (repositórios próximos)** no início deste arquivo.

Palavras-chave:
- embedded-signup, META_ES_CONFIG_ID, meta-oficial-tokens-app-access, meta-oficial-tokens-system-user-access, meta-ativos-duplex, meta-apps-list, meta-integration-key-list, meta-guide-dock, api-meta-ativos, soma-credit-sales

---

2026-03-26

Resumo desta retomada:
- **EncurtadorPro**: para evitar shortUrl repetido e contaminação do relatório, quando `ENCURTADORPRO_CUSTOM_ALIAS` não está definido, o backend agora deriva `payload.custom` a partir do `_n8n_link_nonce` presente no `longUrl`.

Palavras-chave:
- encurtadorpro custom alias, anti-dedup, nonce

---

2026-03-27

Resumo desta retomada:
- **Backup seletivo para `E:\`**: rotina alterada para espelhar somente `H:\Meu Drive\Drive Profissional`, `D:\Projeto Bruno LV`, `D:\Site Credilix`, `D:\SOMA Promotora` e `D:\Waba`.
- **Automação Windows**: tarefa `Backup D para E (12h)` atualizada para executar `C:\Scripts\backup-d-para-e.ps1`.
- **Limpeza de raiz `E:\`**: removidos diretórios extras (`Backup-E`, `data`, `found.000` e arquivo de log avulso), com duas pendências por bloqueio/permissão (`Backup-Logs` e `Meu drive Profissional`).

Palavras-chave:
- backup-seletivo-e, backup-d-para-e, limpeza-raiz-e, schtasks, robocopy-mir

---

2026-03-26

Resumo desta retomada:
- **UI header**: adicionada estratégia de fallback local (SVG inline) para o logo Drax quando a URL externa falhar.

Palavras-chave:
- logo-drax, fallback-svg, onerror

---

2026-03-26

Resumo desta retomada:
- **Conversão (cliques) / Relatório**: corrigido parser do EncurtadorPro para `?short=` (cliques ficam em `data.clicks`, não em `payload.clicks`).
- **Conversão**: agora soma `clicks` por `shortUrl` único e calcula `totalCliques / enviadosComSucesso`.
- **UI**: a conversão passou a aparecer também no **gráfico de barras** via item `funnel` com `isConversion=true`.

Palavras-chave:
- conversao-cliques, encurtadorpro-data-clicks, funnel-conversao

---

2026-03-26

Resumo desta retomada:
- **Relatório de campanha**: adicionado indicador de **Conversão (cliques)** no Disparador, calculado por `clicaramNoLink / enviadosComSucesso`.
- **Backend**: relatório agora retorna `clicaramNoLink`, `conversaoPercent`, `conversaoTexto` e cobertura de checagem de cliques.
- **UI**: modal de relatório mostra card de conversão e aviso quando a checagem de cliques foi parcial por limite de rate.

Palavras-chave:
- conversao-cliques, relatorio-campanha, encurtadorpro, enviados-vs-cliques

---

2026-03-26

Resumo desta retomada:
- **Conversão/Relatório**: evitar reuso do mesmo shortUrl pelo EncurtadorPro adicionando `_n8n_link_nonce` ao `longUrl` por lead/teste.
- Objetivo: cliques do relatório refletirem melhor o teste recente (evitar acúmulo de cliques históricos).

Palavras-chave:
- encurtadorpro, shortUrl-reuse, anti-reuse-nonce, longUrl-nonce

---

2026-03-26

Resumo desta retomada:
- **Disparador / Encurtador**: integrado provider `encurtadorpro` no backend (`/disparos/shorten` e geração de mensagem IA), com timeout e retry para chamadas externas.
- **Fallback de resiliência**: ordem automática `encurtadorpro -> is.gd -> tinyurl` quando `ENCURTADORPRO_API_KEY` está configurada.
- **UI/config**: rótulo do provider atualizado para EncurtadorPro e lista de providers expandida em `GET /disparos/config`.

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
- **Atualize tudo**: `npm run build` executado; `dist/` sincronizado; documentação atualizada (log + memória); pronto para `git add/commit/push`.
- **Rule “Atualize tudo”**: agora inclui rotina de **backup espelho fiel** **E:\ → D:\Backup-E** (script `C:\Scripts\backup-e-para-d.ps1`, logs em `D:\Backup-Logs`, tarefa “Backup E para D (12h)”).

Palavras-chave:
- atualize-tudo, build, dist, git commit, git push, backup, robocopy, schtasks, E para D

---

2026-03-24

Resumo desta retomada:
- **Campanha / UX**: legenda duplicatas com `font-weight: 400` (sem negrito); toast info “Criando campanha…” e espera antes do POST = **8s**.

---

2026-03-24

Resumo desta retomada:
- **Campanha / criar após mapear**: modal fecha primeiro; legenda duplicados (ou “nenhum duplicado” em verde); toast info 4s “Criando campanha…”; depois POST e `resetDisparosPanelToOriginalAfterCampaignCreate` + lista campanhas.

---

2026-03-24

Resumo desta retomada:
- **Card Instância ativa**: exibe instância só se existir campanha `running` (`disparosHasRunningCampaign`); senão `—` e subtítulo vazio, sem request a `next-instance`.

---

2026-03-24

Resumo desta retomada:
- **Card Instância ativa / Disparos**: `GET /disparos/next-instance` aceita `instances=` (lista da UI) e `preview=1` (não incrementa contador). Cliente envia seleção de `#dis-selected-instances` para o card bater com a lista exibida.

Palavras-chave:
- next-instance, preview, instances query

---

2026-03-24

Resumo desta retomada:
- **Campanha / importação**: legenda vermelha `#dis-campaign-dedupe-caption` com total de **duplicados excluídos** (coluna no modal + confirmação com `duplicatesRemoved`).

---

2026-03-24

Resumo desta retomada:
- **Campanhas / instâncias**: disparos usam **somente** `configSnapshot.selectedDisparadorInstances` (interseção com conectadas + uso Disparador). Lista vazia no snapshot não cai mais em “todas elegíveis”. Criação de campanha exige **≥1** instância selecionada (API + UI).

Palavras-chave:
- pickDisparadorInstanceForConfig, selectedDisparadorInstances

---

2026-03-24

Resumo desta retomada:
- **Disparos / card Instâncias selecionadas**: subtítulo com instâncias na lista → **Total sendo utilizadas**; sem seleção → **Nenhuma selecionada · API usa todas elegíveis** (`disparos-selecionadas-sub`).

---

2026-03-24

Resumo desta retomada:
- **Campanhas / Relatório**: botão **Relatório** na lista só aparece com status **`finished`** (`loadDisparosTemplates`, `isFinished`).

Palavras-chave:
- btn-campaign-report, campanha finalizada

---

2026-03-24

Resumo desta retomada:
- **Campanhas Disparador**: lista importada com **deduplicação** por telefone normalizado (`deduplicateCampaignDestinationPhones`); **1 mensagem por destino** (1 lead por número); campanha **finalizada** quando não há pendentes; não reativa campanha `finished` (409); API lista com **`processedCount`** e progresso por processados (sucesso + falha).

Palavras-chave:
- deduplicateCampaignDestinationPhones, processedCount, duplicatesRemoved

---

2026-03-24

Resumo desta retomada:
- **Disparos / Instância da vez**: `#disparos-instancia-ativa` mostra rótulo alinhado ao seletor (`instanceAlias` → `instanceLabel` → técnico). Cache `disparosNextInstanceTechnicalCache`; `refreshDisparosActiveInstanceFromServer` chama `/disparos/next-instance`; `refreshDisparosActiveInstanceCardLabelOnly` reaplica após `carregar` / `updateLocalInstanceLabels` sem novo GET.

Palavras-chave:
- disparos-instancia-ativa, disparosNextInstanceTechnicalCache, refreshDisparosActiveInstanceCardLabelOnly

---

2026-03-24

Resumo desta retomada:
- **Disparos / resumo**: card **Instâncias selecionadas** (antes do Round-robin), `#disparos-selecionadas-count`, atualizado por `updateDisparosSelectedInstancesSummaryCard` (sync lista, mover números, polling campanhas).

---

2026-03-24

Resumo desta retomada:
- **Relatório de campanha**: botão **Relatório** por campanha → modal com totais, texto sobre números errados, funil em barras; **GET `/disparos/campanhas/:id/relatorio`**. Falhas de envio marcam lead como `failed` com `failureKind` (inválido / destino / técnico) e avançam fila.

Palavras-chave:
- relatorio, persistLeadFailed, failureKind, dis-campaign-report-overlay

---

2026-03-24

Resumo desta retomada:
- **Disparador — Diagnóstico**: botão ao lado de **Campanhas**; **GET `/disparos/diagnostico`** (janela expediente, resumo da config, EVO elegíveis, campanhas em execução na memória, tick ~7s); log `#disparos-diagnostico-log-list`. **`isDisparosWindowOpen`** em `src/index.ts`.

Palavras-chave:
- disparos/diagnostico, disparos-diagnostico-btn, isDisparosWindowOpen

---

2026-03-24

Resumo desta retomada:
- **Mensageiro**: **Salvar configurações** volta a igualar às outras seções (recolhe, Editar, próxima); painel da biblioteca **não** abre mais nesse momento. Biblioteca via botão **Adicionar produto à biblioteca** (`#dis-messenger-open-library-panel-btn`).

Palavras-chave:
- dis-messenger-open-library-panel-btn, hideMessengerLibrarySavePanel no save da seção 6

---

2026-03-24

Resumo desta retomada:
- **Mensageiro / teste IA**: legenda `#dis-ai-test-status` após sucesso só mostra **“Mensagem gerada com sucesso”** (sem modelo, ms nem link curto).

Palavras-chave:
- dis-ai-test-status, testDisparosAiGeneration

---

2026-03-24

Resumo desta retomada:
- **Fix biblioteca Mensageiro (pós-gravar)**: sucesso do `POST` não depende mais do `GET` da lista; falha no refresh não deixa o painel aberto nem mostra “erro ao salvar”. Toast com nome, linha verde de confirmação e fechamento do painel após ~0,9s.

Palavras-chave:
- dis-messenger-library-feedback, messenger-products POST vs GET lista

---

2026-03-24

Resumo desta retomada:
- **Fix Mensageiro**: após salvar seção 6 (IA), o painel de nome na biblioteca ficava **dentro do body recolhido** do accordion — invisível. Agora a seção 6 **permanece aberta**, não pula para Campanha, scroll + toast orientando “Salvar na biblioteca”.

Palavras-chave:
- dis-messenger-library-save-wrap, dis-section-collapsed

---

2026-03-24

Resumo desta retomada:
- **Mensageiro**: biblioteca de produtos (`GET`/`POST /disparos/messenger-products`), arquivo `data/disparos-messenger-products.json`; após salvar a seção 6 (IA), painel para nome + salvar na biblioteca; select **Novo produto** / produtos gravados preenche critérios.
- **Criar campanha** com sucesso: `resetDisparosPanelToOriginalAfterCampaignCreate()` — painel esquerdo (números, temporizador, limites, expediente, encurtador, mensageiro, modo IA) no estado inicial + `POST /disparos/config`.

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
- UI Instâncias: ajustado visual dos checkboxes de `Aquecedor` e `Disparador` para verde da paleta.
- Aplicada regra de `accent-color` para reduzir variação visual na tabela.
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
- UI da seção Campanha com dropzone estilizado (arrastar/soltar + clique).
- Overlay de processamento durante importação da planilha e criação da campanha.
- Prévia automática das 10 primeiras linhas após importar.

Palavras-chave para busca:
- ui-campanha-dropzone
- preview-planilha-10-linhas
- dis-campaign-work-overlay

---

(anterior) 2026-03-21

Resumo da retomada anterior:
- Disparador: `TTL do lock` removido da UI e movido para regra automática no backend.
- Regra aplicada: `lockTtlSeconds = clamp(delayMaxSeconds * 3, 180, 1800)`.
- Build concluído após ajuste (`dist` atualizado).

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
- Observado que o ambiente atual acessa Supabase via `service_role`, mas sem função RPC de execução SQL (`exec_sql`), exigindo execução pelo SQL Editor.

Palavras-chave para busca:
- create-disparos-tables
- instancias_uso_config
- disparos_config
- disparos_message_templates

---

(anterior) 2026-03-21

Resumo da retomada anterior:
- Disparos: página evoluída com formulário completo de variáveis do orquestrador.
- Instâncias: novos toggles por linha para uso em `Aquecedor` e `Disparador`.
- Backend: endpoints para configuração do disparador, fallback de próxima instância, shortener e importação de templates.
- Aquecedor passa a considerar somente instâncias habilitadas para aquecimento.
- Importação de planilha com mapeamento de colunas no frontend.

Palavras-chave para busca:
- disparos-config
- instancias-uso-aquecedor-disparador
- disparos-next-instance
- disparos-shorten
- disparos-templates-import

---

(anterior) 2026-03-21

Resumo da retomada anterior:
- Criada página **Disparos** com aba na navegação (desktop e mobile).
- Layout em duas colunas: Resumo (cards placeholder) + Variáveis e regras (área a preencher) | Atividade recente.
- Painel pronto para receber regras, variáveis e pontos críticos quando definidos.

Palavras-chave para busca:
- disparos
- tab-disparos
- disparos-config-area
- variaveis-regras

---

(anterior) 2026-03-20_123000

Resumo da retomada anterior:
- Aquecedor: `GET /aquecedor/diagnostico` para EVO, fila, janela e próxima combinação.
- Envio teste ignora janela humanizada e cooldown (`runAquecedorCycle(true)`).
- Ordem das combinações confirmada: origem fixa → destinos em sequência (sem autoenvio).
- `POST /aquecedor/criar-mensagem-teste` para inserir mensagem PENDENTE na fila.
- UI: botões Diagnóstico e Criar mensagem teste na aba Aquecedor.

Palavras-chave para busca:
- aquecedor-diagnostico
- envio-teste-bypass
- criar-mensagem-teste
- aquecedor-combinacoes-origem-destino

---

(anterior) 2026-03-20_065503

Resumo desta retomada:
- Ajustei o backend para que `GET /dados` responda rapidamente com `503` quando Supabase não estiver configurado e valide `rangeStart/rangeEnd` no formato `YYYY-MM-DD`.
- Adicionei timeout via `AbortController` em `GET /instancias` para evitar hangs.
- Atualizei o `build` para copiar `index.html` da raiz para `dist/index.html` automaticamente.

Palavras-chave para busca:
- supabase-config
- GET /dados
- evolution-timeout
- abortcontroller
- copy-index-html

## Atualização recente (UI)
- Tabs: `Dashboard` e `Instâncias`
- Menu mobile expansivo (drawer)
- Branding DRAX: `favicon` no `head` e logo compacto no título
- `GET /instancias` agora retorna `items`

Palavras-chave para buscar:
- tabs-dashboard-instancias
- mobile-drawer
- favicon
- instances-items

## Atualização recente (logo/favIcon)
- `favicon.ico` retornava `404`
- uso do asset real: `assets/media/favicon-light.png`

Palavras-chave para buscar:
- favicon-light
- brand-logo
- favicon-404

## Atualização recente (header branding)
- Remoção de inscrições visíveis do header
- Uso de `Drax-logo-footer.png` no logo e favicon

Palavras-chave para buscar:
- remove-inscriptions
- Drax-logo-footer

## Atualização recente (refino visual)
- Navegação de páginas no estilo sublinhado para aba ativa
- Layout geral mais sutil e elegante (menos glow, menos peso visual)

Palavras-chave para buscar:
- underline-tabs
- subtle-ui

## Atualização recente (instâncias com avatar)
- Foto de perfil por instância via `profilePicUrl`
- Atualização eficiente de avatar com `avatarVersion` (`updatedAt`)
- Correção de contadores EVO: `_count.Contact` e `_count.Message`

Palavras-chave para buscar:
- profilePicUrl
- avatarVersion
- count-contact-message

## Atualização recente (scrollbars)
- Scrollbars globais estilizadas com paleta do projeto
- Suporte para Firefox e WebKit

Palavras-chave para buscar:
- scrollbar-theme
- webkit-scrollbar

## Atualização recente (Aquecedor - configuração no sistema)
- Criada a aba `Aquecedor` com formulário de variáveis operacionais.
- Padrao recomendado inicia habilitado e pode ser desligado para personalização.
- Configuração salva e carregada pelo backend (`GET/POST /aquecedor/config`).
- Persistência em tabela `aquecedor_config` com script SQL dedicado.

Palavras-chave para buscar:
- aquecedor-config
- usar-padrao-recomendado
- aquecedor-custom-config
- create-aquecedor-config-table

## Atualização recente (logo Drax local no git)
- Logo oficial baixada e versionada em `media/Drax-logo-footer.png`.
- Referências no `index.html` atualizadas para caminho local (`/media/Drax-logo-footer.png`) no favicon e na logo do header.
- Build executado com cópia confirmada em `dist/media/Drax-logo-footer.png`.

Palavras-chave para buscar:
- logo-drax-local
- media-drax-logo-footer
- favicon-local
- dist-media

## Atualização recente (inscrição abaixo da logo)
- Header atualizado para exibir a inscrição abaixo da logo: `WABA - Sistema completo para whatsapp`.
- Estrutura visual do branding ajustada com `brand-block` e `brand-caption`, mantendo alinhamento central.
- Build executado para refletir em `dist/index.html`.

Palavras-chave para buscar:
- brand-caption
- inscricao-abaixo-logo
- waba-sistema-completo

## Atualização recente (logo à esquerda + 15%)
- Logo do header ajustada para alinhamento à esquerda.
- Tamanho da logo aumentado em ~15% (`34px` -> `39px`).
- Inscrição abaixo da logo ajustada para alinhamento à esquerda.

Palavras-chave para buscar:
- logo-left-align
- logo-size-39px
- brand-caption-left

## Atualização recente (troca de asset da logo)
- Asset da logo Drax substituído por nova versão ajustada enviada via Google Drive.
- Arquivo local atualizado em `media/Drax-logo-footer.png`.
- Build executado e sincronizado em `dist/media/Drax-logo-footer.png`.

Palavras-chave para buscar:
- logo-drax-ajustada
- update-logo-asset
- media-dist-sync

## Atualização recente (produção estável + dev isolado)
- Isolamento de runtime implementado para permitir desenvolvimento sem interromper envios.
- Novo controle por env:
  - `ENABLE_BACKGROUND_PROCESSING=true/false`
  - `RUNTIME_MODE=production/development`
- Em modo isolado (`false`), processo não executa tick automático de campanhas e bloqueia início do aquecedor.
- Scripts adicionados:
  - `npm run start:prod` (porta 3000, processamento habilitado)
  - `npm run dev:isolado` (porta 3010, processamento desabilitado)

Palavras-chave para buscar:
- runtime-isolado
- dev-isolado
- start-prod
- evitar-disparo-duplicado

## Atualização recente (UI de ambientes + sidebar recolhível)
- Faixa visual de ambiente adicionada com alternância: `Não oficial` e `API oficial`.
- Estado visual do ambiente persistido em `localStorage` (`waba.integration.env`).
- Navegação desktop convertida para menu lateral recolhível.
- Estado do menu persistido em `localStorage` (`waba.sidebar.collapsed`) com padrão inicial recolhido.
- Navegação mobile existente mantida.

Palavras-chave para buscar:
- integration-env-strip
- api-oficial
- menu-lateral-recolhivel
- sidebar-collapsed
- localstorage-ui

## Atualização recente (ícones do menu lateral)
- Ícones da navegação lateral atualizados por contexto:
  - Dashboard `📈`
  - Instâncias `📱`
  - Aquecedor `🔥`
  - Disparos `🚀`
- Comportamento do menu recolhido/expandido preservado.

Palavras-chave para buscar:
- icons-sidebar
- dashboard-icon
- aquecedor-icon
- disparos-icon

## Atualização recente (dashboard com gráficos mais estreitos)
- Ajustada proporção da grid desktop do Dashboard para reduzir largura da coluna de gráficos.
- Nova proporção: `2fr / 0.82fr` (antes `1.75fr / 1fr`).
- Melhor distribuição visual dos cards e conteúdo na coluna esquerda.

Palavras-chave para buscar:
- dashboard-grid
- graficos-coluna-direita
- cards-coluna-esquerda

## Atualização recente (ícone WhatsApp no API Meta)
- Botão `API Meta` no seletor de ambiente recebeu ícone do WhatsApp em verde.
- Layout do botão ajustado para exibir ícone + texto com espaçamento consistente.
- Comportamento de alternância de ambiente mantido.

Palavras-chave para buscar:
- api-meta-whatsapp-icon
- integration-env-with-icon
- ambiente-integracao-ui

## Atualização recente (dropdown no menu lateral por ambiente)
- Menu lateral desktop reorganizado em dropdowns por ambiente:
  - `API Meta`: Dashboard, Instâncias
  - `API não oficial`: Aquecedor, Disparos
- Grupos com expansão/retração via botão de seção.
- Integração com seletor de ambiente: abre automaticamente o grupo correspondente.

Palavras-chave para buscar:
- sidebar-dropdown
- menu-grupo-api-meta
- menu-grupo-api-nao-oficial
- tabs-por-ambiente

## Atualização recente (menu lateral consolidado em API Meta)
- Estrutura do menu lateral ajustada para um único grupo: `API Meta`.
- Todos os menus atuais foram centralizados em `API Meta`:
  - Dashboard
  - Instâncias
  - Aquecedor
  - Disparos
- Grupo `API não oficial` removido do menu lateral por enquanto.

Palavras-chave para buscar:
- sidebar-api-meta-unico
- menus-em-api-meta
- dropdown-unico-lateral

## Atualização recente (API Meta oficial - fases 1/2/3)
- Trilha da API oficial estruturada em 3 menus:
  - `1) Ativos API`
  - `2) Templates`
  - `3) Disparo API`
- Fase 1 implementada com integração backend + UI:
  - listar números (`/{wabaId}/phone_numbers`)
  - registrar número (`/{phoneNumberId}/register`)
  - listar apps inscritos (`/{wabaId}/subscribed_apps`)
  - garantir inscrição do app em `subscribed_apps`
- Fase 2 e Fase 3 deixadas estruturadas como próximas etapas.

Palavras-chave para buscar:
- meta-oficial-fases
- fase1-ativos-api
- message-templates-utility
- disparo-api-oficial

## Atualização recente (fases 2 e 3 funcionais)
- Fase 2 implementada com criação/listagem de template utilidade:
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

## Atualização recente (validação guiada API Meta)
- Checklist visual de onboarding implementado na trilha API Meta.
- Passos acompanham automaticamente ações das fases 1, 2 e 3.
- Estado `Pendente/Concluído` persistido em `localStorage` para continuar após refresh.

Palavras-chave para buscar:
- checklist-meta
- validacao-guiada
- onboarding-api-oficial
- progresso-localstorage

## Atualização recente (toggle de ambiente alinhado à aba)
- Corrigida dessincronia na carga: o seletor API Meta / API não oficial passa a refletir a aba realmente exibida (ex.: Dashboard → API não oficial).
- `waba.integration.env` no `localStorage` é atualizado junto com a aba ativa via `syncIntegrationEnvWithTab`.

Palavras-chave para buscar:
- integration-env-sync
- toggle-ambiente-aba

## Atualização recente (fluxo intuitivo sem manual externo)
- Etapa de API Meta simplificada para usuário final não técnico (sem depender de leitura de documentação).
- Novos botões de execução automática:
  - `Executar etapa 2 automaticamente`
  - `Finalizar ativação automaticamente`
- Fluxo agora orienta o usuário por ação direta e status claro de próximo passo.

Palavras-chave para buscar:
- fluxo-intuitivo
- onboarding-sem-manual
- etapa2-automatica
- etapa3-automatica

