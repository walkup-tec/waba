# LOG — BM inoperante: verificação modal Processando → fecha

**Data:** 2026-07-09

## Verificação

Fluxo já existia em `markAdminCampanhaBmInoperante()` (`index.html`):

1. Clique → botão **Processando** + `disabled`
2. POST `/admin/operacional/campanhas/:id/bm-inoperante`
3. Sucesso → **Registrado** + toast + `closeAdminCampanhasDetailModal()` após 1,2s
4. Erro → restaura botão **BM inoperante**

Backend `markBmInoperante` (desde 4fdaa1b/88bbc3b): reatribui ou marca `bmInoperanteRegisteredAt` na fila esgotada.

## Correção aplicada

- Toast e fechamento do modal **antes** de `loadAdminCampanhas` — evita modal preso se refresh da lista falhar após API OK.
- Validação `payload.ok === false`.

## Deploy marker

`DEPLOY-2026-07-09-bm-inoperante-modal-fecha-seguro`

## Palavras-chave

`BM inoperante`, `Processando`, `Registrado`, `closeAdminCampanhasDetailModal`
