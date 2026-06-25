# LOG: Disparos — altura dinâmica lista de campanhas = card Resumo

## Pedido

Listagem de campanhas (API Oficial e Alternativa) deve ser dinâmica e ter a mesma altura do card **Resumo** ao lado.

## Causa

- `.list-wrapper` global impunha `max-height: 420px` em `#disparos-list`.
- Colunas do grid não repassavam altura via flex de forma consistente.

## Solução

1. **CSS:** `#disparos-list` sem teto fixo; flex `1 1 auto` dentro de `.disparos-side-campanhas`; grid `align-items: stretch`.
2. **JS:** `syncDisparosCampanhasListLayout()` calcula altura útil da lista = altura do card Resumo − cabeçalhos/rodapés da coluna Campanhas.
3. **ResizeObserver** em Resumo + Campanhas; re-sync após carregar/renderizar campanhas e ao mudar aba.

Marker: `DEPLOY-2026-06-25-disparos-campanhas-list-height-sync`

## Validar

Desktop (>992px): API Oficial e Alternativa — lista com scroll interno, mesma altura visual que Resumo.
Mobile: lista cresce naturalmente (sem altura forçada).
