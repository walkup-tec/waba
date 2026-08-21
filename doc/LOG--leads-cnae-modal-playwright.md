# LOG — fix CNAE modal Playwright (Leads PJ)

## Contexto
Em produção, extração Leads PJ falhava com:
`CNAE: modal não abriu (campo "Código ou nome da atividade" ausente). Código pedido: 6619302.`

## Solução
- Endurecido `selectAtividadePrincipalCnae` com abertura multi-estratégia, busca de input com timeout/poll, marcação de opção e fallback autocomplete.
- Erros passam a listar placeholders visíveis para diagnóstico.
- UI: mensagem clara quando API retorna HTML 404 ("Not Found").
- Marker: `DEPLOY-2026-08-21-leads-cnae-modal-fix`.

## Arquivos
- `src/marketing/leads-cnpj/waba-leads-cnpj-casadosdados.adapter.ts`
- `src/deploy-marker.ts`
- `index.html` / `dist/*` correspondentes

## Validação
- `npx tsc` OK.
- Validação funcional: Redeploy EasyPanel + master reexecutar lista Corbans CNAE 6619302.

## Keywords
leads-cnpj, cnae, casadosdados, playwright, modal, atividade principal
