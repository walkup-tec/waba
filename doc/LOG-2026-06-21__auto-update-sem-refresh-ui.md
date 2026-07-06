# LOG — Atualização automática sem refresh de UI

**Data:** 2026-06-21  
**Deploy marker:** `DEPLOY-2026-06-21-auto-update-sem-refresh-ui`

## Pedido

Manter a atualização automática periódica (~15s), mas **sem recarregar/re-renderizar** formulários, listas e telas — o refresh estava apagando dados em edição (Disparador, Aquecedor, Admin, etc.).

## Solução

### Timer global (15s)

- Continua ativo em **todas** as abas (exceto modo manual).
- Chama `carregar({ silent: true })` em vez de `carregar()` completo.
- Removida a pausa por aba (`ADMIN_FORM_TABS_SKIP_AUTO_REFRESH`).

### Modo `silent` em `carregar()`

- Busca `/instancias/snapshot` e `/dados` (quando dashboard) e atualiza **cache em memória**.
- **Não** chama `refreshActiveTabData()`, `applyFilters()`, `renderInstancesList()`, `syncDisparadorNumberPicker()`.
- **Não** mostra loading nem substitui `#conteudo` com erro.
- Label: `Dados em segundo plano · HH:MM:SS`.

### Refresh manual (continua completo)

- Botão/ícone de atualização e troca para modo automático chamam `carregar()` normal (com re-render).

### Outros ajustes

- `applyDashboardDadosPayload(data, { render: false })` no modo silent.
- `refreshInstancesFullInBackground`: não re-sincroniza picker de instâncias.
- `loadDisparosConfig({ silent: true })`: só atualiza cache, sem `setDisparosFormValues`.

## Arquivos

- `index.html`
- `src/deploy-marker.ts`
- `dist/` (build)

## Validar

1. Abrir Disparador/Aquecedor/Admin e preencher campos sem salvar.
2. Aguardar 15–30s — campos **não** devem resetar; label mostra "Dados em segundo plano".
3. Clicar no ícone/botão de atualização manual — tela recarrega dados visíveis.

## Palavras-chave

auto-refresh, carregar silent, refreshActiveTabData, sem reload, formulário apagado, 15 segundos
