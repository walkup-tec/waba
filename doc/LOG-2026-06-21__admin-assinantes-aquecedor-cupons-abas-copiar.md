# Admin assinantes — Aquecedor parceiro + cupons abas + copiar

## Contexto
Deploy consolidado: liberar Aquecedor no cadastro de assinante, abas Ativos/Inativos nos cupons, botão Copiar código, remoção de hint de padrão WABA.

## Alterações

### Assinante parceiro
- Checkbox **Liberar Aquecedor sem compra de envios** no formulário Novo assinante
- Campo `aquecedorGranted` em `waba-subscribers.json`
- `WabaEntitlementService` libera Aquecedor com reason `partner`

### Cupons
- Abas **Ativos** / **Inativos** com contadores
- Expirados/esgotados/desativados vão para Inativos (poll 30s na aba)
- Botão **Copiar** código do cupom
- Removida frase de padrão do código no formulário

## Marker
`DEPLOY-2026-06-21-assinante-liberar-aquecedor`

## Validar
1. Master → Admin · Assinantes → criar assinante com Aquecedor marcado → login assinante → menu Aquecedor liberado
2. Cupons → abas Ativos/Inativos; expirar cupom → aparece em Inativos
3. Copiar → clipboard com código WABA-…
