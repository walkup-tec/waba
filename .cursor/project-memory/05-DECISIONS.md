# Decisões Técnicas

Registrar apenas decisões permanentes.

## Decisões

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
