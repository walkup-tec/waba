# LOG — Aquecedor: instância desconectada e escopo por usuário

## Contexto

Relatado para `mozart.pmo@gmail.com`:
1. Instância **desconectada** entrando no ciclo / painel de envios.
2. Instância de **outro usuário** (`atendimento-673`) aparecendo no aquecedor do Mozart.

## Causas

1. **Merge EVO live + cache:** o cache local mantinha status `open` e reintroduzia instâncias que já estavam desconectadas na Evolution live.
2. **Fila global Supabase:** tabela `aquecedor` é compartilhada; painel `/aquecedor/envios` lia `PROCESSANDO`/`PENDENTE` sem filtrar por dono.
3. **Filtro de exibição fraco:** `aquecedorEnvioMatchesOwner` aceitava envio se **origem OU destino** pertencesse ao usuário — bastava o destino ser de Mozart para exibir origem alheia.

## Solução

- `mergeAquecedorConnectedRows`: só instâncias **conectadas na EVO live**; cache só enriquece número.
- `aquecedorEnvioMatchesOwner`: exige **origem** no escopo do usuário; destino instância também deve ser do escopo.
- `resolveAquecedorEnviosAllowedInstances`: usa `listAquecedorScopedInstanceNames` + aliases (paridade com ciclo).
- `/aquecedor/envios`: queries `PROCESSANDO`/`PENDENTE` com `.in("instancia", scopedTechnicalNames)` para assinantes.
- Inferência de par na fila usa `resolveAquecedorConnectedForOwner` + `filterAquecedorCycleConnected`.

## Arquivos

- `src/index.ts` / `dist/index.js`
- `src/deploy-marker.ts`

## Validar

1. Redeploy Node (`DEPLOY-2026-06-25-aquecedor-scope-connected-fix`).
2. Mozart: desconectar uma instância → não deve entrar no ciclo nem em "Em Fila".
3. Mozart: painel envios só mostra pares com **origem** nas instâncias dele.
4. Master continua vendo fila global (sem filtro).

## Palavras-chave

`mergeAquecedorConnectedRows`, `aquecedorEnvioMatchesOwner`, `listAquecedorScopedInstanceNames`, instância desconectada, multi-tenant
