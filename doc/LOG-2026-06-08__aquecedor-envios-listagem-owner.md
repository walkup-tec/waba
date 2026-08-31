# LOG — Aquecedor Envios listagem por owner (walkup)

**Data:** 2026-06-08  
**Pedido:** Verificar aquecedor walkup@walkuptec.com.br e listar envios no quadrante Envios.

## Diagnóstico (screenshot usuário)

- Motor **ativo**; instâncias `soma` e `walkup` conectadas.
- `Sem mensagem pendente para envio` → fila Supabase `aquecedor` vazia → nenhum envio real → Envios vazio.

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/index.ts` | `readAquecedorEnviosLog`, `recordAquecedorEnvio`, `ensureAquecedorPendingMessage`; `GET /aquecedor/envios` com auth + filtro owner; auto-enfileira no start e no ciclo sem pendente |
| `src/instances/waba-instance-ownership.service.ts` | `listOwnedInstanceNames` |
| `index.html` | `loadAquecedorEnvios` exibe `hint` e erros da API |
| `src/deploy-marker.ts` | `DEPLOY-2026-06-08-aquecedor-envios-listagem-owner` |

## Validação

- `npm run build` — OK

## Próximos passos

1. Reiniciar `npm run dev:v02` (ou redeploy VPS) para carregar build.
2. Abrir Aquecedor como walkup → clicar **Atualizar** em Envios.
3. Após primeiro ciclo com envio, itens aparecem com origem/destino/data/status.
4. Commit/deploy se for para produção.
