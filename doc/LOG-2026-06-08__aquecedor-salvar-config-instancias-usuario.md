# LOG — Aquecedor: salvar config + instâncias por usuário

**Data:** 2026-06-08  
**Contexto:** Usuário `walkup@walkuptec.com.br` na tela Aquecedor — "Salvar configurações" sem efeito; "Erro ao carregar". Exigência: motor usar somente instâncias do usuário logado.

## Causa raiz

1. `GET/POST /aquecedor/config` retornavam **503** sem Supabase → load falhava e save não persistia.
2. `runAquecedorCycle` buscava **todas** instâncias EVO conectadas, sem filtro `instance-owners.json`.

## Alterações

- `src/index.ts`: fallback `data/v02/aquecedor-config.json` quando Supabase ausente ou falha.
- `aquecedorRuntimeOwnerEmail` vinculado em `/aquecedor/start`, `run-once`, `criar-mensagem-teste`; persistido em `runtime-intent.json`.
- `filterConnectedForAquecedorOwner` no ciclo do motor.
- `index.html`: feedback visível em `aquecedor-status-label` ao salvar/erro; hint "armazenamento local".
- Marker: `DEPLOY-2026-06-08-aquecedor-config-local-instancias-usuario`.

## Validação

```bash
cd D:\Waba
npm run build   # OK
```

## Pendências

- Reiniciar `npm run dev:v02` e testar Salvar + Iniciar aquecedor.
- Instâncias legadas sem `instance-owners.json` não entram no aquecimento até cadastro.
- Deploy Easypanel não solicitado.
