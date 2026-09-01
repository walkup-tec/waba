# Decisões Técnicas

Registrar apenas decisões permanentes.

## Decisões

### 2026-09-01 — Assistente Utility com três opções e decisão humana

- **Decisão:** Selecionar portfólio, informar texto base e gerar três versões
  Utility quando a finalidade for elegível. A IA apenas preenche o formulário;
  revisão e submissão à Meta são humanas.
- **Motivo:** aumentar aderência às diretrizes sem prometer aprovação nem
  transformar artificialmente Marketing em Utility.
- **Impacto:** mesmas envs OpenAI, Structured Outputs, histórico GPT × Meta e
  rate limit por tenant/usuário.
- **Data:** 2026-09-01

### 2026-08-31 — Teto de instâncias na troca 1:1

- **Decisão:** Campanha configurada com N números não passa de N. «+ Instâncias» e o auto-swap só trocam vermelho por spare `open` com Proxy Brasil; o vermelho sai da seleção e `useDisparador` fica falso.
- **Motivo:** Corbans (4 chips) não pode crescer; substituto não mistura pelo perfil WhatsApp; Proxy Brasil obrigatória em quem entra e em quem dispara.
- **Impacto:** Marker `DEPLOY-2026-08-31-153000-campanha-slot-swap-proxy`.
- **Data:** 2026-08-31

### 2026-08-31 — Spare da campanha não usa nome de perfil WhatsApp

- **Decisão:** Identidade para «já está nesta campanha» / spare usa só chave EVO, alias técnico (`WB-5401`) e telefone (≥8 dígitos). Nome de perfil (`Walkup`, `Drax Sistemas`) não une chips diferentes.
- **Motivo:** `WB-5401` e `wb-9224` compartilham o perfil Walkup; o «+ Instâncias» achava que o 9224 já estava na campanha e não fazia a troca do vermelho.
- **Impacto:** Marker `DEPLOY-2026-08-31-150500-mais-instancias-spare-identity`. Redeploy EasyPanel a cargo do operador (não disparar via API).
- **Data:** 2026-08-31

### 2026-08-31 — Campanha só dispara com Proxy Brasil ligada

- **Decisão:** Instância ativa na campanha = selecionada + `connectionState=open` + `/proxy/find` enabled. Removida a exceção que permitia enviar com sessão `open` sem proxy (`open-cannot-set-proxy`). `proxy/set` em sessão já `open` continua **proibido** (derruba pareamento). Prepare de número `open` sem proxy devolve falha e pede QR **Proxy Campanha**.
- **Motivo:** A regra permanente já exigia Proxy Brasil em toda instância ativa; o atalho de 28/08 deixou a campanha disparar sem proteção.
- **Impacto:** Marker `DEPLOY-2026-08-31-114800-campanha-proxy-obrigatoria`. Após Redeploy, campanha sem Proxy pausa até reconectar no Aquecedor com Proxy Campanha. Exige Redeploy EasyPanel.
- **Data:** 2026-08-31

### 2026-08-29 — Um WhatsApp por número na transferência de campanha

- **Decisão:** Notificação de campanha (atribuição/transferência) envia **um** WhatsApp por número, não por cadastro master. Transferência usa texto próprio, não «nova campanha gerada».
- **Motivo:** Vários masters com o mesmo telefone recebiam a mesma mensagem repetida ao transferir operacional.
- **Impacto:** Marker `DEPLOY-2026-08-29-135200-master-wa-dedupe-transfer`. Exige Redeploy EasyPanel.

### 2026-08-29 — Desconectado não aparece como ativo na campanha

- **Decisão:** Chip da campanha só é verde com `connectionState=open`. Probe vazio não sobrescreve `close` do fetchInstances. `connecting` não conta como ativo.
- **Motivo:** O GET da campanha pintava de verde quando o connectionState falhava, mesmo com o número já desconectado.
- **Impacto:** Marker `DEPLOY-2026-08-29-114800-desconectado-nao-ativo`. Exige Redeploy EasyPanel.

### 2026-08-29 — Status de restrição deixa o chip apto à troca na campanha

- **Decisão:** `statusReason` 403, HTTP 403 no envio, outbound `MessageUpdate=ERROR` e tag **Restrição** (persistida) pintam o chip de vermelho e entram na troca 1:1. O tick **não** desfaz pausa/restrição desses chips. Tag explícita **não** some só porque a Evolution está `open`.
- **Motivo:** Banimento WhatsApp mantém EVO `open`; a campanha ficava com vários números travados sem enviar.
- **Impacto:** Marker `DEPLOY-2026-08-29-112500-restricao-apto-troca`. Exige Redeploy EasyPanel.

### 2026-08-29 — Embedded Signup: FB.init na Graph latest

- **Decisão:** O `graphVersion` público (FB.init / dialog/oauth) é `v26.0`, independente de `META_GRAPH_VERSION` do token exchange.
- **Motivo:** Com extras v4 já no ar, o popup continuava branco em `/v22.0/dialog/oauth`. A Graph versiona o dialog; a implementação oficial do ES pede Graph latest.
- **Impacto:** Marker `DEPLOY-2026-08-29-125800-es-fbinit-v26`. Docs: https://developers.facebook.com/docs/graph-api/guides/versioning/ e https://developers.facebook.com/docs/whatsapp/embedded-signup/implementation/
- **Data:** 2026-08-29

### 2026-08-29 — Embedded Signup v4: extras só com setup

- **Decisão:** `FB.login` envia `extras: { setup }` (vazio ou prefill). Não envia `sessionInfoVersion`.
- **Motivo:** Config Login for Business v4. A doc deixa `extras` vazio no v4; `sessionInfoVersion` é v2.
- **Impacto:** Marker `DEPLOY-2026-08-29-114200-es-v4-extras`. Sozinho **não** abriu a 2ª tela; ver decisão FB.init v26.
- **Data:** 2026-08-29

### 2026-08-28 — Inbox: um fio por contato no tenant

- **Decisão:** A lista do Inbox não filtra um único `connection_id`. O upsert reutiliza `tenant_id + contact_wa_id`. A resposta Graph usa a conexão da conversa (`connected` ou `pending_confirmation`). Status webhook sem wamid local pode abrir o fio outbound se o chip estiver ligado.
- **Motivo:** Produção já tinha o marker `121400` e a lista continuava vazia: envio/webhook gravavam em outra linha de conexão.
- **Impacto:** Marker `DEPLOY-2026-08-28-142800-inbox-tenant-thread`. Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/ e https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components/
- **Data:** 2026-08-28

### 2026-08-28 — Inbox: envio e listagem no chip ligado

- **Decisão:** Cloud API envia pelo `phone_number_id` do chip com Inbox verde. Se a conexão tiver outro ID e houver um único chip ligado, a listagem trata os dois como o mesmo canal.
- **Motivo:** O envio gravava o ID da conexão; o Inbox filtrava só o chip. A conversa não aparecia e não dava para responder.
- **Impacto:** Marker `DEPLOY-2026-08-28-121400-inbox-envio-conversa`. Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/
- **Data:** 2026-08-28

### 2026-08-28 — Nome do Inbox = nome salvo no Laboratório

- **Decisão:** Ao gravar o display name do chip, o Inbox usa esse nome (`identity.name`), não o snapshot do switch nem só o `verified_name` da Graph.
- **Motivo:** O operador atualizava o nome no Laboratório e o Inbox continuava com a razão social antiga.
- **Impacto:** Card do Laboratório segue honesto com a Graph; Inbox e banner acompanham o nome pedido. Botão **Todos** empilha acima do card do número.
- **Data:** 2026-08-28

### 2026-08-28 — Chip bloqueado no WhatsApp não fica verde na campanha

- **Decisão:** Auto-swap e cor do chip usam `statusReason` 403 / outbound ERROR / bloqueio de campanha, não só `connectionState`. Spare do tick = mesma lista do botão «+ Instâncias».
- **Motivo:** Banimento WhatsApp deixa a Evolution `open`; o 9224 continuava verde e o 2102 (`walkup`) não entrava porque o auto-swap filtrava por ownership/lifecycle.
- **Impacto:** Marker `DEPLOY-2026-08-28-110000-swap-bloqueado-2102`. Exige Redeploy EasyPanel.

### 2026-08-28 — Inbox: opt-in, número visível, webhook ao ligar

- **Decisão:** Switch cinza até `inboxEnabled === true`. O Inbox lista o telefone do chip. Ligar o switch tenta `subscribed_apps`. Inbound aceita conexão `pending_confirmation`.
- **Motivo:** O switch verde por omissão desligava no primeiro clique; a mensagem de teste não aparecia; o operador não via qual número estava no Inbox.
- **Impacto:** Produção só recebe no Inbox depois de ligar o switch. Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks/
- **Data:** 2026-08-28

### 2026-08-28 — «+ Instâncias» substitui o bloqueado, sem ir à compra

- **Decisão:** POST auto usa a mesma lista de spare do GET. Troca 1:1 só dos vermelhos. Resposta sem `buy_numbers_required`.
- **Motivo:** Docker em `083300` devolvia compra quando o probe live do spare falhava, embora a UI já mostrasse número livre (2477 vs spare).
- **Impacto:** Marker `DEPLOY-2026-08-28-093700-instancias-substitui-bloqueada`. Exige Redeploy EasyPanel.

### 2026-08-28 — Intervalo de envio da campanha 30% menor

- **Decisão:** `CAMPAIGN_SEND_INTERVAL_RATIO = 0.7` no throttle Alternativa e no wait da campanha oficial. Campanha Alternativa já running atualiza o snapshot no tick.
- **Motivo:** Throughput percebido estava baixo; o operador pediu reduzir o intervalo entre cada mensagem em 30%, sem subir o teto diário.
- **Impacto:** Marker `DEPLOY-2026-08-28-091500-intervalo-envio-menos-30`. Burst 60/14 e 100/dia inalterados.

### 2026-08-28 — Nome do chip: Graph `new_name_status` + register com PIN

- **Decisão:** O card lê `verified_name`, `new_display_name` e `new_name_status`. Não trata `{ success: true }` do POST como nome aplicado. Número Ativo com nome aprovado mostra PIN de `POST /register`. Foto do chip é cache local da Graph, nunca a URL assinada no browser.
- **Motivo:** A doc oficial exige re-registro após aprovação. A aba Profile do Manager mostra o nome pedido na hora; a coluna Name / WhatsApp só mudam depois do register. `pps.whatsapp.net` expira.
- **Impacto:** Status Em análise / Aprovado / Recusado / Atualizado. Sem o PIN o `verified_name` não troca. Docs: https://developers.facebook.com/documentation/business-messaging/whatsapp/display-names
- **Data:** 2026-08-28

### 2026-08-28 — Card do número oficial: só o que a Meta já aplicou

- **Decisão:** Nome e foto do chip no CARD 02 são os da Graph. A Drax não confirma save se a Meta recusar. Foto/descrição entram no POST do perfil. O nome visível no card (e no disparo) é o `verified_name` até register após aprovação.
- **Motivo:** O cliente do disparo vê o perfil da Cloud API, não o arquivo local do Laboratório.
- **Impacto:** Sem número Ativo ou com recusa da Graph, o save falha. Pedido novo usa `new_display_name`. Docs: https://developers.facebook.com/documentation/business-messaging/whatsapp/display-names e https://developers.facebook.com/docs/whatsapp/cloud-api/reference/business-profiles/

### 2026-08-28 — Card do portfólio: identidade local, Meta best-effort

- **Decisão:** Nome e foto do CARD 02 no Laboratório persistem em ficheiros por tenant. A Graph (`POST /{business-id}` e foto da Página) é tentada, mas o sucesso do card não depende dela.
- **Motivo:** `profile_picture_uri` do Business é só leitura. Este BM não tem Página. O token do Embedded Signup pode recusar o nome (3910).
- **Impacto:** O operador vê DRAX.png e o nome no card mesmo quando a Meta não aplica. Docs: https://developers.facebook.com/docs/marketing-api/reference/business/ e https://developers.facebook.com/docs/graph-api/reference/page/picture/

### 2026-08-24 — sendButtons: title com letras reais (sem ZWSP)

- **Decisão:** Não enviar `title` ZWSP/`""` no `sendButtons` da Alternativa. Title = primeira linha/palavras do texto; restante em `description`.
- **Motivo:** Evolution 2.4 monta `*${title}*`. Title vazio/ZWSP aparece como `**` digitado antes da mensagem.
- **Impacto:** Marker `DEPLOY-2026-08-24-alternativa-sem-asteriscos-titulo`. A primeira linha pode aparecer em negrito (wrap da Evolution).

### 2026-08-21 — Campanha: troca automática de instância desconectada

- **Decisão:** Com campanha `running`, o tick substitui cada desconectado por uma instância `open` do dono habilitada para disparos (`useDisparador` + lifecycle). Proxy desliga só no que sai e liga no que entra. «+ Instâncias» só se não houver reserva (ou campanha pausada).
- **Motivo:** O operador não deve clicar para cada queda; o botão fica para quando ele conectar um número novo.
- **Impacto:** Marker `DEPLOY-2026-08-21-campanha-auto-swap-instancias`.

### 2026-08-21 — Campanha dispara se connectionState é open

- **Decisão:** Saúde/pausa da campanha usa `connectionState` dos nomes selecionados. Pause só se o mínimo de `open` não estiver confirmado. Retoma pausa automática quando o mínimo volta. Pick de envio também usa live `open`, não só `fetchInstances`.
- **Motivo:** Seguradoras ficou pausada com `9224`/`drax` `open` na Evolution porque o WABA usava cache/lista vazia e a regra de 50% offline.
- **Impacto:** Marker `DEPLOY-2026-08-21-campanha-open-deve-enviar`.

### 2026-08-21 — Reconexão apaga EVO antigo; preserva foguinhos e totais

- **Decisão:** Ao reconectar um número, apagar clones e sessão antiga na Evolution e restos dos clones no WABA. Manter lifecycle (foguinhos) e `logs_envios` (totais). Sem `forceNewIntegration` nessa reconexão.
- **Motivo:** Dois Baileys no mesmo JID (ex.: `9224`/`soma-9224`, `drax`/`drax-7770`) derrubam a campanha; lixo antigo na EVO não deve voltar com o pareamento.
- **Impacto:** `purgeOldEvoSessionsForReconnect` + `POST /instancias/:name/reconnect-purge`. Marker `DEPLOY-2026-08-21-evo-reconnect-purge`.

### 2026-08-28 — Tick/campanha nunca faz proxy/set em sessão open

- **Decisão:** O tick da campanha (running e paused) não liga nem desliga Proxy nos números que permanecem na seleção. `prepareProxyBrasilSessionForCampaignSend` não chama `proxy/set` se `connectionState` já é `open`. Desligar proxy só em nomes explícitos que saíram da campanha, e nunca em sessão `open`.
- **Motivo:** A regra de 21/08 não estava no tick (`allowEnable: true` + disable nos offline). Depois de reconectar de manhã, o reconcile aplicava `proxy/set` e 3 números caíam (`device_removed`).
- **Impacto:** Marker `DEPLOY-2026-08-28-083300-keep-pairing-chip-live`. Envio na Alternativa continua exigindo Proxy já ligada no QR «Proxy Campanha».

### 2026-08-21 — Campanha Alternativa: não desligar proxy nem restart com campanha viva

- **Decisão:** O tick não chama `proxy/set` (disable) ao pausar por instâncias offline. Ativar campanha não faz prepare/restart; só marca ready se já estiver `open`.
- **Motivo:** Em 11/08 a integração permanecia. Em 12/08 (`e886279`) o tick passou a desligar proxy nos offline; com 2 números, 50% desconectados desligava os dois → `device_removed`. Ativar (`b694d01`) aplicava proxy em background no meio do disparo.
- **Impacto:** Marker `DEPLOY-2026-08-21-alternativa-keep-pairing`.

### 2026-08-20 — Campanha Alternativa: não alterar proxy/sessão no meio do disparo

- **Decisão:** Com a instância `open`, o motor de envio não chama `proxy/set`, restart nem disable. Se a flag `ready` sumir (Redeploy), só marca pronta. Pausa por “saiu de open” não desliga a Proxy.
- **Motivo:** `proxy/set` e restart com sessão aberta geram conflict/`device_removed` e perdem o pareamento.
- **Impacto:** Marker `DEPLOY-2026-08-20-alternativa-no-proxy-mid-send`.

### 2026-08-20 — Campanha Alternativa: payload sendButtons do 11/08

- **Decisão:** `POST /message/sendButtons` usa `title` visível (1º bloco/linha) + `description` + `footer: ""` + botão `type: url`. Sem fallback texto+URL. Sem `title` ZWSP.
- **Motivo:** Esse payload (`4a72c1d`) gerou o botão nativo na campanha de 11/08. Title invisível (`30004a3`) + fallback em `viewOnce` (`0bc5eee`) geraram o card “Share on WhatsApp”.
- **Impacto:** Marker `DEPLOY-2026-08-20-alternativa-button-restore`.

### 2026-08-19 — Dispositivos: lingueta em vez de botão Aquecer

- **Decisão:** Substituir o botão **Aquecer** na barra do dispositivo virtual por lingueta **«Adicionar ao Aquecedor»** acima da área do telefone. Integração só no clique; sem etapa CONFIRMAR. Ao concluir: **«Integração Finalizada»** + pulso no menu **Instâncias**.
- **Motivo:** UX mais clara pós-cadastro de número; evitar disparo acidental de integração.
- **Impacto:** Removidos `device-cloud-warm-btn` e botão **Início**; marker `DEPLOY-2026-08-19-device-cloud-lingueta-tab`.

### 2026-08-19 — Copy Dispositivos sem EVO/Evolution

- **Decisão:** Textos visíveis do fluxo Dispositivos não mencionam EVO/Evolution; **device** → **dispositivo** nas mensagens ao usuário. Identificadores de código (`device-cloud-*`, rotas API) permanecem inalterados.
- **Motivo:** Linguagem orientada ao usuário final, não ao stack interno.
- **Impacto:** Toasts, hints e status da lingueta; commits `504e8ca` + `dist/` sincronizado.

### 2026-08-19 — Boas-vindas WhatsApp sem preview OG (texto + JPEG)

- **Decisão:** O texto de boas-vindas usa traço ASCII (`----`) e `linkPreview: false`. A arte BEM-VINDO vai como `sendMedia` JPEG após o ACK, não como card Open Graph do site.
- **Motivo:** No iOS, `━` (U+2501) impede a quebra de linha e corta o texto; dois `https` + preview da Evolution geram card de “vídeo” + miniatura borrada.
- **Impacto:** A capa lê o JPEG via `__dirname` (`dist/media` e `/app/media`), timeout 60s e fallback de URL pública — o mesmo padrão das campanhas. Marker `DEPLOY-2026-08-19-125000-welcome-cover-sendmedia`.

### 2026-08-19 — Boas-vindas WhatsApp obrigatória na fila completa

- **Decisão:** Cadastro/reenvio não pode desistir no número eleito. Percorre a fila 77770 → walkup → 2477; depois qualquer EVO `open`. Envia o JID `exists:true`. Retry em background até ACK de aparelho.
- **Motivo:** Com `drax` `close`, o reenvio mostrava sucesso e a mensagem não chegava (Nara / Carlos Cesar).
- **Impacto:** Marker `DEPLOY-2026-08-19-080900-welcome-must-arrive`. Sem lock `welcomeRetryPrimaryOnly`.

### 2026-08-14 — Mínimo de crédito da API Alternativa = R$ 200

- **Decisão:** Checkout PIX da API Alternativa aceita a partir de R$ 200,00; Oficial permanece R$ 300,00.
- **Motivo:** Pacote menor da Alternativa é 1.000 envios por R$ 200; o mínimo global de R$ 300 rejeitava o PIX.
- **Impacto:** Marker `DEPLOY-2026-08-14-min-credito-alternativa-200`; env `WABA_DISPAROS_MIN_CREDIT_CENTS_ALTERNATIVA`.

### 2026-08-12 — DRAX Device Cloud (repo próprio) + menu WABA

- **Decisão:** Device Cloud em `drax-device-cloud` (Nest/Next/Redroid); WABA só menu/SSO; visível em production para `mozart.pmo@gmail.com`.
- **Motivo:** Escala/virtualização isolada do monólito WABA; gate de acesso controlado.
- **Impacto:** Marker `DEPLOY-2026-08-12-device-cloud-menu-sso`; envs `DEVICE_CLOUD_*`.

### 2026-08-12 — + Instâncias substitui bloqueados + Proteção ativa nas conectadas

- **Decisão:** «+ Instâncias» troca 1:1 offline/bloqueado; Proxy nos novos / off nos removidos; tag «Proteção ativa» só exige proxy nas conectadas.
- **Motivo:** Manter bloqueados na seleção pausava a campanha (≥50%) e escondia a tag de proteção.
- **Impacto:** Marker `DEPLOY-2026-08-12-swap-blocked-proxy-tag`.

### 2026-08-12 — Boas-vindas WhatsApp ignora lifecycle do aquecedor

- **Decisão:** Boas-vindas (assinante/equipe) usam `ignoreAquecedorLifecycle` + `backgroundRetryKey`; Preparando e pausa humana não bloqueiam; fallback para qualquer EVO open se os hints preferidos falharem.
- **Motivo:** Cadastro não pode falhar o WhatsApp de boas-vindas por regras do aquecedor.
- **Impacto:** Aquecedor/campanhas continuam filtrando lifecycle; marker `DEPLOY-2026-08-12-welcome-bypass-lifecycle`.

### 2026-07-30 — Bootstrap da Memória do Projeto

- **Decisão:** Criar `.cursor/project-memory/` neste repositório e usá-la como memória permanente do Waba a partir desta data.
- **Motivo:** Projeto sem memória estruturada; reduzir dependência do histórico do Agent.
- **Impacto:** Novas tarefas devem consultar e atualizar estes arquivos; Knowledge Base em `.cursor/knowledge/` permanece para conhecimento reutilizável.

### 2026-07-30 — Apenas três ambientes (V02, V03, Produção)

- **Decisão:** Ambientes oficiais = V02 localhost, V03 localhost, Produção publicada (`master`). Nenhum outro ambiente publicado.
- **Motivo:** Evitar ambientes extras publicados e confusão de deploy.
- **Impacto:** Commit/push de feature para produção deve ir para `master`; V02/V03 não são alvos de publicação.

### 2026-07-30 — Reenvio de boas-vindas sem senha

- **Decisão:** Admin · Reenviar boas-vindas não solicita senha; API não exige senha; mensagem usa fallback de senha do cadastro.
- **Motivo:** Senha plaintext não é armazenada; pedir senha no reenvio era incorreto.
- **Impacto:** UI modal só confirma; commits `a17ee8a` (fonte) e `04ecf5d` (`dist/`). Marker `DEPLOY-2026-07-30-resend-welcome-sem-senha`.

### 2026-07-30 — Deploy EasyPanel exige `dist/` commitado

- **Decisão:** Tratar `dist/` como artefato obrigatório no push para `master` quando a mudança afeta UI ou runtime tipado.
- **Motivo:** Dockerfile do `waba_disparador` faz `COPY dist ./dist` e **não** executa `npm run build` na imagem. Corrigir só `index.html`/`src/` não altera produção.
- **Impacto:** Checklist de produção: `npm run build` → commit `dist/` (especialmente `dist/index.html`) → push `master` → Redeploy EasyPanel.

### 2026-08-03 — Excluir owners internos de métricas/split/dashboard

- **Decisão:** `mozart.pmo@gmail.com`, `quantumivst@gmail.com` e `walkup@walkuptec.com.br` ficam fora de Admin Dashboard, Financeiro/split e Dashboard Disparos (master).
- **Motivo:** Campanhas/pedidos internos não devem distorcer indicadores nem gerar split.
- **Impacto:** Módulo `waba-metrics-excluded-owners`; purge de settlements no overview; commit `2ca2404`; marker `DEPLOY-2026-08-03-excluir-owners-metricas-split`.

### 2026-08-03 — Confirmação de entrega aquecedor via ACK de aparelho

- **Decisão:** Além da tag no destino (`findMessages`/`findChats`), aceitar `DELIVERY_ACK` / `READ` / `PLAYED` como confirmação de entrega. `SERVER_ACK` sozinho **não** confirma; `ERROR` continua falha de origem.
- **Motivo:** Instâncias `@lid-heavy` (ex.: 2477) geram falso negativo: WhatsApp recebe, Evolution não indexa a tag a tempo.
- **Impacto:** `delivery-verify.helpers` + ciclo teste com probe de ACK e janela maior; commit `2556946`; marker `DEPLOY-2026-08-03-aquecedor-delivery-ack-lid`.

### 2026-08-04 — Campanhas de bônus de envio fora do split

- **Decisão:** Campanhas geradas com crédito de Bônus de envio não geram (ou não pagam integralmente) split ao fornecedor; pedidos `admin-bonus-envios` também não settlam.
- **Motivo:** Bonificação não gera receita do cliente; não há o que dividir/repassar.
- **Impacto:** Campo `creditFunding` no intake; `payoutSupplierForCompletedCampaign` usa envios billable; purge no Financeiro/Admin.

### 2026-08-04 — Operacional com múltiplos tipos de disparo

- **Decisão:** Operacional pode atender Oficial e/ou Alternativa; no Financeiro o mesmo e-mail pode ser fornecedor uma vez por `apiKind`.
- **Motivo:** Mesmo operador cobra valores diferentes por tipo de envio no split.
- **Impacto:** `operacionalDispatchesApis`; UI multi-select; unicidade split `email+apiKind`.
