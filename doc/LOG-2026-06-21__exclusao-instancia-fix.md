# LOG — Correção fluxo exclusão de instância

**Data:** 2026-06-21  
**Contexto:** Usuário reportou falhas intermitentes ao excluir instância: modal abre mas não exclui; às vezes exclui mas modal não fecha; às vezes modal não aparece.

## Sintomas e causas raiz

| Sintoma | Causa provável |
|--------|----------------|
| Confirmou mas não excluiu | Backend retornava 502 quando Evolution falhava (5xx/timeout); ownership e cache local permaneciam |
| Excluiu mas modal ficou aberto | Estado `deleteConfirmProcessing` + fechamento manual inconsistente; erro em `carregar()` após sucesso |
| Modal não abriu / nada aconteceu | `deleteConfirmProcessing` travado de tentativa anterior; confirmação case-sensitive (usuário digitava alias `601900` vs nome técnico) |

## Solução implementada

### Frontend (`index.html`)

- Confirmação **case-insensitive**; aceita nome técnico **ou** alias da coluna «Nome da Instância»
- Recuperação de estado preso: `openDeleteConfirm` reseta `processing` se overlay não estiver aberto
- `closeDeleteConfirm({ force: true })` no sucesso — modal sempre fecha
- Erro **inline** no modal (`#confirm-delete-error`) além do toast
- Enter no input confirma exclusão; `stopPropagation` no clique Deletar
- Lista atualizada otimisticamente; `carregar()` em try separado (falha de refresh não reverte exclusão)

### Backend (`src/index.ts`)

- `tryDeleteEvoInstance`: logout best-effort + múltiplas URLs de delete
- Soft-delete local ampliado: 404, timeout, 5xx Evolution
- `purgeInstanceLocalState`: ownership, cache EVO, aliases, whatsapp profile names, `instancias_uso_config`, lifecycle aquecedor

### Serviço (`aquecedor-instance-lifecycle.service.ts`)

- `removeAquecedorInstanceLifecycle(instanceName)`

## Arquivos alterados

- `index.html`
- `src/index.ts`
- `src/services/aquecedor-instance-lifecycle.service.ts`
- `dist/index.html` (via `npm run build`)

## Como validar

1. `npm run build` — OK
2. Em Instâncias, clicar **Deletar** em instância com alias diferente do nome técnico — modal abre; digitar alias ou nome técnico; confirmar
3. Sucesso: modal fecha, linha some, toast de sucesso
4. Simular falha Evolution (502): modal permanece com mensagem inline; botão Deletar reabilita após erro
5. Após exclusão degradada (EVO offline): instância some do painel; toast warning

## Palavras-chave

`exclusão instância`, `delete confirm modal`, `purgeInstanceLocalState`, `tryDeleteEvoInstance`, `deleteConfirmProcessing`
