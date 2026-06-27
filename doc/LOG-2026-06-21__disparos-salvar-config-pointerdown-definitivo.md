# LOG — API Alternativa: Salvar configurações 1 clique (definitivo)

## Problema

Na etapa **Seleção de números** (e demais seções) da API Alternativa, o botão **Salvar configurações** ainda exigia **dois cliques** para gravar e avançar o wizard — regressão após fixes anteriores documentados mas incompletos no código.

## Causas

1. **Blur vs click:** listas `#dis-available-instances` / `#dis-selected-instances` com `tabindex="0"` retinham foco; o 1º clique no botão era consumido pelo blur antes do `click`.
2. **Handler frágil:** `mousedown` + `click` assíncrono por botão, sem delegação estável.
3. **Reload mid-wizard:** `loadDisparosConfig()` (aba API Alternativa com `silent: false`) chamava `resetDisparosSectionFlow()` + `setDisparosFormValues()`, sobrescrevendo seleção e estado das seções durante edição.
4. **Auto-refresh:** `carregar()` podia chamar `syncDisparadorNumberPicker()` e interferir no picker enquanto o usuário configurava (guard documentado em LOG 2026-06-26 não estava aplicado de forma completa).

## Solução

1. **`pointerdown` em captura** — delegação única em `#disparos-config-area` → `executeDisparosSectionSave()` (1 evento, `preventDefault` + `stopPropagation`).
2. **`commitDisparadorPickerStateBeforeSave()`** — sincroniza `pendingSelectedDisparadorInstances` a partir do DOM antes do POST.
3. **Picker sem foco trap** — `tabindex="-1"` nas listas (clique continua movendo números).
4. **Guards de reload** — `shouldSkipDisparosConfigReload()` bloqueia `loadDisparosConfig` mid-wizard; `skipSectionFlowReset` na aba `disparo-evo`; botão Atualizar usa `forceReload: true`.
5. **`#dis-save-btn`** — save global também via `pointerdown`.

## Arquivos

- `index.html`, `dist/index.html`
- `src/deploy-marker.ts`

## Validar

1. API Alternativa → Seleção de números → escolher 4 instâncias → **1 clique** em Salvar → seção recolhe e abre Expediente.
2. Repetir saindo de chip de filtro 🔥 ou após clicar na lista de selecionados.
3. Durante wizard aberto, auto-refresh 15s **não** reseta seções nem picker.
4. Botão **Atualizar** ainda recarrega config completa (`forceReload`).

## Palavras-chave

`Salvar configurações`, `API Alternativa`, `dis-section-save-btn`, `pointerdown`, `blur`, `Seleção de números`, `double click`
