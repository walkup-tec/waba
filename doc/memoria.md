# Memória Consolidada do Projeto

Este arquivo é atualizado a cada tarefa executada.

Como usar:
- Antes de iniciar mudanças, procure aqui palavras-chave do pedido.
- Se necessário, leia os `doc/LOG-*.md` correspondentes para detalhes.

Última atualização: (gerenciado automaticamente)

## Última atualização
2026-03-20_065503

Resumo desta retomada:
- Ajustei o backend para que `GET /dados` responda rapidamente com `503` quando Supabase não estiver configurado e valide `rangeStart/rangeEnd` no formato `YYYY-MM-DD`.
- Adicionei timeout via `AbortController` em `GET /instancias` para evitar hangs.
- Atualizei o `build` para copiar `index.html` da raiz para `dist/index.html` automaticamente.

Palavras-chave para busca:
- supabase-config
- GET /dados
- evolution-timeout
- abortcontroller
- copy-index-html

## Atualização recente (UI)
- Tabs: `Dashboard` e `Instâncias`
- Menu mobile expansivo (drawer)
- Branding DRAX: `favicon` no `head` e logo compacto no título
- `GET /instancias` agora retorna `items`

Palavras-chave para buscar:
- tabs-dashboard-instancias
- mobile-drawer
- favicon
- instances-items

