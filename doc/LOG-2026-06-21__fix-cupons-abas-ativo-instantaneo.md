# Fix — abas cupons Ativos/Inativos demoravam ~30s para mudar cor

## Contexto
Ao clicar em Ativos/Inativos nos cupons (Admin · Assinantes), a aba só ficava destacada após ~30–40s (intervalo do poll).

## Causa
`setAdminCampanhasBucket` e `initAdminCampanhasUi` usavam `.admin-campanhas-bucket-btn` em **todos** os botões com essa classe (cupons, chamados, monitor CPU). Ao clicar num cupom, o handler de campanhas removia `is-active` dos botões de cupom. O poll de cupons (30s) restaurava a cor correta.

## Solução
- Campanhas: seletor `[data-campanhas-bucket]` (como chamados já faz com `[data-chamados-bucket]`).
- Cupons: `setAdminCouponsBucket` atualiza UI da aba imediatamente.

## Arquivos
- `index.html`, `dist/index.html`
- `src/deploy-marker.ts`

## Validar
Clicar Ativos ↔ Inativos nos cupons → cor muda na hora.
