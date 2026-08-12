# Decisões Técnicas

Registrar apenas decisões permanentes.

## Decisões

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
