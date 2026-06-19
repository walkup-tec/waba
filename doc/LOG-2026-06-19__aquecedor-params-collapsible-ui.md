# LOG — Aquecedor parâmetros recolhíveis (UI)

**Data:** 2026-06-19 (recommit após regressão em commits posteriores)

## Contexto

UI recolhível foi incluída em `7b0cdf2` mas **revertida** nos commits `7d478ad` / `b82108d` (HTML/JS voltou ao formulário sempre visível). CSS do painel permaneceu no arquivo.

## Alterações (reaplicadas)

- Painel `aquecedor-params-panel` recolhido por padrão
- Chevron, resumo compacto, badge Padrão/Personalizado
- Salvar só dentro do painel expandido
- Recolhe após salvar e ao carregar config

**Marker:** `DEPLOY-2026-06-19-aquecedor-params-collapsible-ui`
