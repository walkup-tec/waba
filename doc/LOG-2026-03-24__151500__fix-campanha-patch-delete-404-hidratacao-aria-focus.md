# LOG: 404 em PATCH/DELETE campanha + aria-hidden / foco

## 404

- `hydrateCampaignFromDbIfNeeded` podia falhar **antes** de colocar a campanha na memória (ex.: erro ao carregar muitos leads num único `try`), ou `config_snapshot` quebrando o parse.
- Correção: `parseDisparosConfig` em try/catch com fallback; carregamento de leads em try/catch separado (campanha já fica em memória).
- Fallback **PATCH**: se não houver em memória após hidratar, `UPDATE` direto no Supabase + resposta ok.
- Fallback **DELETE**: se não houver em memória, `DELETE` leads + campanha no Supabase; 404 só se não apagar nada.

## aria-hidden

- Antes de fechar overlay: `blur` no elemento focado dentro do modal (`blurFocusInsideOverlay`).
- Ao abrir modais de campanha / fechar registro: `blurFocusTrappedInClosedOverlays()` para não manter foco em overlay já sem `.open`.
- `closeRegisterModal` também remove foco antes de `aria-hidden="true"`.
