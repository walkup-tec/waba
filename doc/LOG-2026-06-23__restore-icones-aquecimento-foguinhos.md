# LOG — Restaurar ícones de aquecimento (foguinhos)

**Data:** 2026-06-23

## Contexto

Após `git checkout` do `index.html` para corrigir mojibake UTF-8, o **warmth picker** (foguinhos + filtro Todos/1🔥/2🔥/3🔥) foi perdido. O usuário pediu que os ícones de aquecimento **permaneçam em todo o sistema**, exceto na lista de **números comprados** (API Alternativa / `alt-fazenda-card-list`).

## Solução

Reintegrado em `D:\Waba-master\index.html` (espelhado em `E:\Waba\index.html`):

1. **CSS** — `.instance-warmth`, `.instance-warmth-fire`, `.dis-warmth-chip`, `.dis-picker-list`, `.dis-picker-item`
2. **HTML Disparos → Aquecedor** — substituído `<select>` por listas `.dis-picker-list` + chips de filtro por nível
3. **JS** — `buildInstanceWarmthCell`, `warmthLevel`/`warmthLabel` em `getInstanceUsage` e `loadInstanceUsageConfig`, picker (`fillDisPickerList`, `handleDisPickerItemClick`, `initDisPickerWarmthFilter`), filtro `disPickerWarmthFilterLevel`
4. **Tabela Instâncias** — coluna **Quente** com foguinhos
5. **Sem fogos** — `renderFazendaCardList` (cards Meus números / Comprar números) inalterado

## Arquivos alterados

- `index.html` (D:\Waba-master e E:\Waba)

## Validação

```powershell
cd D:\Waba-master
node agent-tools/check-index-scripts.mjs
# { ok: true, scripts: 1 }
```

Manual: aba **Instâncias** → coluna Quente; **Disparos** → Instâncias do Aquecedor → fogos + filtro; **Comprar números** → cards sem fogos.

## Palavras-chave

`buildInstanceWarmthCell`, `dis-picker-list`, `disPickerWarmthFilterLevel`, `warmthLevel`, `index.html.broken-backup`, API Alternativa fazenda cards
