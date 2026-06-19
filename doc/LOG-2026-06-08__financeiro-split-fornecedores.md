# LOG — Split com cadastro de fornecedores

**Data:** 2026-06-08

## Pedido
Cadastrar fornecedor (nome, custo por envio, chave PIX). PIX entra no split; fornecedor recebe pelos envios contratados.

## Modelo
- **Fornecedor** (1 ativo por plano: Oficial / Alternativa): `name`, `apiKind`, `costPerShipmentCents`, `pixKey`
- **Participantes**: rateio do **lucro** (valor pago − custo fornecedor) em %

## Cálculo por pedido pago
1. `custo = envios_contratados × custo_fornecedor[plano]`
2. Linha split **fornecedor** → PIX com valor do custo
3. `lucro = pago − custo`
4. Linhas **parceiros** → % do lucro

## Arquivos
- `waba-financeiro-split.repository.ts` (v2 + migração v1)
- `waba-financeiro-split.service.ts`
- `waba-financeiro-split-settlement.repository.ts` (`lineKind: supplier|partner`)
- `index.html` — UI fornecedores + rateio lucro
- `waba-admin.routes.ts`

## Pendência
Repasse PIX automático via Asaas (ainda só calcula/registra).

## Validação
`npm run build` OK
