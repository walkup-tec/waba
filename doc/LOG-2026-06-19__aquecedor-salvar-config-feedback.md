# LOG — Aquecedor Salvar configurações feedback

**Data:** 2026-06-19  
**Sintoma:** Botão "Salvando..." volta a "Salvar configurações" sem feedback visível.

## Causas

1. Painel do motor ficava **oculto** no modo edição — sucesso/erro nos logs não aparecia.
2. Poll do status a cada 3s forçava `setAquecedorEditMode(false)` e interrompia edição/salvamento.
3. Erros de rede/HTTP só em toast (fácil de perder).

## Correção

- Motor sempre visível (não esconde ao editar).
- Feedback inline `#aquecedor-save-feedback` (verde/vermelho).
- Validação espera min/max no cliente; timeout 20s.
- Sync de status não altera mais modo edição durante uso.

## Marker

`DEPLOY-2026-06-19-aquecedor-salvar-config-feedback`
