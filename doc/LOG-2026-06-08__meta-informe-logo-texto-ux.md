# LOG — Informe META: logo SVG, título azul, texto revisado

**Data:** 2026-06-08  
**Contexto:** UX informe oficial API Alternativa (mín. 4 números)

## Solicitação
- Logo Meta ainda ruim → substituir por SVG oficial (Simple Icons)
- Título "Informe oficial" na cor azul do logo (#0081fb)
- Revisar texto de alerta de segurança (mais claro e objetivo)

## Alterações
- `index.html`: `bi-meta` → SVG inline Meta; `.alt-meta-official-title` → `#0081fb`
- Texto novo nos blocos `#alt-numbers-purchase-alert` e `#alt-numbers-picker-locked`
- Nota discreta compra: texto alinhado ao novo tom
- `node scripts/copy-index-html.mjs` → `dist/index.html`

## Texto adotado
> **Alerta de segurança:** Use pelo menos **4** números integrados na sua operação. Assim, os envios são distribuídos entre contas — o que reduz o risco de bloqueio no WhatsApp e deixa seus disparos mais estáveis.

## Validação
- Refresh V02: http://localhost:3012/version-02/ (Ctrl+Shift+R)
- Usuário teste Mozart: 3 números → informe visível

## Pendências
- Commit/deploy se aprovado pelo usuário
