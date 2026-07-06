# LOG — Salvar configurações Disparador (1 clique)

## Problema

Na configuração de **API Alternativa**, o botão **Salvar configurações** às vezes não salvava no primeiro clique — era necessário clicar duas vezes.

## Causa

1. **Blur vs click:** ao clicar no botão com um input focado, o navegador dispara `blur` no campo antes do `click` no botão, cancelando o clique na primeira tentativa.
2. **Auto-refresh 15s:** `carregar()` rodava na aba Disparos e chamava `syncDisparadorNumberPicker()`, podendo interferir durante a edição (Aquecedor já pausava refresh).

## Solução

1. `mousedown` + `preventDefault` em `.dis-section-save-btn` e `#dis-save-btn` — garante o `click` após editar campos.
2. Abas `disparos` e `disparo-evo` em `ADMIN_FORM_TABS_SKIP_AUTO_REFRESH` (pausa auto-refresh como Aquecedor).
3. Guard `disparosConfigSaveInFlight` — evita saves concorrentes; `loadDisparosConfig` não sobrescreve formulário durante save.
4. `credentials: same-origin` no POST `/disparos/config`.

## Arquivos

- `index.html`, `dist/index.html`
- `src/deploy-marker.ts`

## Validar

1. API Alternativa → preencher seção → um clique em **Salvar configurações** → avança/recolhe seção.
2. Repetir saindo de input numérico ou textarea (Mensageiro).

## Palavras-chave

`Salvar configurações`, `disparo-evo`, `API Alternativa`, `blur`, `double click`, `dis-section-save`
