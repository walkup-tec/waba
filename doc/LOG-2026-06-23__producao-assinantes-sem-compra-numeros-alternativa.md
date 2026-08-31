# LOG — Produção assinantes: sem compra de números Alternativa

**Data:** 2026-06-23

## Pedido

Preparar produção para assinantes mantendo:
- Foguinhos (nível de aquecimento no Aquecedor)
- Melhorias na distribuição de mensagens / motor de disparo
- Débito do saldo contratado por envio na API Alternativa

Removendo/desativando:
- Compra de números para campanhas API não oficial (fazenda / PIX R$20)

## Solução

### Feature flag `WABA_ALTERNATIVA_NUMBERS_PURCHASE_ENABLED`

- **Padrão:** `false` (produção assinantes)
- **V02/teste compra:** `true` no `.env.v02`

Arquivo: `src/config/waba-feature-flags.ts`

### Backend

- `GET /health` → `featureFlags.alternativaNumbersPurchase`
- HTML injeta `window.WABA_FEATURE_FLAGS`
- Rotas `/billing/alternativa-numbers/checkout` e `/activate` → **403** quando desligado
- `GET .../summary` → payload vazio + `purchaseEnabled: false`
- `shouldApplyAlternativaDispatchProfile` → perfil Alternativa por **saldo contratado** (`apiKind: alternativa`), não por números comprados
- `assertAlternativaDispatchReady` → no-op sem compra de números
- Campanha motor próprio:
  - **Oficial:** débito antecipado na criação (mantido)
  - **Alternativa:** débito **1 envio/sucesso**; pausa campanha se saldo zerar
- Intake campanhas Meta: débito antecipado só `apiKind === oficial`

### Frontend (`index.html`)

- Oculta aba «Comprar números» e painel fazenda quando flag off
- Coluna **Fazenda** (Instâncias) só com flag on + master
- Projeção de campanha usa instâncias selecionadas do Aquecedor (não ativações compradas)
- `assertAlternativaReadyForDispatch` exige instâncias do Aquecedor, não mín. 3 ativados

## Arquivos

- `src/config/waba-feature-flags.ts` (novo)
- `src/base-path.ts`, `src/index.ts`
- `src/billing/waba-billing.routes.ts`
- `src/disparos/waba-campaign-intake.routes.ts`
- `index.html`, `.env.example`

## Deploy produção

1. Easypanel: **não** definir `WABA_ALTERNATIVA_NUMBERS_PURCHASE_ENABLED` (ou `false`)
2. Commit + push `master` → Deploy FTP
3. Validar: assinante com pacote Alternativa → Disparos evo → seleciona instâncias aquecedor → campanha debita 1/envio

## V02 (testar compra números)

`.env.v02`: `WABA_ALTERNATIVA_NUMBERS_PURCHASE_ENABLED=true`

## Palavras-chave

`WABA_ALTERNATIVA_NUMBERS_PURCHASE_ENABLED`, `alternativaNumbersPurchase`, produção assinantes, débito por envio, comprar números desativado
