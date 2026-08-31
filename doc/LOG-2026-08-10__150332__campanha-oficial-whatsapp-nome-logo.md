# LOG — Campanha API Oficial: etapa Seu WhatsApp + modal operacional

## Contexto do pedido

Na criação de campanha **API Oficial**, a etapa 2 (antes só DDD) passa a ser **Seu WhatsApp**, com DDD + nome no WhatsApp + logo 500×500. No modal de detalhes do operacional, exibir esses dados em seção **WhatsApp** (abaixo de Campanha), com download da logo.

## Ações executadas

- Alteração do wizard em `index.html` (UI + validação client-side 500×500).
- Persistência no intake JSON (`whatsappName`, `whatsappLogoFileName`, `whatsappLogoStoredPath`).
- Upload multipart `whatsappLogo` em `POST /disparos/campanhas/intake`.
- Detalhe operacional + `GET /admin/operacional/campanhas/:id/logo-whatsapp`.
- Bump `WABA_CAMPAIGN_INTAKE_API_VERSION` 4 → 5.
- `node scripts/copy-index-html.mjs` (dist HTML). Emit JS dos módulos alterados via `tsc` (build completo falha por erros pré-existentes em `src/index.ts`).

## Solução implementada

1. **Wizard etapa 2**
   - Indicador: `2. WhatsApp`; título do painel: `Seu WhatsApp`.
   - Campos: DDD, Nome no WhatsApp (2–80 chars), logo PNG/JPG exatamente 500×500.
2. **Backend intake**
   - Valida nome e presença da logo; grava em `campaign-intakes/<id>/whatsapp-logo.(png|jpg)`.
3. **Operacional**
   - Seção WhatsApp: DDD, Nome do WhatsApp, botão Baixar logo.
   - DDD removido da seção Campanha (fica só na seção WhatsApp).
   - Campanhas antigas sem logo: “Não informada”.

## Arquivos criados/alterados

- `index.html` / `dist/index.html`
- `src/disparos/waba-campaign-intake.repository.ts`
- `src/disparos/waba-campaign-intake.routes.ts`
- `src/disparos/waba-campaign-intake.constants.ts`
- `src/disparos/waba-campaign-intake-idempotency.ts`
- `src/admin/waba-operacional-campanhas.service.ts`
- `src/admin/waba-operacional-campanhas.routes.ts`
- `dist/disparos/*` e `dist/admin/*` correspondentes

## Como validar

1. Redeploy do Node (API version 5 no `/health`).
2. Criar campanha Oficial: etapa 2 exige nome + logo 500×500 (rejeita outras dimensões).
3. No operacional, abrir detalhes: seção WhatsApp com DDD, nome e download da logo.
4. Download da imagem do disparo continua em Materiais.

## Observações de segurança

- Download de logo exige menu staff `admin-campanhas` (mesmo filtro de campanha).
- Sem exposição de caminhos internos no JSON (só flag `hasWhatsappLogo` + nome do arquivo).

## Palavras-chave (anti-duplicação)

`campanha`, `api-oficial`, `wizard`, `ddd`, `seu-whatsapp`, `whatsappName`, `whatsappLogo`, `500x500`, `operacional`, `detalhes`, `logo-whatsapp`, `intake-api-version-5`
