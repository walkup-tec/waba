# Validação — voltar keyword só CONFIRMAR

## Contexto
Usuário rejeitou `CONFIRMAR WABA-323544` na UI — deve enviar apenas a palavra **CONFIRMAR**.

## Alteração
- Removido `buildValidationKeyword` e token `WABA-XXXXXX` na keyword de validação.
- `keyword` = `INBOUND_VALIDATION_KEYWORD` (`CONFIRMAR`).
- Textos UI/banner/mensagens de erro ajustados.

Marker: `DEPLOY-2026-07-01-validacao-confirmar-palavra-simples`

## Arquivos
- `src/instance-inbound-validation.service.ts`
- `src/deploy-marker.ts`
- `index.html`
