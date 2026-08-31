# LOG — Aquecedor: isolamento do dashboard por assinante

**Data:** 2026-07-03

## Contexto

Assinante novo `digitalcorban@gmail.com` via dashboard do Aquecedor com 16 eventos e instâncias de outros clientes (1321-01, soma, drax), apesar de **0 instâncias** na aba Instâncias.

## Causa raiz

1. **`GET /dados`** consultava `logs_envios_br` sem filtro por dono/instâncias; cache em memória compartilhado entre usuários (só `rangeStart/rangeEnd`).
2. **`GET /aquecedor/envios`** com `scopedTechnicalNames.length === 0` desativava filtro (`filterQueueByOwner = false`) e buscava fila/logs globais.
3. Logs locais aceitavam linhas sem `ownerEmail` para assinantes não-master.

## Solução

### Backend (`src/index.ts`)

- `resolveAquecedorDashboardScope()` — resolve instâncias + aliases do assinante.
- **`GET /dados`**: exige login quando auth configurado; cache por `ownerEmail + escopo + range`; retorno vazio se assinante sem instâncias; queries Supabase com `.in("instancia_origem", ...)`.
- **`GET /aquecedor/envios`**: retorno antecipado vazio se não-master e sem instâncias; fila/logs Supabase só com escopo; logs locais exigem `ownerEmail` igual ao assinante.
- **`GET /aquecedor/command-logs`**: não exibe linhas sem `ownerEmail` para assinantes comuns.

### Frontend (`index.html`)

- Ao trocar sessão (`unlockWabaApp`), limpa `rawEvents` e cache do dashboard para evitar flash de dados do usuário anterior.

## Arquivos alterados

- `src/index.ts`
- `index.html`
- `dist/index.js`, `dist/index.html` (build local)

## Como validar

1. Login como assinante novo **sem instâncias** → dashboard Aquecedor com 0 eventos, gráficos vazios.
2. Login como master → dashboard continua com visão global.
3. Assinante com instâncias próprias → vê apenas eventos das suas instâncias.

## Segurança

- Sem exposição de dados de outros tenants no dashboard/envios do Aquecedor.
- Cache `/dados` isolado por e-mail + fingerprint de escopo.

## Palavras-chave

`resolveAquecedorDashboardScope`, `GET /dados`, `filterQueueByOwner`, `logs_envios_br`, `digitalcorban`, isolamento tenant aquecedor
