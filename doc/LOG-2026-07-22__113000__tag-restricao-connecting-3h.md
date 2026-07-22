# LOG — Tag UI «Restrição» (connecting + countdown 3h)

- **Data:** 2026-07-22 ~11:30
- **Pedido:** Tag no estilo Preparando: ícone WhatsApp + «Restrição» + contagem 3h; ações desabilitadas; a cada 60 min rechecar connectionState — se não for mais `connecting`, remove tag e reabilita botões.

## Solução

1. **Store** `data/whatsapp-connecting-restriction.json` via `src/instances/whatsapp-connecting-restriction.service.ts`
   - Detecta `liveState === connecting` → `restrictedUntil = now + 3h`
   - Sai de connecting → remove do store
   - Recheck server a cada 60 min
2. **Enrich** `/instancias` (live) sincroniza a restrição
3. **`/instancias/uso-config`** expõe `waRestrictionUntil` / `waRestrictionActive`
4. **UI** (`index.html`): status amarelo estilo Preparando, countdown, botões/toggles off, poll 60 min no browser

## Arquivos

- `src/instances/whatsapp-connecting-restriction.service.ts`
- `src/index.ts` / `dist/index.js` / `dist/instances/…`
- `index.html` / `dist/index.html`

## Validar

1. Instância em `connecting` → tag Restrição + countdown ~3h + ações disabled
2. Voltar a `open` (ou recheck 60min) → tag some, botões voltam
3. Não confundir com «Preparando» (6h aquecedor) nem «6 horas de espera» (restricted_wait)

## Palavras-chave

Restrição, connecting, countdown 3h, wa-restriction, whatsapp-connecting-restriction
