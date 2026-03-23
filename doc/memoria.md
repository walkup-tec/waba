# Memória Consolidada do Projeto

Este arquivo é atualizado a cada tarefa executada.

Como usar:
- Antes de iniciar mudanças, procure aqui palavras-chave do pedido.
- Se necessário, leia os `doc/LOG-*.md` correspondentes para detalhes.

Última atualização: (gerenciado automaticamente)

## Última atualização
2026-03-21

Resumo desta retomada:
- Fluxo "Atualize tudo" executado: build, revisão de mudanças, documentação, commit e push.
- `dist/` sincronizado com estado atual de `index.html`/`src`.

Palavras-chave para busca:
- atualize-tudo
- build-dist
- commit-push

---

(anterior) 2026-03-21

Resumo da retomada anterior:
- Disparador: `TTL do lock` removido da UI e movido para regra automática no backend.
- Regra aplicada: `lockTtlSeconds = clamp(delayMaxSeconds * 3, 180, 1800)`.
- Build concluído após ajuste (`dist` atualizado).

Palavras-chave para busca:
- lock-ttl-auto
- backend-lock-policy
- disparos-seguranca-config

---

(anterior) 2026-03-21

Resumo da retomada anterior:
- SQL criado para provisionar tabelas do Disparador:
  - `instancias_uso_config`
  - `disparos_config`
  - `disparos_message_templates`
- Observado que o ambiente atual acessa Supabase via `service_role`, mas sem função RPC de execução SQL (`exec_sql`), exigindo execução pelo SQL Editor.

Palavras-chave para busca:
- create-disparos-tables
- instancias_uso_config
- disparos_config
- disparos_message_templates

---

(anterior) 2026-03-21

Resumo da retomada anterior:
- Disparos: página evoluída com formulário completo de variáveis do orquestrador.
- Instâncias: novos toggles por linha para uso em `Aquecedor` e `Disparador`.
- Backend: endpoints para configuração do disparador, fallback de próxima instância, shortener e importação de templates.
- Aquecedor passa a considerar somente instâncias habilitadas para aquecimento.
- Importação de planilha com mapeamento de colunas no frontend.

Palavras-chave para busca:
- disparos-config
- instancias-uso-aquecedor-disparador
- disparos-next-instance
- disparos-shorten
- disparos-templates-import

---

(anterior) 2026-03-21

Resumo da retomada anterior:
- Criada página **Disparos** com aba na navegação (desktop e mobile).
- Layout em duas colunas: Resumo (cards placeholder) + Variáveis e regras (área a preencher) | Atividade recente.
- Painel pronto para receber regras, variáveis e pontos críticos quando definidos.

Palavras-chave para busca:
- disparos
- tab-disparos
- disparos-config-area
- variaveis-regras

---

(anterior) 2026-03-20_123000

Resumo da retomada anterior:
- Aquecedor: `GET /aquecedor/diagnostico` para EVO, fila, janela e próxima combinação.
- Envio teste ignora janela humanizada e cooldown (`runAquecedorCycle(true)`).
- Ordem das combinações confirmada: origem fixa → destinos em sequência (sem autoenvio).
- `POST /aquecedor/criar-mensagem-teste` para inserir mensagem PENDENTE na fila.
- UI: botões Diagnóstico e Criar mensagem teste na aba Aquecedor.

Palavras-chave para busca:
- aquecedor-diagnostico
- envio-teste-bypass
- criar-mensagem-teste
- aquecedor-combinacoes-origem-destino

---

(anterior) 2026-03-20_065503

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

## Atualização recente (logo/favIcon)
- `favicon.ico` retornava `404`
- uso do asset real: `assets/media/favicon-light.png`

Palavras-chave para buscar:
- favicon-light
- brand-logo
- favicon-404

## Atualização recente (header branding)
- Remoção de inscrições visíveis do header
- Uso de `Drax-logo-footer.png` no logo e favicon

Palavras-chave para buscar:
- remove-inscriptions
- Drax-logo-footer

## Atualização recente (refino visual)
- Navegação de páginas no estilo sublinhado para aba ativa
- Layout geral mais sutil e elegante (menos glow, menos peso visual)

Palavras-chave para buscar:
- underline-tabs
- subtle-ui

## Atualização recente (instâncias com avatar)
- Foto de perfil por instância via `profilePicUrl`
- Atualização eficiente de avatar com `avatarVersion` (`updatedAt`)
- Correção de contadores EVO: `_count.Contact` e `_count.Message`

Palavras-chave para buscar:
- profilePicUrl
- avatarVersion
- count-contact-message

## Atualização recente (scrollbars)
- Scrollbars globais estilizadas com paleta do projeto
- Suporte para Firefox e WebKit

Palavras-chave para buscar:
- scrollbar-theme
- webkit-scrollbar

## Atualização recente (Aquecedor - configuração no sistema)
- Criada a aba `Aquecedor` com formulário de variáveis operacionais.
- Padrao recomendado inicia habilitado e pode ser desligado para personalização.
- Configuração salva e carregada pelo backend (`GET/POST /aquecedor/config`).
- Persistência em tabela `aquecedor_config` com script SQL dedicado.

Palavras-chave para buscar:
- aquecedor-config
- usar-padrao-recomendado
- aquecedor-custom-config
- create-aquecedor-config-table

