# MemÃ³ria Consolidada do Projeto

Este arquivo Ã© atualizado a cada tarefa executada.

Como usar:
- Antes de iniciar mudanÃ§as, procure aqui palavras-chave do pedido.
- Se necessÃ¡rio, leia os `doc/LOG-*.md` correspondentes para detalhes.

## Caminhos (repositÃ³rios prÃ³ximos)
- **PÃ¡gina vendas SOMA (remoto)**: [github.com/walkup-tec/Pagina-vendas-soma](https://github.com/walkup-tec/Pagina-vendas-soma) â€” pasta local `D:\SOMA Promotora\Pagina-Vendas`
- **SOMA Credit Sales** (cÃ³pia de trabalho anterior, mesmo stack): `D:\SOMA Promotora\soma-credit-sales`

Ãšltima atualizaÃ§Ã£o: (gerenciado automaticamente)

## Última atualização
2026-06-21

**WABA — Typebot monitor Asaas (paridade):** implementado em `D:\typebot-Saas` serviço `api`. Ver `doc/LOG-2026-06-21__typebot-asaas-monitor-paridade-waba.md` e typebot `doc/LOG-2026-06-21__typebot-asaas-monitor-verificacao-diaria.md`.

**WABA — Monitor Asaas diário:** 2 verificações/dia (08:00 e 20:00 SP), alerta WhatsApp instância 5197462102 + e-mail walkup@walkuptec.com.br. Ver `doc/LOG-2026-06-21__asaas-monitor-verificacao-diaria.md`.

**WABA — Env Asaas completo (Easypanel):** bloco produção em `.env`, `.env.v02` e `env.easypanel-producao-asaas.snippet` (gitignored). Inclui `ASAAS_TRANSFER_API_KEY`, `ASAAS_TRANSFER_WEBHOOK_ACCESS_TOKEN`, split payout. Ver `doc/LOG-2026-06-21__env-asaas-completo-easypanel.md`.

**WABA — Webhooks Asaas fila pausada:** HTTP 200 async, token multi-header, bypass manutenção transfer-auth. Ver `doc/LOG-2026-06-21__fix-asaas-webhook-fila-pausada.md`.

2026-06-21 pedido usuário; `git revert cd9de58` (a90a466). Lifecycle voltou ao comportamento original. Ver `doc/LOG-2026-06-21__revert-lifecycle-preparando-fix.md`.

**WABA — Ícones API Oficial/Alternativa:** helpers `renderWabaApiKindLabelHtml` + `data-waba-api-kind` em todo o UI; WhatsApp verde e foguete azul. Ver `doc/LOG-2026-06-21__icones-api-oficial-alternativa-sistema.md`.

**WABA — Créditos Contratar sem saldo nos cards:** removido «Seu saldo» dos cards de compra; saldo só na aba Histórico. Ver `doc/LOG-2026-06-21__creditos-contratar-sem-saldo-cards.md`.

**WABA — Ícone Aquecedor (foguinho laranja):** `renderWabaAquecedorLabelHtml` + chama `#fb923c` em labels do produto. Ver `doc/LOG-2026-06-21__icone-aquecedor-foguinho-laranja.md`.

2026-06-24

**WABA — Aquecedor start duplo clique:** pin UI + persist antes do motor; status com worker lease. Marker `DEPLOY-2026-06-24-aquecedor-start-double-click-fix`. Ver `doc/LOG-2026-06-24__aquecedor-start-duplo-clique-fix.md`.

**WABA — Créditos hub compra no topo:** saldo na aba Histórico; Contratar só cards API. Ver `doc/LOG-2026-06-24__creditos-hub-compra-topo-historico-saldo.md`.

**WABA — Aquecedor envio atrasado (status poll):** poll 3s não reverte mais runtime; scheduler 5–30s; fila PROCESSANDO liberada. Marker `DEPLOY-2026-06-24-aquecedor-cycle-scheduler-fix`. Ver `doc/LOG-2026-06-24__aquecedor-envio-atrasado-status-poll-fix.md`.

**WABA — Comparativo campanhas com data:** data de criação abaixo do nome no gráfico do dashboard Disparos. Ver `doc/LOG-2026-06-24__disparos-dashboard-compare-data-criacao.md`.

**WABA — Aquecedor paywall falso em deploy:** entitlement resiliente (sessionStorage + créditos + não bloquear durante loading); backend libera por saldo de créditos. Marker `DEPLOY-2026-06-24-aquecedor-entitlement-resilience`. Ver `doc/LOG-2026-06-24__aquecedor-paywall-falso-entitlement-resilience.md`.

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
