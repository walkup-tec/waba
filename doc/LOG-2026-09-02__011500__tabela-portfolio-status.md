# LOG — Tabela de templates: portfólio, tradução e tags de status

## Contexto

Lista do Laboratório Cloud mostrava PENDING/UTILITY em inglês, sem o portfólio. Pedido: traduzir, primeira coluna = portfólio usado, status em tag colorida da Meta.

## Solução

- DTO público inclui `connectionId` e `portfolioName` (nome verificado da WABA). Sem token.
- Tabela: Portfólio | Nome | Idioma | Categoria | Status | Qualidade | Última sincronização | Ações
- Status Meta → tag: Aprovado (verde), Em análise (amarelo), Reprovado (vermelho), Pausado, Desativado, Em recurso, etc.
- Categoria/qualidade/idioma traduzidos na UI. Valores brutos da Meta seguem no JSON de visualizar.

Doc status: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-template.types.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template.service.ts`
- `index.html` / `dist/`
- Marker: `DEPLOY-2026-09-02-011500-tabela-portfolio-status`

## Como validar

Atualizar da Meta: primeira coluna com o portfólio; PENDING vira tag amarela «Em análise»; UTILITY vira «Utilidade».

## Palavras-chave

portfolioName, status tag, PENDING, APPROVED, REJECTED, tabela templates
