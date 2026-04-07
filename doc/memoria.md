# MemÃ³ria Consolidada do Projeto

Este arquivo Ã© atualizado a cada tarefa executada.

Como usar:
- Antes de iniciar mudanÃ§as, procure aqui palavras-chave do pedido.
- Se necessÃ¡rio, leia os `doc/LOG-*.md` correspondentes para detalhes.

## Caminhos (repositÃ³rios prÃ³ximos)
- **PÃ¡gina vendas SOMA (remoto)**: [github.com/walkup-tec/Pagina-vendas-soma](https://github.com/walkup-tec/Pagina-vendas-soma) â€” pasta local `D:\SOMA Promotora\Pagina-Vendas`
- **SOMA Credit Sales** (cÃ³pia de trabalho anterior, mesmo stack): `D:\SOMA Promotora\soma-credit-sales`

Ãšltima atualizaÃ§Ã£o: (gerenciado automaticamente)

## Ãšltima atualizaÃ§Ã£o
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



